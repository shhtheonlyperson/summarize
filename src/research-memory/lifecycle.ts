import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ExtractedLinkContent, LinkPreviewProgressEvent } from "../content/index.js";
import type { RunMetricsReport } from "../costs.js";
import type { OutputLanguage } from "../language.js";
import { parseGatewayStyleModelId } from "../llm/model-id.js";
import type { LocalOnlyMode } from "../run/local-only.js";
import type { ModelSelectionSource } from "../run/run-models.js";
import type {
  ResearchMemoryArtifact,
  ResearchMemoryArtifactKind,
  ResearchMemoryArtifactPrivacyClass,
  ResearchMemoryEventType,
  ResearchMemoryFailureStage,
  ResearchMemoryJsonObject,
  ResearchMemoryJsonValue,
  ResearchMemoryLanguageBucket,
  ResearchMemoryModelRouteId,
  ResearchMemoryRun,
  ResearchMemoryRunKind,
  ResearchMemoryRunMode,
  ResearchMemorySourceId,
  ResearchMemorySourceKind,
  ResearchMemoryStore,
} from "./store.js";

const LARGE_TEXT_ARTIFACT_BYTES = 4096;
const SENSITIVE_KEY_PATTERN =
  /(^|[-_])(authorization|auth|bearer|cookie|set-cookie|token|api[-_]?key|secret|password|passwd|credential|session|jwt)([-_]|$)/i;
const SENSITIVE_QUERY_PATTERN =
  /(^|[-_])(access[-_]?token|refresh[-_]?token|token|api[-_]?key|key|secret|signature|sig|auth|authorization|cookie|session|password|code|jwt)([-_]|$)/i;

export type ResearchMemoryRunRecorderOptions = {
  store: ResearchMemoryStore;
  artifactRoot: string;
  run: Omit<ResearchMemoryRun, "privacyMode"> & {
    privacyMode?: Partial<ResearchMemoryRun["privacyMode"]>;
  };
  outputLanguage: OutputLanguage;
  model: {
    requestedModelInput: string;
    requestedModelLabel: string;
    selectionSource: ModelSelectionSource;
    providerBaseUrls: {
      openai: string | null;
      nvidia?: string | null;
      anthropic?: string | null;
      google?: string | null;
      xai?: string | null;
      zai?: string | null;
    };
    localOnlyMode: LocalOnlyMode;
  };
  now?: () => number;
  idFactory?: () => string;
  onWarning?: (message: string) => void;
};

export type RecordAssetSourceInput = {
  sourceKind: "file" | "asset-url";
  sourceLabel: string;
  mediaType: string | null;
  filename: string | null;
  content?: string | null;
  diagnostics?: ResearchMemoryJsonObject | null;
};

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

export function sanitizeUrlForResearchMemory(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_PATTERN.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return redactSensitiveText(value);
  }
}

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

function isLocalEndpointHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":", 1)[0]?.toLowerCase() ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function redactSensitiveText(value: string): string {
  return value
    .replaceAll(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replaceAll(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replaceAll(
      /\b(?:api[_-]?key|token|secret|password)=([^&\s]+)/gi,
      (_match, _value) => "credential=[redacted]",
    );
}

function sanitizeJsonValue(value: unknown, depth = 0): ResearchMemoryJsonValue {
  if (depth > 6) return "[depth-limit]";
  if (value === null) return null;
  if (typeof value === "string") {
    const maybeUrl = sanitizeUrlForResearchMemory(value);
    return truncate(maybeUrl ?? redactSensitiveText(value), 2000);
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, ResearchMemoryJsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitizeJsonValue(child, depth + 1);
    }
    return out;
  }
  return null;
}

export function sanitizeJsonObject(value: unknown): ResearchMemoryJsonObject {
  const sanitized = sanitizeJsonValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as ResearchMemoryJsonObject)
    : {};
}

function languageBucket(language: OutputLanguage): ResearchMemoryLanguageBucket {
  if (language.kind === "auto") return "none";
  const normalized = `${language.tag} ${language.label}`.toLowerCase();
  if (
    normalized.includes("bilingual") ||
    (normalized.includes("english") && normalized.includes("chinese"))
  ) {
    return "bilingual";
  }
  if (
    normalized.includes("zh-tw") ||
    normalized.includes("zh-hant") ||
    normalized.includes("traditional")
  ) {
    return "traditionalChinese";
  }
  if (
    normalized === "en english" ||
    normalized.startsWith("en ") ||
    normalized.includes("english")
  ) {
    return "english";
  }
  return "fallback";
}

