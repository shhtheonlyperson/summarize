import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";
import { loadSummarizeConfig } from "../config.js";
import type { ExecFileFn } from "../markitdown.js";
import {
  DEFAULT_NOTEBOOKLM_AUDIO_FORMAT,
  createNotebookLmService,
  type NotebookLmMarkdownPodcastOptions,
  type NotebookLmMarkdownPodcastResult,
  type NotebookLmService,
} from "../notebooklm/index.js";
import {
  createResearchMemoryStoreFromConfig,
  type ResearchMemoryStoreFactoryResult,
} from "../research-memory/factory.js";
import { sanitizeJsonObject, sanitizeUrlForResearchMemory } from "../research-memory/lifecycle.js";
import type {
  ResearchMemoryArtifact,
  ResearchMemoryJsonObject,
  ResearchMemoryRun,
  ResearchMemoryRunSnapshot,
  ResearchMemoryStore,
} from "../research-memory/store.js";
import { buildPodcastHelp } from "./help.js";
import {
  buildNotebookLmMarkdownBundle,
  formatUnavailableMemoryStore,
  parseExportLanguage,
  selectExportLanguage,
  type ExportLanguage,
  type MemoryCliDeps,
} from "./memory-cli.js";

type PodcastCliContext = {
  normalizedArgv: string[];
  envForRun: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  execFileImpl?: ExecFileFn;
};

type PodcastCreateOptions = {
  target: string;
  targetUrl: string | null;
  language: ExportLanguage | "auto";
  languageRaw: string | null;
  format: string;
  length: string | null;
  output: string | null;
  wait: boolean;
  json: boolean;
};

type PodcastStoreState = {
  result: ResearchMemoryStoreFactoryResult;
};

export type PodcastRunSummarizeOptions = {
  argv: string[];
  envForRun: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  execFileImpl?: ExecFileFn;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
};

export type PodcastNotebookLmService = Pick<NotebookLmService, "createPodcastFromMarkdownBundle">;

export type PodcastCliDeps = MemoryCliDeps & {
  createNotebookLmService?: () => PodcastNotebookLmService;
  runSummarize?: (options: PodcastRunSummarizeOptions) => Promise<void>;
  copyFile?: typeof copyFile;
  now?: () => number;
  createId?: () => string;
};

type OpenPodcastStore = {
  store: ResearchMemoryStore;
  artifactRoot: string;
  close: () => Promise<void>;
};

type MarkdownArtifactResult = {
  artifact: ResearchMemoryArtifact;
  path: string;
};

type AudioPlan = {
  artifact: ResearchMemoryArtifact;
  requestedOutputPath: string;
  downloadOutputPath: string;
  copyToRequestedOutput: boolean;
};

const PODCAST_VALUE_OPTIONS = ["--language", "--lang", "--format", "--length", "--output", "-o"];
const PODCAST_AUDIO_FORMATS = ["deep-dive", "brief", "critique", "debate"] as const;

function hasArg(argv: readonly string[], name: string): boolean {
  return argv.includes(name) || argv.some((arg) => arg.startsWith(`${name}=`));
}

function wantsHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h") || argv.includes("help");
}

function readArgValue(argv: readonly string[], names: readonly string[]): string | null {
  for (const name of names) {
    const eq = argv.find((arg) => arg.startsWith(`${name}=`));
    if (eq) {
      const value = eq.slice(`${name}=`.length).trim();
      if (!value) throw new Error(`Missing value for ${name}`);
      return value;
    }
    const index = argv.indexOf(name);
    if (index === -1) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith("-")) throw new Error(`Missing value for ${name}`);
    return next.trim();
  }
  return null;
}

function parsePositionals(argv: readonly string[], valueOptions: readonly string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const name = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
      if (valueOptions.includes(name) && !arg.includes("=")) index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      if (valueOptions.includes(arg)) index += 1;
      continue;
    }
    if (arg !== "help") out.push(arg);
  }
  return out;
}

