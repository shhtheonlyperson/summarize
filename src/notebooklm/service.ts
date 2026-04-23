import type { ChildProcess, ExecFileException, ExecFileOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { execFileTracked } from "../processes.js";
import type {
  ResearchMemoryArtifactId,
  ResearchMemoryJsonObject,
  ResearchMemoryJsonValue,
  ResearchMemoryNotebookExport,
  ResearchMemoryNotebookExportStatus,
  ResearchMemoryRunId,
  ResearchMemoryStore,
} from "../research-memory/store.js";

export const DEFAULT_NOTEBOOKLM_EXECUTABLE = "notebooklm";
export const DEFAULT_NOTEBOOKLM_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_NOTEBOOKLM_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
export const DEFAULT_NOTEBOOKLM_AUDIO_FORMAT = "deep-dive";

const NOTEBOOKLM_AUDIO_FORMATS = ["deep-dive", "brief", "critique", "debate"] as const;
const NOTEBOOKLM_AUDIO_LENGTHS = ["short", "default", "long"] as const;

export type NotebookLmCliErrorCode =
  | "NOTEBOOKLM_COMMAND_FAILED"
  | "NOTEBOOKLM_COMMAND_TIMED_OUT"
  | "NOTEBOOKLM_EMPTY_JSON"
  | "NOTEBOOKLM_JSON_PARSE_FAILED"
  | "NOTEBOOKLM_UNEXPECTED_JSON";

type ExecFileCallback = (
  error: ExecFileException | null,
  stdout: string | Buffer,
  stderr: string | Buffer,
) => void;

export type NotebookLmExecFileFn = (
  file: string,
  args: string[],
  options: ExecFileOptions,
  callback: ExecFileCallback,
) => ChildProcess;

export type NotebookLmServiceOptions = {
  executable?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  cwd?: string;
  env?: Record<string, string | undefined>;
  execFileImpl?: NotebookLmExecFileFn;
  now?: () => number;
  createId?: () => string;
};

export type NotebookLmNotebook = {
  id: string;
  title: string | null;
  url: string | null;
  rawJson: unknown;
};

export type NotebookLmSource = {
  id: string;
  title: string | null;
  status: string | null;
  url: string | null;
  rawJson: unknown;
};

export type NotebookLmAudioArtifact = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  url: string | null;
  rawJson: unknown;
};

export type NotebookLmAudioDownload = {
  artifactId: string;
  outputPath: string;
  byteSize: number | null;
  rawJson: unknown;
};

export type NotebookLmAddMarkdownSourceOptions = {
  notebookId: string;
  title: string;
  markdownPath?: string;
  markdown?: string;
};

export type NotebookLmGenerateAudioOptions = {
  notebookId: string;
  format?: string;
  length?: string | null;
  language?: string | null;
  description?: string | null;
};

export type NotebookLmDownloadAudioOptions = {
  notebookId: string;
  artifactId: string;
  outputPath: string;
};

export type NotebookLmNotebookSelection =
  | {
      id: string;
      title?: string | null;
      url?: string | null;
    }
  | {
      title: string;
    };

export type NotebookLmMarkdownPodcastOptions = {
  notebook: NotebookLmNotebookSelection;
  source:
    | NotebookLmAddMarkdownSourceOptions
    | Omit<NotebookLmAddMarkdownSourceOptions, "notebookId">;
  audio?: {
    format?: string;
    length?: string | null;
    language?: string | null;
    description?: string | null;
    outputPath?: string | null;
    waitForReady?: boolean;
  };
  waitForSource?: boolean;
  store?: ResearchMemoryStore | null;
  runId?: ResearchMemoryRunId | null;
  notebookExportId?: string;
  sourceArtifactId?: ResearchMemoryArtifactId | null;
  exportArtifactId?: ResearchMemoryArtifactId | null;
  audioArtifactId?: ResearchMemoryArtifactId | null;
  languageRaw?: string | null;
  outputFormat?: string | null;
  metadata?: ResearchMemoryJsonObject;
};

export type NotebookLmMarkdownPodcastResult = {
  notebook: NotebookLmNotebook;
  source: NotebookLmSource;
  audioArtifact: NotebookLmAudioArtifact;
  download: NotebookLmAudioDownload | null;
  notebookExport: ResearchMemoryNotebookExport | null;
};