function sourceKindForUrl(extracted: ExtractedLinkContent): ResearchMemorySourceKind {
  const url = extracted.url.toLowerCase();
  if (url.startsWith("file:")) return "local-file";
  if (extracted.video?.kind === "youtube" || extracted.siteName === "YouTube") return "youtube";
  if (extracted.isVideoOnly || extracted.video) return "video";
  return "url";
}

function sourceKindForAsset(input: RecordAssetSourceInput): ResearchMemorySourceKind {
  if (input.sourceKind === "file") return "local-file";
  const mediaType = input.mediaType?.toLowerCase() ?? "";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType === "application/pdf") return "pdf";
  if (mediaType.startsWith("image/")) return "image";
  return "url";
}

function normalizeProviderKind(modelId: string): string | null {
  const lower = modelId.toLowerCase();
  if (lower.startsWith("cli/")) return "cli";
  if (lower.startsWith("openrouter/")) return "openrouter";
  try {
    return parseGatewayStyleModelId(modelId).provider;
  } catch {
    return null;
  }
}

function artifactExtension(kind: ResearchMemoryArtifactKind, mimeType: string | null): string {
  if (kind === "summary" || mimeType === "text/markdown") return "md";
  if (mimeType === "application/json") return "json";
  return "txt";
}

function safePathSegment(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9._-]+/g, "-").replaceAll(/^-|-$/g, "") || "artifact";
}

function defaultPrivacyMode(
  localOnlyMode: LocalOnlyMode,
  overrides: Partial<ResearchMemoryRun["privacyMode"]> | undefined,
): ResearchMemoryRun["privacyMode"] {
  return {
    localOnlyEnabled: localOnlyMode.enabled,
    localOnlySource: localOnlyMode.source,
    policyResult: localOnlyMode.enabled ? "allowed" : "not-applicable",
    allowedTransports: localOnlyMode.enabled
      ? ["localhost-openai-compatible"]
      : ["remote-provider", "localhost-openai-compatible", "cli"],
    protectedData: ["apiKeys", "bearerTokens", "cookies", "rawAuthHeaders", "protectedEnv"],
    exportState: "not-exported",
    notes: null,
    metadata: {},
    ...overrides,
  };
}

export class ResearchMemoryRunRecorder {
  private readonly store: ResearchMemoryStore;
  private readonly artifactRoot: string;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly onWarning: (message: string) => void;
  private readonly outputLanguage: OutputLanguage;
  private readonly model: ResearchMemoryRunRecorderOptions["model"];
  private run: ResearchMemoryRun;
  private enabled = true;
  private started = false;
  private sequence = 0;
  private queue: Promise<void> = Promise.resolve();
  private primarySourceId: ResearchMemorySourceId | null = null;
  private summaryArtifactId: string | null = null;
  private readonly recordedRoutes = new Map<string, ResearchMemoryModelRouteId>();

  constructor(options: ResearchMemoryRunRecorderOptions) {
    this.store = options.store;
    this.artifactRoot = options.artifactRoot;
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? randomUUID;
    this.onWarning = options.onWarning ?? (() => {});
    this.outputLanguage = options.outputLanguage;
    this.model = options.model;
    this.run = {
      ...options.run,
      inputRef: sanitizeUrlForResearchMemory(options.run.inputRef) ?? options.run.inputRef,
      privacyMode: defaultPrivacyMode(options.model.localOnlyMode, options.run.privacyMode),
    };
  }

  get runId(): string {
    return this.run.id;
  }

  async start(): Promise<void> {
    if (!this.enabled || this.started) return;
    try {
      await this.store.initialize();
      await this.store.createRun(this.run);
      this.started = true;
      await this.addEventNow("status", { stage: "started" }, null, false);
    } catch (error) {
      this.disable(error);
    }
  }

  recordLinkPreviewProgress(event: LinkPreviewProgressEvent): void {
    if (event.kind.includes("progress")) return;
    void this.enqueue(async () => {
      await this.addEventNow("status", { stage: "link-preview", event }, null, true);
    });
  }