function parseWait(argv: readonly string[]): boolean {
  const noWait = hasArg(argv, "--no-wait");
  const waitFalse = argv.includes("--wait=false");
  const waitTrue = argv.includes("--wait") || argv.includes("--wait=true");
  if ((noWait || waitFalse) && waitTrue) throw new Error("Use either --wait or --no-wait.");
  return !(noWait || waitFalse);
}

function normalizePodcastAudioFormat(raw: string | null): string {
  const value = raw?.trim() || DEFAULT_NOTEBOOKLM_AUDIO_FORMAT;
  const normalized = value.toLowerCase();
  const aliased =
    normalized === "audio" || normalized === "mp3" ? DEFAULT_NOTEBOOKLM_AUDIO_FORMAT : normalized;
  if ((PODCAST_AUDIO_FORMATS as readonly string[]).includes(aliased)) return aliased;
  throw new Error(`--format must be one of: ${PODCAST_AUDIO_FORMATS.join(", ")}`);
}

function parsePodcastCreateOptions(argv: readonly string[]): PodcastCreateOptions {
  const args = argv.slice(2);
  const positionals = parsePositionals(args, PODCAST_VALUE_OPTIONS);
  if (positionals.length !== 1) {
    throw new Error(
      "Usage: summarize podcast create <run-id-or-url> [--language zh-TW] [--format deep-dive] [--length short] [--output overview.mp3] [--no-wait]",
    );
  }

  const languageRaw = readArgValue(args, ["--language", "--lang"]);
  const language = parseExportLanguage(
    languageRaw,
    hasArg(args, "--traditional-chinese") || hasArg(args, "--zh-tw"),
  );
  const format = normalizePodcastAudioFormat(readArgValue(args, ["--format"]));
  const length = readArgValue(args, ["--length"]);
  const wait = parseWait(args);
  const output = readArgValue(args, ["--output", "-o"]);
  if (output && !wait) {
    throw new Error("--output requires --wait because audio must be ready before download.");
  }

  const target = positionals[0] ?? "";
  return {
    target,
    targetUrl: parseHttpUrl(target),
    language,
    languageRaw: language === "zh-TW" && !languageRaw ? "zh-TW" : languageRaw?.trim() || null,
    format,
    length: length?.trim() || null,
    output,
    wait,
    json: hasArg(args, "--json"),
  };
}

function parseHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function resolveStoreState(
  envForRun: Record<string, string | undefined>,
  deps: PodcastCliDeps,
): PodcastStoreState {
  const loadConfig = deps.loadConfig ?? loadSummarizeConfig;
  const createStoreFromConfig = deps.createStoreFromConfig ?? createResearchMemoryStoreFromConfig;
  const { config } = loadConfig({ env: envForRun });
  return {
    result: createStoreFromConfig({ config, env: envForRun }),
  };
}

async function openResearchMemoryStore(state: PodcastStoreState): Promise<OpenPodcastStore> {
  const { result } = state;
  if (!result.store || !result.artifactRoot) {
    throw new Error(formatUnavailablePodcastStore(result));
  }
  await result.store.initialize();
  return {
    store: result.store,
    artifactRoot: result.artifactRoot,
    close: () => result.store?.close() ?? Promise.resolve(),
  };
}

function formatUnavailablePodcastStore(result: ResearchMemoryStoreFactoryResult): string {
  return formatUnavailableMemoryStore(result).replace("memory commands", "podcast commands");
}

