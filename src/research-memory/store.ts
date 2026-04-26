export const RESEARCH_MEMORY_STORE_CONTRACT_VERSION = 1;

export type ResearchMemoryJsonPrimitive = string | number | boolean | null;
export type ResearchMemoryJsonValue =
  | ResearchMemoryJsonPrimitive
  | ResearchMemoryJsonObject
  | ResearchMemoryJsonValue[];
export type ResearchMemoryJsonObject = { readonly [key: string]: ResearchMemoryJsonValue };

export type ResearchMemoryRunId = string;
export type ResearchMemorySourceId = string;
export type ResearchMemoryArtifactId = string;
export type ResearchMemoryEventId = string;
export type ResearchMemoryModelRouteId = string;
export type ResearchMemoryFailureId = string;
export type ResearchMemoryNotebookExportId = string;
export type ResearchMemoryTimestampMs = number;

export const RESEARCH_MEMORY_RUN_KINDS = [
  "cli",
  "daemon-summary",
  "daemon-agent",
  "extension-panel",
  "extension-hover",
  "automation",
  "extract-only",
] as const;
export type ResearchMemoryRunKind = (typeof RESEARCH_MEMORY_RUN_KINDS)[number];

export const RESEARCH_MEMORY_RUN_MODES = [
  "url",
  "page",
  "file",
  "media",
  "chat",
  "slides",
  "extract",
] as const;
export type ResearchMemoryRunMode = (typeof RESEARCH_MEMORY_RUN_MODES)[number];

export const RESEARCH_MEMORY_RUN_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type ResearchMemoryRunStatus = (typeof RESEARCH_MEMORY_RUN_STATUSES)[number];

export const RESEARCH_MEMORY_LANGUAGE_BUCKETS = [
  "english",
  "traditionalChinese",
  "bilingual",
  "fallback",
  "none",
] as const;
export type ResearchMemoryLanguageBucket = (typeof RESEARCH_MEMORY_LANGUAGE_BUCKETS)[number];

export type ResearchMemoryPrivacyMode = {
  localOnlyEnabled: boolean;
  localOnlySource: string | null;
  policyResult: "allowed" | "blocked" | "not-applicable";
  allowedTransports: readonly string[];
  protectedData: readonly string[];
  exportState: "not-exported" | "user-exported" | "deleted";
  notes: string | null;
  metadata: ResearchMemoryJsonObject;
};

export type ResearchMemoryRun = {
  id: ResearchMemoryRunId;
  kind: ResearchMemoryRunKind;
  mode: ResearchMemoryRunMode;
  status: ResearchMemoryRunStatus;
  createdAt: ResearchMemoryTimestampMs;
  startedAt: ResearchMemoryTimestampMs | null;
  completedAt: ResearchMemoryTimestampMs | null;
  inputRef: string | null;
  length: string | null;
  languageRaw: string | null;
  languageBucket: ResearchMemoryLanguageBucket | null;
  requestedFormat: string | null;
  summaryArtifactId: ResearchMemoryArtifactId | null;
  metrics: ResearchMemoryJsonObject;
  configFingerprint: string | null;
  privacyMode: ResearchMemoryPrivacyMode;
};

export const RESEARCH_MEMORY_SOURCE_KINDS = [
  "url",
  "visible-page",
  "local-file",
  "youtube",
  "video",
  "audio",
  "pdf",
  "image",
  "manual-text",
] as const;
export type ResearchMemorySourceKind = (typeof RESEARCH_MEMORY_SOURCE_KINDS)[number];

export type ResearchMemorySource = {
  id: ResearchMemorySourceId;
  runId: ResearchMemoryRunId;
  sourceKind: ResearchMemorySourceKind;
  canonicalUrl: string | null;
  urlHash: string | null;
  title: string | null;
  siteName: string | null;
  contentType: string | null;
  languageHint: string | null;
  contentHash: string | null;
  extractedArtifactId: ResearchMemoryArtifactId | null;
  fetchMetadata: ResearchMemoryJsonObject;
  createdAt: ResearchMemoryTimestampMs;
};

export const RESEARCH_MEMORY_ARTIFACT_KINDS = [
  "extracted-text",
  "transcript",
  "rendered-prompt",
  "summary",
  "slide-image",
  "slides-json",
  "ocr-text",
  "chat-log",
  "failure-report",
  "user-note",
  "export",
] as const;
export type ResearchMemoryArtifactKind = (typeof RESEARCH_MEMORY_ARTIFACT_KINDS)[number];

