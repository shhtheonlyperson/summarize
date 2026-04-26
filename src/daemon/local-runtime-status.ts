import {
  DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS,
  type LocalRuntimeKind,
  type LocalRuntimeProbeError,
  type LocalRuntimeProbeResult,
  probeLocalRuntime,
} from "@steipete/summarize-core/local-runtime";
import type { SummarizeConfig } from "../config.js";
import { formatOutputLanguageForJson, resolveOutputLanguage } from "../language.js";
import {
  getDefaultLocalModelRoutingModel,
  type LocalModelRoutingBucket,
  resolveLanguageAwareLocalModelInput,
} from "../run/local-model-routing.js";
import { resolveLocalOnlyMode } from "../run/local-only.js";
import { resolveEnvState } from "../run/run-env.js";

export type LocalRuntimeStatusProbe = {
  ok: boolean;
  reachable: boolean;
  runtimeType: LocalRuntimeKind | null;
  runtimeLabel: string | null;
  endpointHost: string | null;
  timeoutMs: number;
  models: {
    count: number;
    hints: string[];
  };
  server: {
    status: number;
    name?: string;
    version?: string;
  } | null;
  error: {
    code: LocalRuntimeProbeError["code"];
    message: string;
    status?: number;
  } | null;
};

export type LocalRuntimeStatusPayload = {
  ok: true;
  localOnly: {
    enabled: boolean;
    source: string | null;
  };
  runtime: {
    configured: boolean;
    type: LocalRuntimeKind | null;
    endpointHost: string | null;
    baseUrlSource: "configured" | "default" | null;
  };
  modelHints: {
    configuredModel: {
      input: string;
      source: "env" | "config" | "default";
    };
    localRoutingEnabled: boolean;
    selected: {
      bucket: LocalModelRoutingBucket;
      modelInput: string;
      language: ReturnType<typeof formatOutputLanguageForJson>;
    } | null;
    routes: Array<{
      bucket: LocalModelRoutingBucket;
      modelInput: string;
      language: ReturnType<typeof formatOutputLanguageForJson>;
    }>;
  };
  probes: LocalRuntimeStatusProbe[];
  warnings: string[];
};

type ProbeLocalRuntimeFn = typeof probeLocalRuntime;

type LocalRuntimeStatusTarget = {
  input:
    | LocalRuntimeKind
    | {
        kind: LocalRuntimeKind;
        baseUrl?: string;
      };
  configured: boolean;
  runtimeType: LocalRuntimeKind;
  endpointHost: string | null;
};

function endpointHostFromUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  try {
    const host = new URL(value).host.trim();
    return host || null;
  } catch {
    return null;
  }
}

function configuredOpenAiBaseUrl({
  env,
  config,
}: {
  env: Record<string, string | undefined>;
  config: SummarizeConfig | null;
}): string | null {
  const envState = resolveEnvState({ env, envForRun: env, configForCli: config });
  return envState.providerBaseUrls.openai?.trim() || null;
}

function resolveRuntimeTargets({
  env,
  config,
}: {
  env: Record<string, string | undefined>;
  config: SummarizeConfig | null;
}): { targets: LocalRuntimeStatusTarget[]; warnings: string[] } {
  const openAiBaseUrl = configuredOpenAiBaseUrl({ env, config });
  if (openAiBaseUrl) {
    return {
      targets: [
        {
          input: { kind: "openai-compatible", baseUrl: openAiBaseUrl },
          configured: true,
          runtimeType: "openai-compatible",
          endpointHost: endpointHostFromUrl(openAiBaseUrl),
        },
      ],
      warnings: [],
    };
  }

  return {
    targets: [
      { input: "llama-cpp", configured: false, runtimeType: "llama-cpp", endpointHost: null },
      { input: "ollama", configured: false, runtimeType: "ollama", endpointHost: null },
    ],
    warnings: [
      "No local OpenAI-compatible endpoint is configured; probing default llama.cpp and Ollama endpoints.",
    ],
  };
}

function resolveConfiguredModelHint({
  env,
  config,
}: {
  env: Record<string, string | undefined>;
  config: SummarizeConfig | null;
}): LocalRuntimeStatusPayload["modelHints"]["configuredModel"] {
  const envModel = env.SUMMARIZE_MODEL?.trim() ?? "";
  if (envModel) return { input: envModel, source: "env" };

  const configured = config?.model;
  if (configured) {
    if ("id" in configured && configured.id.trim()) {
      return { input: configured.id.trim(), source: "config" };
    }
    if ("name" in configured && configured.name.trim()) {
      return { input: configured.name.trim(), source: "config" };
    }
    if ("mode" in configured && configured.mode === "auto") {
      return { input: "auto", source: "config" };
    }
  }

  return { input: "auto", source: "default" };
}

