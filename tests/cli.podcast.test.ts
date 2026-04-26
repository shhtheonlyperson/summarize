import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type {
  NotebookLmMarkdownPodcastOptions,
  NotebookLmMarkdownPodcastResult,
} from "../src/notebooklm/index.js";
import { MemoryResearchMemoryStore } from "../src/research-memory/index.js";
import type {
  ResearchMemoryArtifact,
  ResearchMemoryNotebookExport,
  ResearchMemoryPrivacyMode,
  ResearchMemoryRun,
  ResearchMemorySource,
} from "../src/research-memory/store.js";
import { handlePodcastCliRequest, type PodcastCliDeps } from "../src/run/podcast-cli.js";

function captureStream() {
  let text = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  return { stream, getText: () => text };
}

function noopStream(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

const privacyMode: ResearchMemoryPrivacyMode = {
  localOnlyEnabled: true,
  localOnlySource: "privacy.localOnly",
  policyResult: "allowed",
  allowedTransports: ["localhost-openai-compatible"],
  protectedData: ["apiKeys", "bearerTokens", "cookies", "rawAuthHeaders", "protectedEnv"],
  exportState: "not-exported",
  notes: "Fixture privacy note",
  metadata: {},
};

function makeRun(overrides: Partial<ResearchMemoryRun> = {}): ResearchMemoryRun {
  return {
    id: "run-podcast",
    kind: "cli",
    mode: "url",
    status: "succeeded",
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 0),
    startedAt: Date.UTC(2026, 3, 22, 12, 0, 1),
    completedAt: Date.UTC(2026, 3, 22, 12, 1, 0),
    inputRef: "https://example.com/podcast-source",
    length: "long",
    languageRaw: "zh-TW",
    languageBucket: "traditionalChinese",
    requestedFormat: "markdown",
    summaryArtifactId: "artifact-summary",
    metrics: {},
    configFingerprint: null,
    privacyMode,
    ...overrides,
  };
}

function makeSource(overrides: Partial<ResearchMemorySource> = {}): ResearchMemorySource {
  return {
    id: "source-1",
    runId: "run-podcast",
    sourceKind: "url",
    canonicalUrl: "https://example.com/podcast-source",
    urlHash: "url-hash",
    title: "Podcast CLI Fixture",
    siteName: "Example",
    contentType: "text/html",
    languageHint: "en",
    contentHash: "content-hash",
    extractedArtifactId: "artifact-transcript",
    fetchMetadata: {},
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 2),
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<ResearchMemoryArtifact> = {}): ResearchMemoryArtifact {
  return {
    id: "artifact-summary",
    runId: "run-podcast",
    sourceId: "source-1",
    artifactKind: "summary",
    storageKind: "inline-text",
    relativePath: null,
    inlineText: "# Fixture Summary\n\nImportant research findings.",
    inlineJson: null,
    mimeType: "text/markdown",
    byteSize: 45,
    sha256: "summary-sha",
    privacyClass: "model-output",
    retention: "keep",
    metadata: {},
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 20),
    ...overrides,
  } as ResearchMemoryArtifact;
}

async function seedRun(
  store: MemoryResearchMemoryStore,
  run: ResearchMemoryRun,
  source: ResearchMemorySource,
  artifact: ResearchMemoryArtifact,
): Promise<void> {
  await store.initialize();
  await store.createRun(run);
  await store.upsertSource(source);
  await store.addArtifact(artifact);
}

function makeDeps({
  store,
  root,
  artifactRoot,
  service,
  runSummarize,
}: {
  store: MemoryResearchMemoryStore;
  root: string;
  artifactRoot: string;
  service: ReturnType<typeof makeFakeNotebookLmService>;
  runSummarize?: PodcastCliDeps["runSummarize"];
}): PodcastCliDeps {
  let id = 0;
  return {
    loadConfig: () => ({
      config: {
        researchMemory: {
          enabled: true,
          backend: "memory",
          artifactRoot,
        },
      },
      path: join(root, "config.json"),
    }),
    createStoreFromConfig: () => ({
      kind: "memory",
      backend: "memory",
      store,
      artifactRoot,
      reason: null,
    }),
    createNotebookLmService: () => service,
    runSummarize,
    cwd: () => root,
    now: () => Date.UTC(2026, 3, 22, 12, 2, 0),
    createId: () => `test-${++id}`,
  };
}