export const RESEARCH_MEMORY_ARTIFACT_PRIVACY_CLASSES = [
  "public-source",
  "user-private",
  "local-file",
  "model-prompt",
  "model-output",
  "diagnostic",
] as const;
export type ResearchMemoryArtifactPrivacyClass =
  (typeof RESEARCH_MEMORY_ARTIFACT_PRIVACY_CLASSES)[number];

export const RESEARCH_MEMORY_ARTIFACT_RETENTIONS = ["keep", "user-delete"] as const;
export type ResearchMemoryArtifactRetention = (typeof RESEARCH_MEMORY_ARTIFACT_RETENTIONS)[number];

export type ResearchMemoryArtifactBase = {
  id: ResearchMemoryArtifactId;
  runId: ResearchMemoryRunId;
  sourceId: ResearchMemorySourceId | null;
  artifactKind: ResearchMemoryArtifactKind;
  mimeType: string | null;
  byteSize: number | null;
  sha256: string | null;
  privacyClass: ResearchMemoryArtifactPrivacyClass;
  retention: ResearchMemoryArtifactRetention;
  metadata: ResearchMemoryJsonObject;
  createdAt: ResearchMemoryTimestampMs;
};

export type ResearchMemoryFileArtifact = ResearchMemoryArtifactBase & {
  storageKind: "file";
  relativePath: string;
  inlineText: null;
  inlineJson: null;
};

export type ResearchMemoryInlineTextArtifact = ResearchMemoryArtifactBase & {
  storageKind: "inline-text";
  relativePath: null;
  inlineText: string;
  inlineJson: null;
};

export type ResearchMemoryInlineJsonArtifact = ResearchMemoryArtifactBase & {
  storageKind: "inline-json";
  relativePath: null;
  inlineText: null;
  inlineJson: ResearchMemoryJsonValue;
};

export type ResearchMemoryArtifact =
  | ResearchMemoryFileArtifact
  | ResearchMemoryInlineTextArtifact
  | ResearchMemoryInlineJsonArtifact;

export const RESEARCH_MEMORY_EVENT_TYPES = [
  "status",
  "model-selected",
  "cache-hit",
  "cache-miss",
  "chunk",
  "slides-status",
  "metrics",
  "warning",
  "error",
  "done",
] as const;
export type ResearchMemoryEventType = (typeof RESEARCH_MEMORY_EVENT_TYPES)[number];

export type ResearchMemoryEvent = {
  id: ResearchMemoryEventId;
  runId: ResearchMemoryRunId;
  sequence: number;
  eventType: ResearchMemoryEventType;
  createdAt: ResearchMemoryTimestampMs;
  payload: ResearchMemoryJsonObject;
  artifactId: ResearchMemoryArtifactId | null;
  visibleToUi: boolean;
};

export const RESEARCH_MEMORY_MODEL_ROUTE_SELECTION_SOURCES = [
  "explicit",
  "env",
  "config",
  "local-routing",
  "auto",
  "fallback",
] as const;
export type ResearchMemoryModelRouteSelectionSource =
  (typeof RESEARCH_MEMORY_MODEL_ROUTE_SELECTION_SOURCES)[number];

export const RESEARCH_MEMORY_LOCAL_RUNTIME_KINDS = [
  "openai-compatible",
  "llama-cpp",
  "ollama",
] as const;
export type ResearchMemoryLocalRuntimeKind = (typeof RESEARCH_MEMORY_LOCAL_RUNTIME_KINDS)[number];

export const RESEARCH_MEMORY_BASE_URL_SOURCES = ["configured", "default"] as const;
export type ResearchMemoryBaseUrlSource = (typeof RESEARCH_MEMORY_BASE_URL_SOURCES)[number];

export const RESEARCH_MEMORY_ROUTE_PROBE_STATUSES = [
  "not-run",
  "reachable",
  "unreachable",
  "invalid",
] as const;
export type ResearchMemoryRouteProbeStatus = (typeof RESEARCH_MEMORY_ROUTE_PROBE_STATUSES)[number];

export type ResearchMemoryModelRoute = {
  id: ResearchMemoryModelRouteId;
  runId: ResearchMemoryRunId;
  attemptIndex: number;
  requestedModelInput: string | null;
  selectionSource: ResearchMemoryModelRouteSelectionSource;
  languageBucket: ResearchMemoryLanguageBucket;
  selectedModelId: string | null;
  providerKind: string | null;
  localRuntimeKind: ResearchMemoryLocalRuntimeKind | null;
  endpointHost: string | null;
  baseUrlSource: ResearchMemoryBaseUrlSource | null;
  probeStatus: ResearchMemoryRouteProbeStatus;
  localOnlyAllowed: boolean;
  blockedReason: string | null;
  metadata: ResearchMemoryJsonObject;
  createdAt: ResearchMemoryTimestampMs;
};