function createNullWritable(): NodeJS.WritableStream {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

async function defaultRunSummarize({
  argv,
  envForRun,
  fetchImpl,
  execFileImpl,
  stderr,
}: PodcastRunSummarizeOptions): Promise<void> {
  const { runCli } = await import("./runner.js");
  await runCli(argv, {
    env: envForRun,
    fetch: fetchImpl,
    execFile: execFileImpl,
    stdout: createNullWritable(),
    stderr,
  });
}

function buildSummarizeArgs(options: PodcastCreateOptions): string[] {
  const args = ["--plain", "--stream", "off", "--metrics", "off"];
  if (options.languageRaw && options.languageRaw.toLowerCase() !== "auto") {
    args.push("--language", options.languageRaw);
  }
  if (options.length) args.push("--length", options.length);
  args.push(options.targetUrl ?? options.target);
  return args;
}

function createId(prefix: string, deps: PodcastCliDeps): string {
  return `${prefix}-${deps.createId?.() ?? randomUUID()}`;
}

function safePathSegment(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9._-]+/g, "-").replaceAll(/^-|-$/g, "") || "artifact";
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolvePathWithinRoot(artifactRoot: string, relativePath: string): string {
  const base = path.resolve(artifactRoot);
  const full = path.resolve(base, relativePath);
  const relative = path.relative(base, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Research memory artifact path escapes artifact root: ${relativePath}`);
  }
  return full;
}

function relativePathIfWithinRoot(artifactRoot: string, fullPath: string): string | null {
  const base = path.resolve(artifactRoot);
  const resolved = path.resolve(fullPath);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") return null;
  return relative;
}

function inferAudioExtension({
  outputPath,
  format,
}: {
  outputPath: string;
  format: string;
}): string {
  const fromPath = path.extname(outputPath).replace(/^\./, "").trim();
  if (fromPath) return safePathSegment(fromPath).toLowerCase();
  const normalized = format.trim().toLowerCase();
  if ((PODCAST_AUDIO_FORMATS as readonly string[]).includes(normalized)) return "mp3";
  if (normalized === "mp3" || normalized === "wav" || normalized === "m4a") return normalized;
  return "mp3";
}

function snapshotTitle(snapshot: ResearchMemoryRunSnapshot): string {
  return (
    snapshot.sources.find((source) => source.title?.trim())?.title?.trim() ??
    snapshot.run.inputRef ??
    snapshot.run.id
  );
}

function truncateTitle(value: string, max = 120): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}...`;
}

async function addMarkdownExportArtifact({
  store,
  snapshot,
  artifactRoot,
  markdown,
  deps,
}: {
  store: ResearchMemoryStore;
  snapshot: ResearchMemoryRunSnapshot;
  artifactRoot: string;
  markdown: string;
  deps: PodcastCliDeps;
}): Promise<MarkdownArtifactResult> {
  const artifactId = createId("artifact", deps);
  const relativePath = `${safePathSegment(snapshot.run.id)}/${safePathSegment(
    artifactId,
  )}-notebooklm.md`;
  const fullPath = resolvePathWithinRoot(artifactRoot, relativePath);
  const bytes = Buffer.from(markdown, "utf8");
  await (deps.mkdir ?? mkdir)(path.dirname(fullPath), { recursive: true });
  await (deps.writeFile ?? writeFile)(fullPath, bytes);
  const artifact = await store.addArtifact({
    id: artifactId,
    runId: snapshot.run.id,
    sourceId: null,
    artifactKind: "export",
    storageKind: "file",
    relativePath,
    inlineText: null,
    inlineJson: null,
    mimeType: "text/markdown",
    byteSize: bytes.byteLength,
    sha256: sha256Hex(bytes),
    privacyClass: "user-private",
    retention: "keep",
    metadata: sanitizeJsonObject({ source: "podcast-cli", kind: "notebooklm-markdown-bundle" }),
    createdAt: deps.now?.() ?? Date.now(),
  });
  return { artifact, path: fullPath };
}

async function prepareAudioPlan({
  store,
  snapshot,
  artifactRoot,
  outputPath,
  format,
  cwd,
  deps,
}: {
  store: ResearchMemoryStore;
  snapshot: ResearchMemoryRunSnapshot;
  artifactRoot: string;
  outputPath: string | null;
  format: string;
  cwd: string;
  deps: PodcastCliDeps;
}): Promise<AudioPlan | null> {
  if (!outputPath) return null;

  const requestedOutputPath = path.resolve(cwd, outputPath);
  const relativeRequestedPath = relativePathIfWithinRoot(artifactRoot, requestedOutputPath);
  const extension = inferAudioExtension({ outputPath: requestedOutputPath, format });
  const artifactId = createId("artifact", deps);
  const relativePath =
    relativeRequestedPath ??
    `${safePathSegment(snapshot.run.id)}/${safePathSegment(artifactId)}-notebooklm-audio.${extension}`;
  const downloadOutputPath = relativeRequestedPath
    ? requestedOutputPath
    : resolvePathWithinRoot(artifactRoot, relativePath);

  await (deps.mkdir ?? mkdir)(path.dirname(downloadOutputPath), { recursive: true });
  if (!relativeRequestedPath) {
    await (deps.mkdir ?? mkdir)(path.dirname(requestedOutputPath), { recursive: true });
  }

  const artifact = await store.addArtifact({
    id: artifactId,
    runId: snapshot.run.id,
    sourceId: null,
    artifactKind: "export",
    storageKind: "file",
    relativePath,
    inlineText: null,
    inlineJson: null,
    mimeType: extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : "audio/mpeg",
    byteSize: null,
    sha256: null,
    privacyClass: "user-private",
    retention: "keep",
    metadata: sanitizeJsonObject({
      source: "podcast-cli",
      kind: "notebooklm-audio",
      requestedOutputPath,
      outputFormat: format,
      copiedToRequestedOutput: !relativeRequestedPath,
    }),
    createdAt: deps.now?.() ?? Date.now(),
  });

  return {
    artifact,
    requestedOutputPath,
    downloadOutputPath,
    copyToRequestedOutput: !relativeRequestedPath,
  };
}

function buildAudioDescription({
  options,
  language,
}: {
  options: PodcastCreateOptions;
  language: ExportLanguage;
}): string {
  const parts = ["Create a NotebookLM audio overview from this summarize research bundle."];
  parts.push(`Language: ${language}.`);
  if (options.length) parts.push(`Requested length: ${options.length}.`);
  return parts.join(" ");
}

function buildNotebookMetadata({
  options,
  markdownArtifact,
  audioPlan,
  targetKind,
}: {
  options: PodcastCreateOptions;
  markdownArtifact: ResearchMemoryArtifact;
  audioPlan: AudioPlan | null;
  targetKind: "run" | "url";
}): ResearchMemoryJsonObject {
  return sanitizeJsonObject({
    source: "podcast-cli",
    targetKind,
    target: options.target,
    waitForReady: options.wait,
    requestedLength: options.length,
    markdownArtifactPath: markdownArtifact.relativePath,
    requestedOutputPath: audioPlan?.requestedOutputPath ?? null,
    audioArtifactPath: audioPlan?.artifact.relativePath ?? null,
  });
}

async function copyDownloadedAudioIfNeeded(
  result: NotebookLmMarkdownPodcastResult,
  audioPlan: AudioPlan | null,
  deps: PodcastCliDeps,
): Promise<void> {
  if (!audioPlan) return;
  if (!result.download) throw new Error("NotebookLM did not report an audio download.");
  if (!audioPlan.copyToRequestedOutput) return;
  await (deps.copyFile ?? copyFile)(audioPlan.downloadOutputPath, audioPlan.requestedOutputPath);
}

async function createPodcastFromSnapshot({
  store,
  artifactRoot,
  snapshot,
  options,
  deps,
  targetKind,
}: {
  store: ResearchMemoryStore;
  artifactRoot: string;
  snapshot: ResearchMemoryRunSnapshot;
  options: PodcastCreateOptions;
  deps: PodcastCliDeps;
  targetKind: "run" | "url";
}): Promise<{
  result: NotebookLmMarkdownPodcastResult;
  markdownArtifact: ResearchMemoryArtifact;
  markdownPath: string;
  audioArtifact: ResearchMemoryArtifact | null;
  audioPath: string | null;
  language: ExportLanguage;
}> {
  const language = selectExportLanguage(options.language, snapshot);
  const markdown = await buildNotebookLmMarkdownBundle({
    snapshot,
    artifactRoot,
    language,
    deps,
  });
  const markdownExport = await addMarkdownExportArtifact({
    store,
    snapshot,
    artifactRoot,
    markdown,
    deps,
  });
  const cwd = deps.cwd?.() ?? process.cwd();
  const audioPlan = await prepareAudioPlan({
    store,
    snapshot,
    artifactRoot,
    outputPath: options.output,
    format: options.format,
    cwd,
    deps,
  });
  const service = deps.createNotebookLmService?.() ?? createNotebookLmService();
  const title = truncateTitle(snapshotTitle(snapshot));
  const podcastOptions: NotebookLmMarkdownPodcastOptions = {
    notebook: { title: `summarize: ${title}` },
    source: {
      title: `summarize bundle: ${title}`,
      markdownPath: markdownExport.path,
    },
    audio: {
      format: options.format,
      length: options.length,
      language,
      description: buildAudioDescription({ options, language }),
      outputPath: audioPlan?.downloadOutputPath ?? null,
      waitForReady: options.wait,
    },
    waitForSource: options.wait,
    store,
    runId: snapshot.run.id,
    notebookExportId: createId("notebook-export", deps),
    exportArtifactId: markdownExport.artifact.id,
    audioArtifactId: audioPlan?.artifact.id ?? null,
    languageRaw: language,
    outputFormat: options.format,
    metadata: buildNotebookMetadata({
      options,
      markdownArtifact: markdownExport.artifact,
      audioPlan,
      targetKind,
    }),
  };
  const result = await service.createPodcastFromMarkdownBundle(podcastOptions);
  await copyDownloadedAudioIfNeeded(result, audioPlan, deps);
  return {
    result,
    markdownArtifact: markdownExport.artifact,
    markdownPath: markdownExport.path,
    audioArtifact: audioPlan?.artifact ?? null,
    audioPath: audioPlan?.requestedOutputPath ?? null,
    language,
  };
}

function summarizeRunMatchesTarget(run: ResearchMemoryRun, options: PodcastCreateOptions): boolean {
  if (run.status !== "succeeded" || run.kind !== "cli") return false;
  if (!options.targetUrl) return true;
  const sanitized = sanitizeUrlForResearchMemory(options.targetUrl);
  return run.inputRef === sanitized || run.inputRef === options.targetUrl;
}

async function findFreshSummarizeRun({
  store,
  beforeRunIds,
  startedAt,
  options,
}: {
  store: ResearchMemoryStore;
  beforeRunIds: ReadonlySet<string>;
  startedAt: number;
  options: PodcastCreateOptions;
}): Promise<ResearchMemoryRunSnapshot> {
  const recentRuns = await store.listRuns({ limit: 100, order: "desc", kind: "cli" });
  const freshRuns = recentRuns.filter(
    (run) =>
      !beforeRunIds.has(run.id) &&
      run.createdAt >= startedAt - 1_000 &&
      summarizeRunMatchesTarget(run, options),
  );
  const selected = freshRuns[0] ?? null;
  if (!selected) {
    throw new Error(
      "Summarize completed but no new persisted research-memory run was found. Ensure researchMemory.enabled=true and the summarize run succeeded.",
    );
  }
  const snapshot = await store.getRun(selected.id);
  if (!snapshot) throw new Error(`Research memory run not found after summarize: ${selected.id}`);
  return snapshot;
}

async function handleRunIdCreate({
  state,
  options,
  stdout,
  deps,
}: {
  state: PodcastStoreState;
  options: PodcastCreateOptions;
  stdout: NodeJS.WritableStream;
  deps: PodcastCliDeps;
}): Promise<void> {
  const opened = await openResearchMemoryStore(state);
  try {
    const snapshot = await opened.store.getRun(options.target);
    if (!snapshot) throw new Error(`Research memory run not found: ${options.target}`);
    const output = await createPodcastFromSnapshot({
      store: opened.store,
      artifactRoot: opened.artifactRoot,
      snapshot,
      options,
      deps,
      targetKind: "run",
    });
    writePodcastOutput({ stdout, options, snapshot, output, targetKind: "run" });
  } finally {
    await opened.close();
  }
}

async function handleUrlCreate({
  state,
  options,
  ctx,
  deps,
}: {
  state: PodcastStoreState;
  options: PodcastCreateOptions;
  ctx: PodcastCliContext;
  deps: PodcastCliDeps;
}): Promise<void> {
  const opened = await openResearchMemoryStore(state);
  try {
    const beforeRunIds = new Set(
      (await opened.store.listRuns({ limit: 200, order: "desc", kind: "cli" })).map(
        (run) => run.id,
      ),
    );
    const startedAt = deps.now?.() ?? Date.now();
    await (deps.runSummarize ?? defaultRunSummarize)({
      argv: buildSummarizeArgs(options),
      envForRun: ctx.envForRun,
      fetchImpl: ctx.fetchImpl,
      execFileImpl: ctx.execFileImpl,
      stdout: createNullWritable(),
      stderr: ctx.stderr,
    });
    const snapshot = await findFreshSummarizeRun({
      store: opened.store,
      beforeRunIds,
      startedAt,
      options,
    });
    const output = await createPodcastFromSnapshot({
      store: opened.store,
      artifactRoot: opened.artifactRoot,
      snapshot,
      options,
      deps,
      targetKind: "url",
    });
    writePodcastOutput({ stdout: ctx.stdout, options, snapshot, output, targetKind: "url" });
  } finally {
    await opened.close();
  }
}

function writePodcastOutput({
  stdout,
  options,
  snapshot,
  output,
  targetKind,
}: {
  stdout: NodeJS.WritableStream;
  options: PodcastCreateOptions;
  snapshot: ResearchMemoryRunSnapshot;
  output: Awaited<ReturnType<typeof createPodcastFromSnapshot>>;
  targetKind: "run" | "url";
}): void {
  const { result } = output;
  const payload = {
    runId: snapshot.run.id,
    targetKind,
    language: output.language,
    format: options.format,
    wait: options.wait,
    markdownPath: output.markdownPath,
    markdownArtifactId: output.markdownArtifact.id,
    audioPath: output.audioPath,
    audioArtifactId: output.audioArtifact?.id ?? null,
    notebook: {
      id: result.notebook.id,
      title: result.notebook.title,
      url: result.notebook.url,
    },
    source: {
      id: result.source.id,
      title: result.source.title,
      status: result.source.status,
      url: result.source.url,
    },
    audio: {
      id: result.audioArtifact.id,
      title: result.audioArtifact.title,
      type: result.audioArtifact.type,
      status: result.audioArtifact.status,
      url: result.audioArtifact.url,
    },
    download: result.download
      ? {
          artifactId: result.download.artifactId,
          path: output.audioPath ?? result.download.outputPath,
          byteSize: result.download.byteSize,
        }
      : null,
    notebookExportId: result.notebookExport?.id ?? null,
  };

  if (options.json) {
    stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  stdout.write(
    `NotebookLM podcast ${options.wait ? "created" : "started"} for run ${snapshot.run.id}\n`,
  );
  stdout.write(`  Notebook: ${payload.notebook.id}\n`);
  stdout.write(
    `  Source: ${payload.source.id}${payload.source.status ? ` (${payload.source.status})` : ""}\n`,
  );
  stdout.write(
    `  Audio: ${payload.audio.id}${payload.audio.status ? ` (${payload.audio.status})` : ""}\n`,
  );
  stdout.write(`  Markdown: ${output.markdownPath}\n`);
  if (output.audioPath) stdout.write(`  Audio file: ${output.audioPath}\n`);
}

export async function handlePodcastCliRequest(
  ctx: PodcastCliContext,
  deps: PodcastCliDeps = {},
): Promise<boolean> {
  if (ctx.normalizedArgv[0]?.toLowerCase() !== "podcast") return false;

  const subcommand = ctx.normalizedArgv[1]?.toLowerCase() ?? "help";
  if (wantsHelp(ctx.normalizedArgv) || subcommand !== "create") {
    ctx.stdout.write(`${buildPodcastHelp()}\n`);
    return true;
  }

  const options = parsePodcastCreateOptions(ctx.normalizedArgv);
  const state = resolveStoreState(ctx.envForRun, deps);
  if (options.targetUrl) {
    await handleUrlCreate({ state, options, ctx, deps });
    return true;
  }
  await handleRunIdCreate({ state, options, stdout: ctx.stdout, deps });
  return true;
}