export type NotebookLmNotebookExportRecordInput = {
  store?: ResearchMemoryStore | null;
  runId?: ResearchMemoryRunId | null;
  id?: string;
  status: ResearchMemoryNotebookExportStatus;
  notebook: Pick<NotebookLmNotebook, "id" | "title" | "url"> | null;
  source?: Pick<NotebookLmSource, "id" | "title" | "status" | "url"> | null;
  audioArtifact?: Pick<NotebookLmAudioArtifact, "id" | "title" | "type" | "status" | "url"> | null;
  download?: Pick<NotebookLmAudioDownload, "artifactId" | "byteSize"> | null;
  sourceArtifactId?: ResearchMemoryArtifactId | null;
  exportArtifactId?: ResearchMemoryArtifactId | null;
  audioArtifactId?: ResearchMemoryArtifactId | null;
  languageRaw?: string | null;
  outputFormat?: string | null;
  metadata?: ResearchMemoryJsonObject;
};

type NotebookLmCommandResult = {
  stdout: string;
  stderr: string;
};

type UnknownRecord = Record<string, unknown>;

export class NotebookLmCliError extends Error {
  readonly errorCode: NotebookLmCliErrorCode;
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: string | number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor({
    message,
    errorCode,
    command,
    args,
    exitCode = null,
    signal = null,
    stdout = "",
    stderr = "",
    cause,
  }: {
    message: string;
    errorCode: NotebookLmCliErrorCode;
    command: string;
    args: readonly string[];
    exitCode?: string | number | null;
    signal?: NodeJS.Signals | null;
    stdout?: string;
    stderr?: string;
    cause?: unknown;
  }) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "NotebookLmCliError";
    this.errorCode = errorCode;
    this.command = command;
    this.args = Array.from(args);
    this.exitCode = exitCode;
    this.signal = signal;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class NotebookLmJsonError extends NotebookLmCliError {
  constructor(options: ConstructorParameters<typeof NotebookLmCliError>[0]) {
    super(options);
    this.name = "NotebookLmJsonError";
  }
}

function toText(value: string | Buffer): string {
  return typeof value === "string" ? value : value.toString("utf8");
}

function normalizeExecutable(raw: string | undefined): string {
  const executable = raw?.trim() || DEFAULT_NOTEBOOKLM_EXECUTABLE;
  return executable;
}

function normalizeTimeoutMs(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_NOTEBOOKLM_TIMEOUT_MS;
  }
  return Math.trunc(raw);
}

function normalizeMaxBufferBytes(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_NOTEBOOKLM_MAX_BUFFER_BYTES;
  }
  return Math.trunc(raw);
}

function commandLabel(command: string, args: readonly string[]): string {
  return [command, ...args.slice(0, 3), args.length > 3 ? `...(${args.length} args)` : ""]
    .filter(Boolean)
    .join(" ");
}

function errorCodeFromExecError(error: ExecFileException): NotebookLmCliErrorCode {
  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  if (code === "ETIMEDOUT") return "NOTEBOOKLM_COMMAND_TIMED_OUT";
  if (error.killed && error.signal === "SIGTERM") return "NOTEBOOKLM_COMMAND_TIMED_OUT";
  return "NOTEBOOKLM_COMMAND_FAILED";
}