  async recordExtractedUrlSource(extracted: ExtractedLinkContent): Promise<void> {
    await this.enqueue(async () => {
      const sourceId = this.sourceIdFor(extracted.url);
      const createdAt = this.now();
      await this.store.upsertSource({
        id: sourceId,
        runId: this.run.id,
        sourceKind: sourceKindForUrl(extracted),
        canonicalUrl: sanitizeUrlForResearchMemory(extracted.url),
        urlHash: sha256Hex(extracted.url),
        title: extracted.title,
        siteName: extracted.siteName,
        contentType: null,
        languageHint: null,
        contentHash: sha256Hex(extracted.content),
        extractedArtifactId: null,
        fetchMetadata: sanitizeJsonObject({
          description: extracted.description,
          truncated: extracted.truncated,
          totalCharacters: extracted.totalCharacters,
          wordCount: extracted.wordCount,
          transcriptCharacters: extracted.transcriptCharacters,
          transcriptLines: extracted.transcriptLines,
          transcriptWordCount: extracted.transcriptWordCount,
          transcriptSource: extracted.transcriptSource,
          transcriptionProvider: extracted.transcriptionProvider,
          mediaDurationSeconds: extracted.mediaDurationSeconds,
          video: extracted.video,
          isVideoOnly: extracted.isVideoOnly,
          diagnostics: extracted.diagnostics,
        }),
        createdAt,
      });
      const artifact = await this.addTextArtifactNow({
        artifactKind: extracted.transcriptSource ? "transcript" : "extracted-text",
        text: extracted.transcriptTimedText ?? extracted.content,
        sourceId,
        mimeType: "text/plain",
        privacyClass: "public-source",
        metadata: {
          source: "url-flow",
          transcriptTimedText: Boolean(extracted.transcriptTimedText),
        },
      });
      await this.store.upsertSource({
        id: sourceId,
        runId: this.run.id,
        sourceKind: sourceKindForUrl(extracted),
        canonicalUrl: sanitizeUrlForResearchMemory(extracted.url),
        urlHash: sha256Hex(extracted.url),
        title: extracted.title,
        siteName: extracted.siteName,
        contentType: null,
        languageHint: null,
        contentHash: sha256Hex(extracted.content),
        extractedArtifactId: artifact.id,
        fetchMetadata: sanitizeJsonObject({ diagnostics: extracted.diagnostics }),
        createdAt,
      });
      this.primarySourceId = sourceId;
      await this.addEventNow("status", { stage: "extracted", sourceId }, artifact.id, true);
    });
  }

  async recordAssetSource(input: RecordAssetSourceInput): Promise<ResearchMemorySourceId | null> {
    let result: ResearchMemorySourceId | null = null;
    await this.enqueue(async () => {
      const sourceId = this.sourceIdFor(input.sourceLabel);
      const createdAt = this.now();
      await this.store.upsertSource({
        id: sourceId,
        runId: this.run.id,
        sourceKind: sourceKindForAsset(input),
        canonicalUrl:
          input.sourceKind === "asset-url" ? sanitizeUrlForResearchMemory(input.sourceLabel) : null,
        urlHash: input.sourceKind === "asset-url" ? sha256Hex(input.sourceLabel) : null,
        title: input.filename,
        siteName: null,
        contentType: input.mediaType,
        languageHint: null,
        contentHash: input.content ? sha256Hex(input.content) : null,
        extractedArtifactId: null,
        fetchMetadata: sanitizeJsonObject({
          sourceKind: input.sourceKind,
          sourceLabel: input.sourceLabel,
          mediaType: input.mediaType,
          filename: input.filename,
          diagnostics: input.diagnostics ?? null,
        }),
        createdAt,
      });
      if (input.content) {
        const artifact = await this.addTextArtifactNow({
          artifactKind: "extracted-text",
          text: input.content,
          sourceId,
          mimeType: "text/plain",
          privacyClass: input.sourceKind === "file" ? "local-file" : "public-source",
          metadata: { source: "asset-flow" },
        });
        await this.store.upsertSource({
          id: sourceId,
          runId: this.run.id,
          sourceKind: sourceKindForAsset(input),
          canonicalUrl:
            input.sourceKind === "asset-url"
              ? sanitizeUrlForResearchMemory(input.sourceLabel)
              : null,
          urlHash: input.sourceKind === "asset-url" ? sha256Hex(input.sourceLabel) : null,
          title: input.filename,
          siteName: null,
          contentType: input.mediaType,
          languageHint: null,
          contentHash: sha256Hex(input.content),
          extractedArtifactId: artifact.id,
          fetchMetadata: sanitizeJsonObject({ diagnostics: input.diagnostics ?? null }),
          createdAt,
        });
      }
      this.primarySourceId = sourceId;
      result = sourceId;
      await this.addEventNow("status", { stage: "source", sourceId }, null, true);
    });
    return result;
  }

