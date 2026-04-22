import { isLocalRuntimeHostname } from "@steipete/summarize-core/local-runtime";
import type { SummarizeConfig } from "../config.js";
import { parseGatewayStyleModelId } from "../llm/model-id.js";
import type { ModelAttempt } from "./types.js";

export const LOCAL_ONLY_CONFIG_SOURCE = "privacy.localOnly";
export const LOCAL_ONLY_REQUEST_SOURCE = "request localOnly";

export type LocalOnlyModeSource =
  | typeof LOCAL_ONLY_CONFIG_SOURCE
  | typeof LOCAL_ONLY_REQUEST_SOURCE;

export type LocalOnlyMode = {
  enabled: boolean;
  source: LocalOnlyModeSource | null;
};

export type LocalOnlyProviderBaseUrls = {
  openai: string | null;
};

export type LocalOnlyModelCandidate = Pick<
  ModelAttempt,
  "transport" | "userModelId" | "llmModelId" | "forceOpenRouter"
> & {
  openaiBaseUrlOverride?: string | null;
};

export class LocalOnlyRemoteProviderError extends Error {
  code = "LOCAL_ONLY_REMOTE_PROVIDER_BLOCKED" as const;
}

export function isLocalOnlyRemoteProviderError(
  error: unknown,
): error is LocalOnlyRemoteProviderError {
  return (
    error instanceof LocalOnlyRemoteProviderError ||
    (error instanceof Error &&
      (error as { code?: unknown }).code === "LOCAL_ONLY_REMOTE_PROVIDER_BLOCKED")
  );
}

export function resolveLocalOnlyMode({
  config,
  requestLocalOnly,
}: {
  config: SummarizeConfig | null | undefined;
  requestLocalOnly?: boolean | null;
}): LocalOnlyMode {
  if (typeof requestLocalOnly === "boolean") {
    return { enabled: requestLocalOnly, source: LOCAL_ONLY_REQUEST_SOURCE };
  }
  if (typeof config?.privacy?.localOnly === "boolean") {
    return { enabled: config.privacy.localOnly, source: LOCAL_ONLY_CONFIG_SOURCE };
  }
  return { enabled: false, source: null };
}

function sourceLabel(policy: LocalOnlyMode): string {
  return policy.source ?? "local-only mode";
}

function disableHint(policy: LocalOnlyMode): string {
  if (policy.source === LOCAL_ONLY_REQUEST_SOURCE) {
    return "set request localOnly to false";
  }
  if (policy.source === LOCAL_ONLY_CONFIG_SOURCE) {
    return 'set "privacy.localOnly": false in config';
  }
  return "disable local-only mode";
}

function sanitizeBaseUrlForError(raw: string): string {
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "configured OpenAI-compatible endpoint";
  }
}

function createLocalOnlyError({
  policy,
  modelId,
  reason,
}: {
  policy: LocalOnlyMode;
  modelId: string;
  reason: string;
}): LocalOnlyRemoteProviderError {
  return new LocalOnlyRemoteProviderError(
    `Local-only mode (${sourceLabel(policy)}) blocked ${modelId}: ${reason}. ` +
      "Use an openai/... model with OPENAI_BASE_URL or openai.baseUrl set to a localhost OpenAI-compatible endpoint, " +
      `or ${disableHint(policy)}.`,
  );
}

function effectiveOpenAiBaseUrl({
  candidate,
  providerBaseUrls,
}: {
  candidate: LocalOnlyModelCandidate;
  providerBaseUrls: LocalOnlyProviderBaseUrls;
}): string {
  const override = candidate.openaiBaseUrlOverride?.trim() ?? "";
  if (override) return override;
  const configured = providerBaseUrls.openai?.trim() ?? "";
  return configured || "https://api.openai.com/v1";
}

function isLocalOpenAiBaseUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return isLocalRuntimeHostname(url.hostname);
  } catch {
    return false;
  }
}

export function assertLocalOnlyModelAllowed({
  policy,
  candidate,
  providerBaseUrls,
}: {
  policy: LocalOnlyMode;
  candidate: LocalOnlyModelCandidate;
  providerBaseUrls: LocalOnlyProviderBaseUrls;
}): void {
  if (!policy.enabled) return;

  if (candidate.transport === "cli") {
    throw createLocalOnlyError({
      policy,
      modelId: candidate.userModelId,
      reason:
        "CLI transports are not allowed because local-only mode cannot verify whether the CLI calls a remote service",
    });
  }

  if (
    candidate.transport === "openrouter" ||
    candidate.forceOpenRouter ||
    candidate.userModelId.toLowerCase().startsWith("openrouter/")
  ) {
    throw createLocalOnlyError({
      policy,
      modelId: candidate.userModelId,
      reason: "OpenRouter is a remote provider",
    });
  }

  const rawModelId = candidate.llmModelId ?? candidate.userModelId;
  let parsed: ReturnType<typeof parseGatewayStyleModelId>;
  try {
    parsed = parseGatewayStyleModelId(rawModelId);
  } catch {
    throw createLocalOnlyError({
      policy,
      modelId: candidate.userModelId,
      reason: "the model provider could not be verified as local",
    });
  }

  if (parsed.provider !== "openai") {
    throw createLocalOnlyError({
      policy,
      modelId: candidate.userModelId,
      reason: `${parsed.provider}/... is a remote provider; local-only mode only allows OpenAI-compatible localhost endpoints`,
    });
  }

  const baseUrl = effectiveOpenAiBaseUrl({ candidate, providerBaseUrls });
  if (!isLocalOpenAiBaseUrl(baseUrl)) {
    throw createLocalOnlyError({
      policy,
      modelId: candidate.userModelId,
      reason: `the OpenAI-compatible endpoint ${sanitizeBaseUrlForError(baseUrl)} is not localhost`,
    });
  }
}