function messageFromExecError({
  error,
  command,
  args,
  stderr,
}: {
  error: ExecFileException;
  command: string;
  args: readonly string[];
  stderr: string;
}): string {
  const prefix =
    errorCodeFromExecError(error) === "NOTEBOOKLM_COMMAND_TIMED_OUT"
      ? "NotebookLM CLI command timed out"
      : "NotebookLM CLI command failed";
  const stderrText = stderr.trim();
  const detail = stderrText || error.message;
  return `${prefix}: ${commandLabel(command, args)}${detail ? `: ${detail}` : ""}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getNestedRecord(payload: unknown, keys: readonly string[]): UnknownRecord {
  if (!isRecord(payload)) return {};
  for (const key of keys) {
    const nested = payload[key];
    if (isRecord(nested)) return nested;
  }
  return payload;
}

function readString(record: UnknownRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(record: UnknownRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function requireStringFromPayload({
  payload,
  record,
  keys,
  entity,
  command,
  args,
  stdout,
  stderr,
}: {
  payload: unknown;
  record: UnknownRecord;
  keys: readonly string[];
  entity: string;
  command: string;
  args: readonly string[];
  stdout: string;
  stderr: string;
}): string {
  const value = readString(record, keys);
  if (value) return value;
  throw new NotebookLmJsonError({
    message: `NotebookLM ${entity} JSON did not include an id.`,
    errorCode: "NOTEBOOKLM_UNEXPECTED_JSON",
    command,
    args,
    stdout,
    stderr,
    cause: payload,
  });
}

function parseJsonOutput({
  stdout,
  stderr,
  command,
  args,
}: {
  stdout: string;
  stderr: string;
  command: string;
  args: readonly string[];
}): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new NotebookLmJsonError({
      message: `NotebookLM CLI returned empty JSON output: ${commandLabel(command, args)}`,
      errorCode: "NOTEBOOKLM_EMPTY_JSON",
      command,
      args,
      stdout,
      stderr,
    });
  }

  const candidates = [
    trimmed,
    ...trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") || line.startsWith("["))
      .reverse(),
  ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  throw new NotebookLmJsonError({
    message: `NotebookLM CLI returned invalid JSON output: ${commandLabel(command, args)}`,
    errorCode: "NOTEBOOKLM_JSON_PARSE_FAILED",
    command,
    args,
    stdout,
    stderr,
    cause: lastError,
  });
}

function parseNotebook(
  payload: unknown,
  command: string,
  args: readonly string[],
  stdout: string,
  stderr: string,
): NotebookLmNotebook {
  const record = getNestedRecord(payload, ["notebook", "result"]);
  const id = requireStringFromPayload({
    payload,
    record,
    keys: ["id", "notebookId", "notebook_id"],
    entity: "notebook",
    command,
    args,
    stdout,
    stderr,
  });
  return {
    id,
    title: readString(record, ["title", "name", "notebookTitle", "notebook_title"]),
    url: readString(record, ["url", "notebookUrl", "notebook_url", "shareUrl", "share_url"]),
    rawJson: payload,
  };
}

function parseSource(
  payload: unknown,
  command: string,
  args: readonly string[],
  stdout: string,
  stderr: string,
): NotebookLmSource {
  const record = getNestedRecord(payload, ["source", "result"]);
  const id = requireStringFromPayload({
    payload,
    record,
    keys: ["id", "sourceId", "source_id"],
    entity: "source",
    command,
    args,
    stdout,
    stderr,
  });
  return {
    id,
    title: readString(record, ["title", "name", "sourceTitle", "source_title"]),
    status: readString(record, ["status", "state"]),
    url: readString(record, ["url", "sourceUrl", "source_url"]),
    rawJson: payload,
  };
}

function parseAudioArtifact(
  payload: unknown,
  command: string,
  args: readonly string[],
  stdout: string,
  stderr: string,
): NotebookLmAudioArtifact {
  const record = getNestedRecord(payload, ["artifact", "audio", "audioOverview", "result"]);
  const id = requireStringFromPayload({
    payload,
    record,
    keys: ["id", "artifactId", "artifact_id", "taskId", "task_id", "audioId", "audio_id"],
    entity: "audio artifact",
    command,
    args,
    stdout,
    stderr,
  });
  return {
    id,
    title: readString(record, ["title", "name"]),
    type: readString(record, ["type", "artifactType", "artifact_type"]),
    status: readString(record, ["status", "state"]),
    url: readString(record, ["url", "artifactUrl", "artifact_url", "downloadUrl", "download_url"]),
    rawJson: payload,
  };
}

function parseAudioDownload(
  payload: unknown,
  artifactId: string,
  command: string,
  args: readonly string[],
  stdout: string,
  stderr: string,
): NotebookLmAudioDownload {
  const record = getNestedRecord(payload, ["download", "file", "result"]);
  const outputPath = readString(record, [
    "path",
    "outputPath",
    "output_path",
    "filePath",
    "file_path",
  ]);
  if (!outputPath) {
    throw new NotebookLmJsonError({
      message: "NotebookLM download JSON did not include an output path.",
      errorCode: "NOTEBOOKLM_UNEXPECTED_JSON",
      command,
      args,
      stdout,
      stderr,
      cause: payload,
    });
  }
  return {
    artifactId: readString(record, ["artifactId", "artifact_id", "id"]) ?? artifactId,
    outputPath,
    byteSize: readNumber(record, ["byteSize", "byte_size", "bytes", "size"]),
    rawJson: payload,
  };
}

function parseAudioArtifactList(
  payload: unknown,
  command: string,
  args: readonly string[],
  stdout: string,
  stderr: string,
): NotebookLmAudioArtifact[] {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.artifacts)
      ? payload.artifacts
      : isRecord(payload) && Array.isArray(payload.audio)
        ? payload.audio
        : null;
  if (!list) {
    throw new NotebookLmJsonError({
      message: "NotebookLM artifact list JSON did not include an artifact array.",
      errorCode: "NOTEBOOKLM_UNEXPECTED_JSON",
      command,
      args,
      stdout,
      stderr,
      cause: payload,
    });
  }
  return list.map((item) => parseAudioArtifact(item, command, args, stdout, stderr));
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty.`);
  return trimmed;
}

