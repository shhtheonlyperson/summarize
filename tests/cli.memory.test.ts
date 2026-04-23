import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { MemoryResearchMemoryStore } from "../src/research-memory/index.js";
import type {
  ResearchMemoryArtifact,
  ResearchMemoryPrivacyMode,
  ResearchMemoryRun,
  ResearchMemorySource,
} from "../src/research-memory/store.js";
import { runCli } from "../src/run.js";
import { handleMemoryCliRequest, type MemoryCliDeps } from "../src/run/memory-cli.js";

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
  metadata: { profile: "test" },
};

function makeRun(overrides: Partial<ResearchMemoryRun> = {}): ResearchMemoryRun {
  return {
    id: "run-fixture",
    kind: "cli",
    mode: "url",
    status: "succeeded",
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 0),
    startedAt: Date.UTC(2026, 3, 22, 12, 0, 1),
    completedAt: Date.UTC(2026, 3, 22, 12, 1, 0),
    inputRef: "https://example.com/research",
    length: "long",
    languageRaw: "zh-TW",
    languageBucket: "traditionalChinese",
    requestedFormat: "markdown",
    summaryArtifactId: "artifact-summary",
    metrics: { totalCostUsd: 0.01 },
    configFingerprint: "config-fixture",
    privacyMode,
    ...overrides,
  };
}

function makeSource(overrides: Partial<ResearchMemorySource> = {}): ResearchMemorySource {
  return {
    id: "source-1",
    runId: "run-fixture",
    sourceKind: "youtube",
    canonicalUrl: "https://www.youtube.com/watch?v=abc123",
    urlHash: "url-hash",
    title: "NotebookLM Export Fixture",
    siteName: "YouTube",
    contentType: "text/plain",
    languageHint: "en",
    contentHash: "content-hash",
    extractedArtifactId: "artifact-transcript",
    fetchMetadata: { transcriptSource: "youtube", transcriptLines: 2 },
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 2),
    ...overrides,
  };
}

function makeFixtureDeps(store: MemoryResearchMemoryStore, artifactRoot: string): MemoryCliDeps {
  return {
    loadConfig: () => ({
      config: {
        researchMemory: {
          enabled: true,
          backend: "memory",
          artifactRoot,
        },
      },
      path: join(artifactRoot, "config.json"),
    }),
    createStoreFromConfig: () => ({
      kind: "memory",
      backend: "memory",
      store,
      artifactRoot,
      reason: null,
    }),
    cwd: () => artifactRoot,
  };
}

async function createFixtureStore(): Promise<{
  store: MemoryResearchMemoryStore;
  artifactRoot: string;
}> {
  const artifactRoot = mkdtempSync(join(tmpdir(), "summarize-memory-cli-"));
  const runDir = join(artifactRoot, "run-fixture");
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "summary.md"),
    "# Fixture Summary\n\nSummary with cited claim [1].",
    "utf8",
  );

  const store = new MemoryResearchMemoryStore();
  await store.initialize();
  await store.createRun(makeRun());
  await store.upsertSource(makeSource());
  await store.addArtifact({
    id: "artifact-summary",
    runId: "run-fixture",
    sourceId: "source-1",
    artifactKind: "summary",
    storageKind: "file",
    relativePath: "run-fixture/summary.md",
    inlineText: null,
    inlineJson: null,
    mimeType: "text/markdown",
    byteSize: 42,
    sha256: "summary-sha",
    privacyClass: "model-output",
    retention: "keep",
    metadata: { citations: 2 },
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 20),
  } satisfies ResearchMemoryArtifact);
  await store.addArtifact({
    id: "artifact-transcript",
    runId: "run-fixture",
    sourceId: "source-1",
    artifactKind: "transcript",
    storageKind: "inline-text",
    relativePath: null,
    inlineText: "[0:01] Intro line\n[0:12] Timestamped detail",
    inlineJson: null,
    mimeType: "text/plain",
    byteSize: 43,
    sha256: "transcript-sha",
    privacyClass: "public-source",
    retention: "keep",
    metadata: {},
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 10),
  } satisfies ResearchMemoryArtifact);
  await store.addArtifact({
    id: "artifact-slides",
    runId: "run-fixture",
    sourceId: "source-1",
    artifactKind: "slides-json",
    storageKind: "inline-json",
    relativePath: null,
    inlineText: null,
    inlineJson: {
      sourceUrl: "https://www.youtube.com/watch?v=abc123",
      slides: [
        {
          index: 1,
          timestamp: 12,
          imagePath: "/tmp/slide-1.png",
          ocrText: "Slide OCR text for NotebookLM.",
        },
      ],
    },
    mimeType: "application/json",
    byteSize: null,
    sha256: null,
    privacyClass: "diagnostic",
    retention: "keep",
    metadata: {},
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 12),
  } satisfies ResearchMemoryArtifact);
  await store.addModelRoute({
    id: "route-1",
    runId: "run-fixture",
    attemptIndex: 0,
    requestedModelInput: "auto",
    selectionSource: "local-routing",
    languageBucket: "traditionalChinese",
    selectedModelId: "openai/qwen-local",
    providerKind: "openai",
    localRuntimeKind: "openai-compatible",
    endpointHost: "127.0.0.1:11434",
    baseUrlSource: "configured",
    probeStatus: "reachable",
    localOnlyAllowed: true,
    blockedReason: null,
    metadata: { requestedModelLabel: "auto" },
    createdAt: Date.UTC(2026, 3, 22, 12, 0, 30),
  });
  await store.addEvent({
    id: "event-1",
    runId: "run-fixture",
    sequence: 0,
    eventType: "done",
    createdAt: Date.UTC(2026, 3, 22, 12, 1, 0),
    payload: { stage: "completed" },
    artifactId: "artifact-summary",
    visibleToUi: true,
  });
  return { store, artifactRoot };
}