export const RESEARCH_MEMORY_FAILURE_STAGES = [
  "input",
  "extract",
  "transcript",
  "slides",
  "prompt",
  "route",
  "local-only",
  "model",
  "cache",
  "storage",
  "notebook-export",
  "unknown",
] as const;
export type ResearchMemoryFailureStage = (typeof RESEARCH_MEMORY_FAILURE_STAGES)[number];

export type ResearchMemoryFailure = {
  id: ResearchMemoryFailureId;
  runId: ResearchMemoryRunId;
  sourceId: ResearchMemorySourceId | null;
  routeId: ResearchMemoryModelRouteId | null;
  failureStage: ResearchMemoryFailureStage;
  errorCode: string | null;
  message: string;
  stackArtifactId: ResearchMemoryArtifactId | null;
  retryable: boolean | null;
  createdAt: ResearchMemoryTimestampMs;
  sanitized: boolean;
  metadata: ResearchMemoryJsonObject;
};

export const RESEARCH_MEMORY_NOTEBOOK_EXPORT_PROVIDERS = ["notebooklm"] as const;
export type ResearchMemoryNotebookExportProvider =
  (typeof RESEARCH_MEMORY_NOTEBOOK_EXPORT_PROVIDERS)[number];

export const RESEARCH_MEMORY_NOTEBOOK_EXPORT_STATUSES = [
  "pending",
  "markdown-exported",
  "source-added",
  "audio-generating",
  "audio-ready",
  "failed",
] as const;
export type ResearchMemoryNotebookExportStatus =
  (typeof RESEARCH_MEMORY_NOTEBOOK_EXPORT_STATUSES)[number];

export type ResearchMemoryNotebookExport = {
  id: ResearchMemoryNotebookExportId;
  runId: ResearchMemoryRunId;
  provider: ResearchMemoryNotebookExportProvider;
  status: ResearchMemoryNotebookExportStatus;
  notebookId: string | null;
  notebookTitle: string | null;
  notebookUrl: string | null;
  sourceArtifactId: ResearchMemoryArtifactId | null;
  exportArtifactId: ResearchMemoryArtifactId | null;
  audioArtifactId: ResearchMemoryArtifactId | null;
  languageRaw: string | null;
  outputFormat: string | null;
  createdAt: ResearchMemoryTimestampMs;
  updatedAt: ResearchMemoryTimestampMs;
  metadata: ResearchMemoryJsonObject;
};

export type ResearchMemoryRunSnapshot = {
  run: ResearchMemoryRun;
  sources: readonly ResearchMemorySource[];
  artifacts: readonly ResearchMemoryArtifact[];
  events: readonly ResearchMemoryEvent[];
  modelRoutes: readonly ResearchMemoryModelRoute[];
  failures: readonly ResearchMemoryFailure[];
  notebookExports: readonly ResearchMemoryNotebookExport[];
};

export type ResearchMemoryListRunsOptions = {
  status?: ResearchMemoryRunStatus;
  kind?: ResearchMemoryRunKind;
  order?: "asc" | "desc";
  limit?: number;
};

export interface ResearchMemoryStore {
  initialize(): Promise<void>;
  createRun(run: ResearchMemoryRun): Promise<ResearchMemoryRun>;
  updateRun(run: ResearchMemoryRun): Promise<ResearchMemoryRun>;
  upsertSource(source: ResearchMemorySource): Promise<ResearchMemorySource>;
  addArtifact(artifact: ResearchMemoryArtifact): Promise<ResearchMemoryArtifact>;
  addEvent(event: ResearchMemoryEvent): Promise<ResearchMemoryEvent>;
  addModelRoute(route: ResearchMemoryModelRoute): Promise<ResearchMemoryModelRoute>;
  addFailure(failure: ResearchMemoryFailure): Promise<ResearchMemoryFailure>;
  addNotebookExport(
    notebookExport: ResearchMemoryNotebookExport,
  ): Promise<ResearchMemoryNotebookExport>;
  getRun(runId: ResearchMemoryRunId): Promise<ResearchMemoryRunSnapshot | null>;
  listRuns(options?: ResearchMemoryListRunsOptions): Promise<readonly ResearchMemoryRun[]>;
  close(): Promise<void>;
}