function normalizeAudioFormat(raw: string | null | undefined): string {
  const value = raw?.trim() || DEFAULT_NOTEBOOKLM_AUDIO_FORMAT;
  const normalized = value.toLowerCase();
  const aliased =
    normalized === "audio" || normalized === "mp3" ? DEFAULT_NOTEBOOKLM_AUDIO_FORMAT : normalized;
  if ((NOTEBOOKLM_AUDIO_FORMATS as readonly string[]).includes(aliased)) return aliased;
  throw new Error(
    `NotebookLM audio format must be one of: ${NOTEBOOKLM_AUDIO_FORMATS.join(", ")}.`,
  );
}

function normalizeAudioLength(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const normalized = value.toLowerCase();
  const aliased = normalized === "medium" ? "default" : normalized === "xl" ? "long" : normalized;
  if ((NOTEBOOKLM_AUDIO_LENGTHS as readonly string[]).includes(aliased)) return aliased;
  throw new Error(
    `NotebookLM audio length must be one of: ${NOTEBOOKLM_AUDIO_LENGTHS.join(", ")}.`,
  );
}

function normalizeNotebookLmLanguage(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.toLowerCase() === "auto") return null;
  const aliases: Record<string, string> = {
    english: "en",
    "traditional-chinese": "zh_Hant",
    traditional_chinese: "zh_Hant",
    "zh-tw": "zh_Hant",
    zh_tw: "zh_Hant",
    "zh-hant": "zh_Hant",
    zh_hant: "zh_Hant",
    "zh-cn": "zh_Hans",
    zh_cn: "zh_Hans",
    "zh-hans": "zh_Hans",
    zh_hans: "zh_Hans",
  };
  return aliases[value.toLowerCase()] ?? value;
}

function markdownInput(options: NotebookLmAddMarkdownSourceOptions): string {
  const hasPath = typeof options.markdownPath === "string" && options.markdownPath.trim() !== "";
  const hasMarkdown = typeof options.markdown === "string" && options.markdown.trim() !== "";
  if (hasPath === hasMarkdown) {
    throw new Error("Provide exactly one of markdownPath or markdown.");
  }
  return hasPath ? options.markdownPath!.trim() : options.markdown!;
}

function asJsonValue(value: string | number | boolean | null): ResearchMemoryJsonValue {
  return value;
}

function compactJsonObject(
  values: Record<string, ResearchMemoryJsonValue | undefined>,
): ResearchMemoryJsonObject {
  const out: Record<string, ResearchMemoryJsonValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "undefined") out[key] = value;
  }
  return out;
}