function resolveLocalRoutingRoutes(
  config: SummarizeConfig | null,
): LocalRuntimeStatusPayload["modelHints"]["routes"] {
  if (config?.localRouting?.enabled !== true) return [];

  const languages = [
    { bucket: "english" as const, raw: "English" },
    { bucket: "traditionalChinese" as const, raw: "zh-TW" },
    { bucket: "bilingual" as const, raw: "en+zh-TW bilingual" },
    { bucket: "fallback" as const, raw: "auto" },
  ];

  return languages.map(({ bucket, raw }) => {
    const language = resolveOutputLanguage(raw);
    const routed = resolveLanguageAwareLocalModelInput({ config, outputLanguage: language });
    const fallbackModel = getDefaultLocalModelRoutingModel(bucket);
    return {
      bucket,
      modelInput: routed?.modelInput ?? fallbackModel,
      language: formatOutputLanguageForJson(language),
    };
  });
}

function resolveSelectedLocalRoutingHint({
  config,
}: {
  config: SummarizeConfig | null;
}): LocalRuntimeStatusPayload["modelHints"]["selected"] {
  if (config?.localRouting?.enabled !== true) return null;
  const configuredLanguage = resolveOutputLanguage(
    config.output?.language ?? config.language ?? "auto",
  );
  const routed = resolveLanguageAwareLocalModelInput({
    config,
    outputLanguage: configuredLanguage,
  });
  if (!routed) return null;
  return {
    bucket: routed.bucket,
    modelInput: routed.modelInput,
    language: formatOutputLanguageForJson(configuredLanguage),
  };
}

function sanitizeProbeError(error: LocalRuntimeProbeError): LocalRuntimeStatusProbe["error"] {
  const message =
    error.code === "invalid-runtime" ? "Invalid local runtime configuration." : error.message;
  return {
    code: error.code,
    message,
    ...(typeof error.status === "number" ? { status: error.status } : {}),
  };
}

function summarizeProbeResult(
  result: LocalRuntimeProbeResult,
  target: LocalRuntimeStatusTarget,
): LocalRuntimeStatusProbe {
  const endpointHost =
    endpointHostFromUrl(result.endpoint) ??
    endpointHostFromUrl(result.runtime?.baseUrl) ??
    target.endpointHost;
  if (!result.ok) {
    return {
      ok: false,
      reachable: false,
      runtimeType: result.runtime?.kind ?? target.runtimeType,
      runtimeLabel: result.runtime?.label ?? null,
      endpointHost,
      timeoutMs: result.timeoutMs,
      models: { count: 0, hints: [] },
      server: null,
      error: sanitizeProbeError(result.error),
    };
  }

  return {
    ok: true,
    reachable: true,
    runtimeType: result.runtime.kind,
    runtimeLabel: result.runtime.label,
    endpointHost,
    timeoutMs: result.timeoutMs,
    models: {
      count: result.models.length,
      hints: result.models.map((model) => model.id).slice(0, 5),
    },
    server: result.server,
    error: null,
  };
}

export async function buildLocalRuntimeStatus({
  env,
  config,
  fetchImpl,
  timeoutMs = DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS,
  probe = probeLocalRuntime,
}: {
  env: Record<string, string | undefined>;
  config: SummarizeConfig | null;
  fetchImpl: typeof fetch;
  timeoutMs?: number;
  probe?: ProbeLocalRuntimeFn;
}): Promise<LocalRuntimeStatusPayload> {
  const localOnly = resolveLocalOnlyMode({ config });
  const { targets, warnings } = resolveRuntimeTargets({ env, config });
  const probeResults = await Promise.all(
    targets.map((target) =>
      probe(target.input, {
        fetch: fetchImpl,
        timeoutMs,
        allowRemoteBaseUrls: false,
      }),
    ),
  );
  const probes = probeResults.map((result, index) => {
    const target = targets[index];
    if (!target) throw new Error("Missing local runtime probe target.");
    return summarizeProbeResult(result, target);
  });
  const configuredProbe = probes.find((_probe, index) => targets[index]?.configured) ?? null;

  return {
    ok: true,
    localOnly: {
      enabled: localOnly.enabled,
      source: localOnly.source,
    },
    runtime: {
      configured: Boolean(configuredProbe),
      type: configuredProbe?.runtimeType ?? null,
      endpointHost: configuredProbe?.endpointHost ?? null,
      baseUrlSource: configuredProbe ? "configured" : null,
    },
    modelHints: {
      configuredModel: resolveConfiguredModelHint({ env, config }),
      localRoutingEnabled: config?.localRouting?.enabled === true,
      selected: resolveSelectedLocalRoutingHint({ config }),
      routes: resolveLocalRoutingRoutes(config),
    },
    probes,
    warnings,
  };
}