describe("memory cli", () => {
  it("reports disabled status without requiring a live store", async () => {
    const stdout = captureStream();
    const home = mkdtempSync(join(tmpdir(), "summarize-memory-status-"));

    await runCli(["memory", "status"], {
      env: { HOME: home },
      fetch: globalThis.fetch.bind(globalThis),
      stdout: stdout.stream,
      stderr: noopStream(),
    });

    expect(stdout.getText()).toContain("Research memory status");
    expect(stdout.getText()).toContain("Configured: no");
    expect(stdout.getText()).toContain("Available: no");
  });

  it("lists and shows runs from a fake store", async () => {
    const { store, artifactRoot } = await createFixtureStore();
    const stdout = captureStream();

    await handleMemoryCliRequest(
      {
        normalizedArgv: ["memory", "list", "--json"],
        envForRun: {},
        stdout: stdout.stream,
      },
      makeFixtureDeps(store, artifactRoot),
    );

    const payload = JSON.parse(stdout.getText()) as { runs: Array<{ id: string }> };
    expect(payload.runs).toHaveLength(1);
    expect(payload.runs[0]?.id).toBe("run-fixture");

    const showStdout = captureStream();
    await handleMemoryCliRequest(
      {
        normalizedArgv: ["memory", "show", "run-fixture"],
        envForRun: {},
        stdout: showStdout.stream,
      },
      makeFixtureDeps(store, artifactRoot),
    );

    const show = showStdout.getText();
    expect(show).toContain("Run run-fixture");
    expect(show).toContain("Sources (1)");
    expect(show).toContain("Routes (1)");
    expect(show).toContain("openai/qwen-local");
  });

  it("exports NotebookLM-ready markdown with Traditional Chinese headings", async () => {
    const { store, artifactRoot } = await createFixtureStore();
    const stdout = captureStream();

    await handleMemoryCliRequest(
      {
        normalizedArgv: ["memory", "export", "run-fixture", "--language", "zh-TW"],
        envForRun: {},
        stdout: stdout.stream,
      },
      makeFixtureDeps(store, artifactRoot),
    );

    const markdown = stdout.getText();
    expect(markdown).toContain("# NotebookLM 來源匯出包: NotebookLM Export Fixture");
    expect(markdown).toContain("https://www.youtube.com/watch?v=abc123");
    expect(markdown).toContain("- Citations: 2");
    expect(markdown).toContain("# Fixture Summary");
    expect(markdown).toContain("[0:01] Intro line");
    expect(markdown).toContain("### Slide 1 [0:12]");
    expect(markdown).toContain("Slide OCR text for NotebookLM.");
    expect(markdown).toContain("## 路由中繼資料");
    expect(markdown).toContain("openai/qwen-local");
    expect(markdown).toContain("## 隱私模式");
    expect(markdown).toContain("Protected data");
  });

  it("writes exported markdown to the requested output path", async () => {
    const { store, artifactRoot } = await createFixtureStore();
    const stdout = captureStream();

    await handleMemoryCliRequest(
      {
        normalizedArgv: [
          "memory",
          "export",
          "run-fixture",
          "--output",
          "bundle.md",
          "--language",
          "en",
        ],
        envForRun: {},
        stdout: stdout.stream,
      },
      makeFixtureDeps(store, artifactRoot),
    );

    const outputPath = join(artifactRoot, "bundle.md");
    expect(stdout.getText()).toContain(outputPath);
    expect(readFileSync(outputPath, "utf8")).toContain("NotebookLM Source Bundle");
  });

  it("rejects file artifacts that escape the configured artifact root", async () => {
    const { store, artifactRoot } = await createFixtureStore();
    await store.addArtifact({
      id: "artifact-escape",
      runId: "run-fixture",
      sourceId: "source-1",
      artifactKind: "extracted-text",
      storageKind: "file",
      relativePath: "../outside.txt",
      inlineText: null,
      inlineJson: null,
      mimeType: "text/plain",
      byteSize: 12,
      sha256: "escape-sha",
      privacyClass: "public-source",
      retention: "keep",
      metadata: {},
      createdAt: Date.UTC(2026, 3, 22, 12, 0, 40),
    } satisfies ResearchMemoryArtifact);

    await expect(
      handleMemoryCliRequest(
        {
          normalizedArgv: ["memory", "export", "run-fixture"],
          envForRun: {},
          stdout: captureStream().stream,
        },
        makeFixtureDeps(store, artifactRoot),
      ),
    ).rejects.toThrow("escapes artifact root");
  });
});