function objectToJsonValue(value: ResearchMemoryJsonObject): ResearchMemoryJsonValue {
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNotebookById(selection: NotebookLmNotebookSelection): selection is {
  id: string;
  title?: string | null;
  url?: string | null;
} {
  return "id" in selection;
}

export class NotebookLmService {
  private readonly executable: string;
  private readonly timeoutMs: number;
  private readonly maxBufferBytes: number;
  private readonly cwd: string | undefined;
  private readonly env: Record<string, string | undefined>;
  private readonly execFileImpl: NotebookLmExecFileFn;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(options: NotebookLmServiceOptions = {}) {
    this.executable = normalizeExecutable(options.executable);
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    this.maxBufferBytes = normalizeMaxBufferBytes(options.maxBufferBytes);
    this.cwd = options.cwd;
    this.env = options.env ?? {};
    this.execFileImpl = options.execFileImpl ?? (execFileTracked as NotebookLmExecFileFn);
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? (() => `notebook-export-${randomUUID()}`);
  }

  async createNotebook({ title }: { title: string }): Promise<NotebookLmNotebook> {
    const args = ["create", "--json", nonEmpty(title, "title")];
    const result = await this.runJson(args);
    return parseNotebook(result.payload, this.executable, args, result.stdout, result.stderr);
  }

  async useNotebook({
    notebookId,
    title = null,
    url = null,
  }: {
    notebookId: string;
    title?: string | null;
    url?: string | null;
  }): Promise<NotebookLmNotebook> {
    const id = nonEmpty(notebookId, "notebookId");
    await this.run(["use", id]);
    return { id, title, url, rawJson: null };
  }

  async addMarkdownSource(options: NotebookLmAddMarkdownSourceOptions): Promise<NotebookLmSource> {
    const input = markdownInput(options);
    const args = [
      "source",
      "add",
      "--notebook",
      nonEmpty(options.notebookId, "notebookId"),
      "--type",
      options.markdownPath ? "file" : "text",
    ];
    if (options.markdownPath) {
      args.push("--mime-type", "text/markdown");
    }
    args.push("--title", nonEmpty(options.title, "title"), "--json", input);
    const result = await this.runJson(args);
    return parseSource(result.payload, this.executable, args, result.stdout, result.stderr);
  }

  async waitForSource({
    notebookId,
    sourceId,
  }: {
    notebookId: string;
    sourceId: string;
  }): Promise<NotebookLmSource> {
    const args = [
      "source",
      "wait",
      "--notebook",
      nonEmpty(notebookId, "notebookId"),
      "--json",
      nonEmpty(sourceId, "sourceId"),
    ];
    const result = await this.runJson(args);
    return parseSource(result.payload, this.executable, args, result.stdout, result.stderr);
  }

  async generateAudioOverview(
    options: NotebookLmGenerateAudioOptions,
  ): Promise<NotebookLmAudioArtifact> {
    const length = normalizeAudioLength(options.length);
    const language = normalizeNotebookLmLanguage(options.language);
    const args = [
      "generate",
      "audio",
      "--notebook",
      nonEmpty(options.notebookId, "notebookId"),
      "--format",
      normalizeAudioFormat(options.format),
    ];
    if (length) args.push("--length", length);
    if (language) args.push("--language", language);
    args.push("--json");
    if (options.description && options.description.trim()) args.push(options.description);
    const result = await this.runJson(args);
    return parseAudioArtifact(result.payload, this.executable, args, result.stdout, result.stderr);
  }

  async waitForAudioArtifact({
    notebookId,
    artifactId,
  }: {
    notebookId: string;
    artifactId: string;
  }): Promise<NotebookLmAudioArtifact> {
    const args = [
      "artifact",
      "wait",
      "--notebook",
      nonEmpty(notebookId, "notebookId"),
      "--json",
      nonEmpty(artifactId, "artifactId"),
    ];
    const result = await this.runJson(args);
    return parseAudioArtifact(result.payload, this.executable, args, result.stdout, result.stderr);
  }

  async listAudioArtifacts({
    notebookId,
  }: {
    notebookId: string;
  }): Promise<NotebookLmAudioArtifact[]> {
    const args = [
      "artifact",
      "list",
      "--notebook",
      nonEmpty(notebookId, "notebookId"),
      "--type",
      "audio",
      "--json",
    ];
    const result = await this.runJson(args);
    return parseAudioArtifactList(
      result.payload,
      this.executable,
      args,
      result.stdout,
      result.stderr,
    );
  }

  async downloadAudio(options: NotebookLmDownloadAudioOptions): Promise<NotebookLmAudioDownload> {
    const artifactId = nonEmpty(options.artifactId, "artifactId");
    const args = [
      "download",
      "audio",
      "--notebook",
      nonEmpty(options.notebookId, "notebookId"),
      "--artifact",
      artifactId,
      "--json",
      nonEmpty(options.outputPath, "outputPath"),
    ];
    const result = await this.runJson(args);
    return parseAudioDownload(
      result.payload,
      artifactId,
      this.executable,
      args,
      result.stdout,
      result.stderr,
    );
  }

  async createPodcastFromMarkdownBundle(
    options: NotebookLmMarkdownPodcastOptions,
  ): Promise<NotebookLmMarkdownPodcastResult> {
    let notebook: NotebookLmNotebook | null = null;
    let source: NotebookLmSource | null = null;
    let audioArtifact: NotebookLmAudioArtifact | null = null;
    let download: NotebookLmAudioDownload | null = null;
    const audioOptions = options.audio ?? {};
    const audioFormat = normalizeAudioFormat(audioOptions.format);
    const audioLength = normalizeAudioLength(audioOptions.length);
    const audioLanguage = normalizeNotebookLmLanguage(audioOptions.language);

    try {
      notebook = isNotebookById(options.notebook)
        ? await this.useNotebook({
            notebookId: options.notebook.id,
            title: options.notebook.title ?? null,
            url: options.notebook.url ?? null,
          })
        : await this.createNotebook({ title: options.notebook.title });

      source = await this.addMarkdownSource({
        ...options.source,
        notebookId: notebook.id,
      });
      if (options.waitForSource !== false) {
        source = await this.waitForSource({ notebookId: notebook.id, sourceId: source.id });
      }

      audioArtifact = await this.generateAudioOverview({
        notebookId: notebook.id,
        format: audioFormat,
        length: audioLength,
        language: audioLanguage,
        description: audioOptions.description ?? null,
      });
      if (audioOptions.waitForReady !== false) {
        audioArtifact = await this.waitForAudioArtifact({
          notebookId: notebook.id,
          artifactId: audioArtifact.id,
        });
      }

      if (audioOptions.outputPath) {
        download = await this.downloadAudio({
          notebookId: notebook.id,
          artifactId: audioArtifact.id,
          outputPath: audioOptions.outputPath,
        });
      }

      const notebookExport = await this.recordNotebookExport({
        store: options.store,
        runId: options.runId,
        id: options.notebookExportId,
        status: audioOptions.waitForReady === false ? "audio-generating" : "audio-ready",
        notebook,
        source,
        audioArtifact,
        download,
        sourceArtifactId: options.sourceArtifactId ?? null,
        exportArtifactId: options.exportArtifactId ?? null,
        audioArtifactId: options.audioArtifactId ?? null,
        languageRaw: options.languageRaw ?? null,
        outputFormat: options.outputFormat ?? audioFormat,
        metadata: options.metadata,
      });

      return { notebook, source, audioArtifact, download, notebookExport };
    } catch (error) {
      if (options.store || options.runId) {
        await this.recordFailedNotebookExport({
          options,
          notebook,
          source,
          audioArtifact,
          download,
          audioFormat,
          error,
        });
      }
      throw error;
    }
  }

  async recordNotebookExport(
    input: NotebookLmNotebookExportRecordInput,
  ): Promise<ResearchMemoryNotebookExport | null> {
    if (!input.store && !input.runId) return null;
    if (!input.store || !input.runId) {
      throw new Error("NotebookLM export persistence requires both store and runId.");
    }

    const now = this.now();
    const metadata = this.buildNotebookExportMetadata(input);
    return await input.store.addNotebookExport({
      id: input.id ?? this.createId(),
      runId: input.runId,
      provider: "notebooklm",
      status: input.status,
      notebookId: input.notebook?.id ?? null,
      notebookTitle: input.notebook?.title ?? null,
      notebookUrl: input.notebook?.url ?? null,
      sourceArtifactId: input.sourceArtifactId ?? null,
      exportArtifactId: input.exportArtifactId ?? null,
      audioArtifactId: input.audioArtifactId ?? null,
      languageRaw: input.languageRaw ?? null,
      outputFormat: input.outputFormat ?? null,
      createdAt: now,
      updatedAt: now,
      metadata,
    });
  }

  private async run(args: string[]): Promise<NotebookLmCommandResult> {
    return await new Promise((resolve, reject) => {
      try {
        this.execFileImpl(
          this.executable,
          args,
          {
            cwd: this.cwd,
            timeout: this.timeoutMs,
            maxBuffer: this.maxBufferBytes,
            env: { ...process.env, ...this.env },
          },
          (error, stdoutValue, stderrValue) => {
            const stdout = toText(stdoutValue);
            const stderr = toText(stderrValue);
            if (error) {
              reject(
                new NotebookLmCliError({
                  message: messageFromExecError({
                    error,
                    command: this.executable,
                    args,
                    stderr,
                  }),
                  errorCode: errorCodeFromExecError(error),
                  command: this.executable,
                  args,
                  exitCode: error.code ?? null,
                  signal: error.signal ?? null,
                  stdout,
                  stderr,
                  cause: error,
                }),
              );
              return;
            }
            resolve({ stdout, stderr });
          },
        );
      } catch (error) {
        reject(
          new NotebookLmCliError({
            message: `NotebookLM CLI command failed to start: ${commandLabel(this.executable, args)}: ${errorMessage(error)}`,
            errorCode: "NOTEBOOKLM_COMMAND_FAILED",
            command: this.executable,
            args,
            cause: error,
          }),
        );
      }
    });
  }

  private async runJson(args: string[]): Promise<NotebookLmCommandResult & { payload: unknown }> {
    const result = await this.run(args);
    return {
      ...result,
      payload: parseJsonOutput({
        stdout: result.stdout,
        stderr: result.stderr,
        command: this.executable,
        args,
      }),
    };
  }

  private buildNotebookExportMetadata(
    input: NotebookLmNotebookExportRecordInput,
  ): ResearchMemoryJsonObject {
    const notebooklm = compactJsonObject({
      sourceId: input.source?.id ? asJsonValue(input.source.id) : undefined,
      sourceTitle: input.source?.title ? asJsonValue(input.source.title) : undefined,
      sourceStatus: input.source?.status ? asJsonValue(input.source.status) : undefined,
      sourceUrl: input.source?.url ? asJsonValue(input.source.url) : undefined,
      audioArtifactNotebookLmId: input.audioArtifact?.id
        ? asJsonValue(input.audioArtifact.id)
        : undefined,
      audioArtifactTitle: input.audioArtifact?.title
        ? asJsonValue(input.audioArtifact.title)
        : undefined,
      audioArtifactType: input.audioArtifact?.type
        ? asJsonValue(input.audioArtifact.type)
        : undefined,
      audioArtifactStatus: input.audioArtifact?.status
        ? asJsonValue(input.audioArtifact.status)
        : undefined,
      audioArtifactUrl: input.audioArtifact?.url ? asJsonValue(input.audioArtifact.url) : undefined,
      downloaded: input.download ? true : undefined,
      downloadArtifactNotebookLmId: input.download?.artifactId
        ? asJsonValue(input.download.artifactId)
        : undefined,
      downloadByteSize:
        typeof input.download?.byteSize === "number"
          ? asJsonValue(input.download.byteSize)
          : undefined,
      executable: asJsonValue(this.executable),
    });
    return {
      ...(input.metadata ?? {}),
      notebooklm: objectToJsonValue(notebooklm),
    };
  }

  private async recordFailedNotebookExport({
    options,
    notebook,
    source,
    audioArtifact,
    download,
    audioFormat,
    error,
  }: {
    options: NotebookLmMarkdownPodcastOptions;
    notebook: NotebookLmNotebook | null;
    source: NotebookLmSource | null;
    audioArtifact: NotebookLmAudioArtifact | null;
    download: NotebookLmAudioDownload | null;
    audioFormat: string;
    error: unknown;
  }): Promise<void> {
    try {
      await this.recordNotebookExport({
        store: options.store,
        runId: options.runId,
        id: options.notebookExportId,
        status: "failed",
        notebook,
        source,
        audioArtifact,
        download,
        sourceArtifactId: options.sourceArtifactId ?? null,
        exportArtifactId: options.exportArtifactId ?? null,
        audioArtifactId: options.audioArtifactId ?? null,
        languageRaw: options.languageRaw ?? null,
        outputFormat: options.outputFormat ?? audioFormat,
        metadata: {
          ...(options.metadata ?? {}),
          failure: objectToJsonValue(
            compactJsonObject({ message: asJsonValue(errorMessage(error)) }),
          ),
        },
      });
    } catch {
      // Preserve the original NotebookLM failure. Persistence errors are visible on successful paths.
    }
  }
}

export function createNotebookLmService(options: NotebookLmServiceOptions = {}): NotebookLmService {
  return new NotebookLmService(options);
}