function makeFakeNotebookLmService() {
  return {
    createPodcastFromMarkdownBundle: vi.fn(
      async (
        options: NotebookLmMarkdownPodcastOptions,
      ): Promise<NotebookLmMarkdownPodcastResult> => {
        if (options.audio?.outputPath) {
          writeFileSync(options.audio.outputPath, "audio bytes", "utf8");
        }
        const notebook = {
          id: "nb-fake",
          title: "Fake Notebook",
          url: "https://notebooklm.example/nb-fake",
          rawJson: null,
        };
        const source = {
          id: "source-fake",
          title: "Fake Source",
          status: options.waitForSource === false ? "queued" : "ready",
          url: null,
          rawJson: null,
        };
        const audioArtifact = {
          id: "audio-fake",
          title: "Fake Audio",
          type: "audio",
          status: options.audio?.waitForReady === false ? "generating" : "ready",
          url: null,
          rawJson: null,
        };
        const download = options.audio?.outputPath
          ? {
              artifactId: audioArtifact.id,
              outputPath: options.audio.outputPath,
              byteSize: 11,
              rawJson: null,
            }
          : null;
        const now = Date.UTC(2026, 3, 22, 12, 3, 0);
        const notebookExport: ResearchMemoryNotebookExport | null =
          options.store && options.runId
            ? await options.store.addNotebookExport({
                id: options.notebookExportId ?? "notebook-export-fake",
                runId: options.runId,
                provider: "notebooklm",
                status: options.audio?.waitForReady === false ? "audio-generating" : "audio-ready",
                notebookId: notebook.id,
                notebookTitle: notebook.title,
                notebookUrl: notebook.url,
                sourceArtifactId: options.sourceArtifactId ?? null,
                exportArtifactId: options.exportArtifactId ?? null,
                audioArtifactId: options.audioArtifactId ?? null,
                languageRaw: options.languageRaw ?? null,
                outputFormat: options.outputFormat ?? null,
                createdAt: now,
                updatedAt: now,
                metadata: options.metadata ?? {},
              })
            : null;
        return { notebook, source, audioArtifact, download, notebookExport };
      },
    ),
  };
}