  async recordModelRoute(modelId: string, metadata: ResearchMemoryJsonObject = {}): Promise<void> {
    await this.enqueue(async () => {
      if (this.recordedRoutes.has(modelId)) return;
      const routeId = `route-${this.idFactory()}`;
      this.recordedRoutes.set(modelId, routeId);
      const providerKind = normalizeProviderKind(modelId);
      const baseUrl =
        providerKind === "openai"
          ? this.model.providerBaseUrls.openai
          : providerKind === "nvidia"
            ? this.model.providerBaseUrls.nvidia
            : providerKind === "zai"
              ? this.model.providerBaseUrls.zai
              : providerKind === "anthropic"
                ? this.model.providerBaseUrls.anthropic
                : providerKind === "google"
                  ? this.model.providerBaseUrls.google
                  : providerKind === "xai"
                    ? this.model.providerBaseUrls.xai
                    : null;
      const endpointHost = endpointHostFromUrl(baseUrl);
      const localOnlyAllowed =
        !this.model.localOnlyMode.enabled ||
        (providerKind === "openai" && isLocalEndpointHost(endpointHost));
      await this.store.addModelRoute({
        id: routeId,
        runId: this.run.id,
        attemptIndex: this.recordedRoutes.size - 1,
        requestedModelInput: this.model.requestedModelInput,
        selectionSource: this.model.selectionSource,
        languageBucket: languageBucket(this.outputLanguage),
        selectedModelId: modelId,
        providerKind,
        localRuntimeKind:
          providerKind === "openai" && isLocalEndpointHost(endpointHost)
            ? "openai-compatible"
            : null,
        endpointHost,
        baseUrlSource: endpointHost ? "configured" : null,
        probeStatus: "not-run",
        localOnlyAllowed,
        blockedReason: localOnlyAllowed
          ? null
          : "local-only policy requires localhost OpenAI-compatible endpoint",
        metadata: sanitizeJsonObject({
          requestedModelLabel: this.model.requestedModelLabel,
          ...metadata,
        }),
        createdAt: this.now(),
      });
      await this.addEventNow("model-selected", { modelId, routeId }, null, true);
    });
  }

  async recordSummaryArtifact(
    summary: string,
    metadata: ResearchMemoryJsonObject = {},
  ): Promise<void> {
    await this.enqueue(async () => {
      const artifact = await this.addTextArtifactNow({
        artifactKind: "summary",
        text: summary,
        sourceId: this.primarySourceId,
        mimeType: "text/markdown",
        privacyClass: "model-output",
        metadata,
      });
      this.summaryArtifactId = artifact.id;
      this.run = { ...this.run, summaryArtifactId: artifact.id };
      await this.addEventNow(
        "done",
        { stage: "summary", artifactId: artifact.id },
        artifact.id,
        true,
      );
    });
  }

  async recordSlides(slides: unknown): Promise<void> {
    await this.enqueue(async () => {
      const artifact = await this.store.addArtifact({
        id: `artifact-${this.idFactory()}`,
        runId: this.run.id,
        sourceId: this.primarySourceId,
        artifactKind: "slides-json",
        storageKind: "inline-json",
        relativePath: null,
        inlineText: null,
        inlineJson: sanitizeJsonValue(slides),
        mimeType: "application/json",
        byteSize: null,
        sha256: null,
        privacyClass: "diagnostic",
        retention: "keep",
        metadata: {},
        createdAt: this.now(),
      });
      await this.addEventNow("slides-status", { stage: "slides-extracted" }, artifact.id, true);
    });
  }

  recordStatus(text: string, metadata: ResearchMemoryJsonObject = {}): void {
    void this.enqueue(async () => {
      await this.addEventNow("status", { text, ...metadata }, null, true);
    });
  }

  recordCacheResult(kind: string, cached: boolean): void {
    void this.enqueue(async () => {
      await this.addEventNow(cached ? "cache-hit" : "cache-miss", { kind, cached }, null, true);
    });
  }

  async complete(metrics: RunMetricsReport | null): Promise<void> {
    await this.flush();
    if (!this.enabled || !this.started) return;
    await this.enqueue(async () => {
      this.run = {
        ...this.run,
        status: "succeeded",
        completedAt: this.now(),
        summaryArtifactId: this.summaryArtifactId,
        metrics: sanitizeJsonObject(metrics ?? {}),
      };
      await this.store.updateRun(this.run);
      await this.addEventNow("done", { stage: "completed" }, this.summaryArtifactId, true);
    });
    await this.flush();
  }