describe("podcast cli", () => {
  it("creates a NotebookLM podcast from an existing memory run and records audio output", async () => {
    const root = mkdtempSync(join(tmpdir(), "summarize-podcast-cli-"));
    const artifactRoot = join(root, "artifacts");
    const store = new MemoryResearchMemoryStore();
    await seedRun(store, makeRun(), makeSource(), makeArtifact());
    const service = makeFakeNotebookLmService();
    const stdout = captureStream();

    await handlePodcastCliRequest(
      {
        normalizedArgv: [
          "podcast",
          "create",
          "run-podcast",
          "--language",
          "zh-TW",
          "--format",
          "deep-dive",
          "--length",
          "short",
          "--output",
          "overview.mp3",
          "--json",
        ],
        envForRun: {},
        fetchImpl: globalThis.fetch.bind(globalThis),
        stdout: stdout.stream,
        stderr: noopStream(),
      },
      makeDeps({ store, root, artifactRoot, service }),
    );

    expect(service.createPodcastFromMarkdownBundle).toHaveBeenCalledTimes(1);
    const call = service.createPodcastFromMarkdownBundle.mock.calls[0]?.[0];
    expect(call?.runId).toBe("run-podcast");
    expect(call?.audio).toMatchObject({
      format: "deep-dive",
      length: "short",
      language: "zh-TW",
      waitForReady: true,
    });
    expect(call?.audio?.description).toContain("Requested length: short.");
    expect(call?.source.markdownPath).toContain(artifactRoot);
    expect(readFileSync(call?.source.markdownPath ?? "", "utf8")).toContain(
      "NotebookLM 來源匯出包",
    );

    const payload = JSON.parse(stdout.getText()) as {
      runId: string;
      audioPath: string;
      audioArtifactId: string;
      markdownArtifactId: string;
    };
    expect(payload.runId).toBe("run-podcast");
    expect(payload.audioPath).toBe(join(root, "overview.mp3"));
    expect(readFileSync(join(root, "overview.mp3"), "utf8")).toBe("audio bytes");

    await store.initialize();
    const snapshot = await store.getRun("run-podcast");
    expect(snapshot?.artifacts.some((artifact) => artifact.id === payload.markdownArtifactId)).toBe(
      true,
    );
    const audioArtifact = snapshot?.artifacts.find(
      (artifact) => artifact.id === payload.audioArtifactId,
    );
    expect(audioArtifact).toMatchObject({
      artifactKind: "export",
      storageKind: "file",
      mimeType: "audio/mpeg",
    });
    expect(snapshot?.notebookExports[0]).toMatchObject({
      status: "audio-ready",
      exportArtifactId: payload.markdownArtifactId,
      audioArtifactId: payload.audioArtifactId,
      outputFormat: "deep-dive",
    });
  });

  it("runs summarize for a URL, exports the persisted run, and starts NotebookLM audio", async () => {
    const root = mkdtempSync(join(tmpdir(), "summarize-podcast-url-cli-"));
    const artifactRoot = join(root, "artifacts");
    const store = new MemoryResearchMemoryStore();
    await store.initialize();
    const service = makeFakeNotebookLmService();
    const runSummarize = vi.fn(async ({ argv }) => {
      await seedRun(
        store,
        makeRun({
          id: "run-from-url",
          inputRef: "https://example.com/fresh",
          languageRaw: "en",
          languageBucket: "english",
          createdAt: Date.UTC(2026, 3, 22, 12, 2, 1),
        }),
        makeSource({
          id: "source-url",
          runId: "run-from-url",
          canonicalUrl: "https://example.com/fresh",
          title: "Fresh URL Fixture",
        }),
        makeArtifact({
          id: "artifact-url-summary",
          runId: "run-from-url",
          sourceId: "source-url",
          inlineText: "# Fresh Summary\n\nURL summary text.",
        }),
      );
      expect(argv).toEqual([
        "--plain",
        "--stream",
        "off",
        "--metrics",
        "off",
        "--language",
        "en",
        "--length",
        "long",
        "https://example.com/fresh",
      ]);
    });
    const stdout = captureStream();

    await handlePodcastCliRequest(
      {
        normalizedArgv: [
          "podcast",
          "create",
          "https://example.com/fresh",
          "--language",
          "en",
          "--length",
          "long",
          "--no-wait",
          "--json",
        ],
        envForRun: {},
        fetchImpl: globalThis.fetch.bind(globalThis),
        stdout: stdout.stream,
        stderr: noopStream(),
      },
      makeDeps({ store, root, artifactRoot, service, runSummarize }),
    );

    expect(runSummarize).toHaveBeenCalledTimes(1);
    expect(service.createPodcastFromMarkdownBundle).toHaveBeenCalledTimes(1);
    const call = service.createPodcastFromMarkdownBundle.mock.calls[0]?.[0];
    expect(call?.runId).toBe("run-from-url");
    expect(call?.waitForSource).toBe(false);
    expect(call?.audio).toMatchObject({
      format: "deep-dive",
      length: "long",
      language: "en",
      outputPath: null,
      waitForReady: false,
    });
    expect(readFileSync(call?.source.markdownPath ?? "", "utf8")).toContain(
      "NotebookLM Source Bundle",
    );

    const payload = JSON.parse(stdout.getText()) as {
      runId: string;
      wait: boolean;
      audioPath: string | null;
      notebookExportId: string;
    };
    expect(payload).toMatchObject({
      runId: "run-from-url",
      wait: false,
      audioPath: null,
    });

    await store.initialize();
    const snapshot = await store.getRun("run-from-url");
    expect(snapshot?.notebookExports[0]).toMatchObject({
      id: payload.notebookExportId,
      status: "audio-generating",
      outputFormat: "deep-dive",
    });
  });
});