  async fail(error: unknown, stage: ResearchMemoryFailureStage = "unknown"): Promise<void> {
    await this.flush();
    if (!this.enabled || !this.started) return;
    await this.enqueue(async () => {
      const message = sanitizeErrorMessage(error);
      const failureId = `failure-${this.idFactory()}`;
      const routeId = Array.from(this.recordedRoutes.values()).at(-1) ?? null;
      await this.store.addFailure({
        id: failureId,
        runId: this.run.id,
        sourceId: this.primarySourceId,
        routeId,
        failureStage: stage,
        errorCode:
          error instanceof Error ? (((error as { code?: unknown }).code as string) ?? null) : null,
        message,
        stackArtifactId: null,
        retryable: null,
        createdAt: this.now(),
        sanitized: true,
        metadata: sanitizeJsonObject({
          name: error instanceof Error ? error.name : typeof error,
        }),
      });
      this.run = {
        ...this.run,
        status: "failed",
        completedAt: this.now(),
        metrics: this.run.metrics,
      };
      await this.store.updateRun(this.run);
      await this.addEventNow("error", { failureId, message }, null, true);
    });
    await this.flush();
  }

  async close(): Promise<void> {
    await this.flush();
    if (!this.started) return;
    try {
      await this.store.close();
    } catch (error) {
      this.onWarning(`Research memory close failed: ${sanitizeErrorMessage(error)}`);
    }
  }

  private sourceIdFor(value: string): ResearchMemorySourceId {
    return `source-${sha256Hex(value).slice(0, 24)}`;
  }

  private async addTextArtifactNow({
    artifactKind,
    text,
    sourceId,
    mimeType,
    privacyClass,
    metadata,
  }: {
    artifactKind: ResearchMemoryArtifactKind;
    text: string;
    sourceId: ResearchMemorySourceId | null;
    mimeType: string;
    privacyClass: ResearchMemoryArtifactPrivacyClass;
    metadata: ResearchMemoryJsonObject;
  }): Promise<ResearchMemoryArtifact> {
    const id = `artifact-${this.idFactory()}`;
    const safeText = redactSensitiveText(text);
    const bytes = Buffer.from(safeText, "utf8");
    const sha256 = sha256Hex(bytes);
    const useFile = bytes.byteLength > LARGE_TEXT_ARTIFACT_BYTES;
    if (useFile) {
      const relativePath = `${safePathSegment(this.run.id)}/${safePathSegment(id)}.${artifactExtension(
        artifactKind,
        mimeType,
      )}`;
      const fullPath = path.join(this.artifactRoot, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, bytes);
      return await this.store.addArtifact({
        id,
        runId: this.run.id,
        sourceId,
        artifactKind,
        storageKind: "file",
        relativePath,
        inlineText: null,
        inlineJson: null,
        mimeType,
        byteSize: bytes.byteLength,
        sha256,
        privacyClass,
        retention: "keep",
        metadata: sanitizeJsonObject(metadata),
        createdAt: this.now(),
      });
    }

    return await this.store.addArtifact({
      id,
      runId: this.run.id,
      sourceId,
      artifactKind,
      storageKind: "inline-text",
      relativePath: null,
      inlineText: safeText,
      inlineJson: null,
      mimeType,
      byteSize: bytes.byteLength,
      sha256,
      privacyClass,
      retention: "keep",
      metadata: sanitizeJsonObject(metadata),
      createdAt: this.now(),
    });
  }

  private async addEventNow(
    eventType: ResearchMemoryEventType,
    payload: unknown,
    artifactId: string | null,
    visibleToUi: boolean,
  ): Promise<void> {
    await this.store.addEvent({
      id: `event-${this.idFactory()}`,
      runId: this.run.id,
      sequence: this.sequence,
      eventType,
      createdAt: this.now(),
      payload: sanitizeJsonObject(payload),
      artifactId,
      visibleToUi,
    });
    this.sequence += 1;
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    if (!this.enabled || !this.started) return;
    this.queue = this.queue.then(operation, operation).catch((error) => {
      this.disable(error);
    });
    await this.queue;
  }

  private async flush(): Promise<void> {
    try {
      await this.queue;
    } catch {
      // enqueue already disables and reports.
    }
  }

  private disable(error: unknown): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.onWarning(`Research memory persistence disabled: ${sanitizeErrorMessage(error)}`);
  }
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return truncate(redactSensitiveText(message), 2000);
}

export function createResearchMemoryRunRecorder(
  options: ResearchMemoryRunRecorderOptions,
): ResearchMemoryRunRecorder {
  return new ResearchMemoryRunRecorder(options);
}
