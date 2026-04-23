import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtractedLinkContent } from "../src/content/index.js";
import {
  createResearchMemoryRunRecorder,
  MemoryResearchMemoryStore,
} from "../src/research-memory/index.js";

function makeExtracted(overrides: Partial<ExtractedLinkContent> = {}): ExtractedLinkContent {
  return {
    url: "https://example.com/watch?access_token=secret-token&id=1",
    title: "Example title",
    description: "Description",
    siteName: "Example",
    content: "Extracted text with Bearer source-secret.",
    truncated: false,
    totalCharacters: 41,
    wordCount: 6,
    transcriptCharacters: null,
    transcriptLines: null,
    transcriptWordCount: null,
    transcriptSource: null,
    transcriptionProvider: null,
    transcriptMetadata: null,
    transcriptSegments: null,
    transcriptTimedText: null,
    mediaDurationSeconds: null,
    video: null,
    isVideoOnly: false,
    diagnostics: {
      strategy: "html",
      firecrawl: { attempted: false, used: false, cacheMode: "default", cacheStatus: "miss" },
      markdown: { requested: false, used: false, provider: null },
      transcript: {
        cacheMode: "default",
        cacheStatus: "unknown",
        textProvided: false,
        provider: null,
        attemptedProviders: [],
      },
    },
    ...overrides,
  };
}

describe("ResearchMemoryRunRecorder", () => {
  it("persists lifecycle writes and large sanitized artifacts through the store", async () => {
    const store = new MemoryResearchMemoryStore();
    const artifactRoot = mkdtempSync(join(tmpdir(), "summarize-memory-lifecycle-"));
    let now = 1_000;
    let id = 0;
    const recorder = createResearchMemoryRunRecorder({
      store,
      artifactRoot,
      now: () => (now += 10),
      idFactory: () => `id-${(id += 1)}`,
      outputLanguage: { kind: "fixed", tag: "zh-TW", label: "Chinese (Traditional)" },
      model: {
        requestedModelInput: "auto",
        requestedModelLabel: "auto",
        selectionSource: "local-routing",
        providerBaseUrls: { openai: "http://127.0.0.1:11434/v1" },
        localOnlyMode: { enabled: true, source: "privacy.localOnly" },
      },
      run: {
        id: "run-test",
        kind: "cli",
        mode: "url",
        status: "running",
        createdAt: 1_000,
        startedAt: 1_000,
        completedAt: null,
        inputRef: "https://example.com/watch?api_key=secret-key&id=1",
        length: "medium",
        languageRaw: "zh-TW",
        languageBucket: "traditionalChinese",
        requestedFormat: "markdown",
        summaryArtifactId: null,
        metrics: {},
        configFingerprint: null,
      },
    });

    await recorder.start();
    recorder.recordLinkPreviewProgress({
      kind: "fetch-html-done",
      url: "https://example.com/?token=secret-token",
      downloadedBytes: 123,
      totalBytes: 456,
    });
    await recorder.recordExtractedUrlSource(makeExtracted());
    await recorder.recordModelRoute("openai/qwen-local", { authorization: "Bearer route-secret" });
    const largeSummary = `${"Summary line.\n".repeat(500)}Bearer summary-secret sk-testsecret123`;
    await recorder.recordSummaryArtifact(largeSummary, { cookie: "session=secret" });
    recorder.recordCacheResult("summary", false);
    await recorder.complete({
      llm: [],
      services: { firecrawl: { requests: 0 }, apify: { requests: 0 } },
    });
    await recorder.close();

    const snapshot = await store.initialize().then(() => store.getRun("run-test"));
    expect(snapshot?.run.status).toBe("succeeded");
    expect(snapshot?.run.inputRef).toContain("api_key=%5Bredacted%5D");
    expect(snapshot?.sources[0]?.canonicalUrl).toContain("access_token=%5Bredacted%5D");
    expect(snapshot?.modelRoutes[0]).toMatchObject({
      selectedModelId: "openai/qwen-local",
      selectionSource: "local-routing",
      languageBucket: "traditionalChinese",
      endpointHost: "127.0.0.1:11434",
      localOnlyAllowed: true,
    });
    expect(snapshot?.modelRoutes[0]?.metadata.authorization).toBe("[redacted]");
    const summary = snapshot?.artifacts.find((artifact) => artifact.artifactKind === "summary");
    expect(summary?.storageKind).toBe("file");
    expect(summary?.relativePath).toBeTruthy();
    const summaryPath = join(artifactRoot, summary?.relativePath ?? "");
    expect(existsSync(summaryPath)).toBe(true);
    const storedSummary = readFileSync(summaryPath, "utf8");
    expect(storedSummary).toContain("Summary line.");
    expect(storedSummary).not.toContain("summary-secret");
    expect(snapshot?.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["status", "model-selected", "cache-miss", "done"]),
    );
  });

  it("records sanitized failures without stack artifacts", async () => {
    const store = new MemoryResearchMemoryStore();
    const recorder = createResearchMemoryRunRecorder({
      store,
      artifactRoot: mkdtempSync(join(tmpdir(), "summarize-memory-failure-")),
      outputLanguage: { kind: "auto" },
      model: {
        requestedModelInput: "openai/gpt-test",
        requestedModelLabel: "openai/gpt-test",
        selectionSource: "explicit",
        providerBaseUrls: { openai: null },
        localOnlyMode: { enabled: false, source: null },
      },
      run: {
        id: "run-failure",
        kind: "daemon-summary",
        mode: "url",
        status: "running",
        createdAt: 1,
        startedAt: 1,
        completedAt: null,
        inputRef: "https://example.com",
        length: "xl",
        languageRaw: "auto",
        languageBucket: "none",
        requestedFormat: "text",
        summaryArtifactId: null,
        metrics: {},
        configFingerprint: null,
      },
    });

    await recorder.start();
    await recorder.fail(new Error("Request failed with Authorization: Bearer failure-secret"));
    await recorder.close();

    await store.initialize();
    const snapshot = await store.getRun("run-failure");
    expect(snapshot?.run.status).toBe("failed");
    expect(snapshot?.failures).toHaveLength(1);
    expect(snapshot?.failures[0]?.message).not.toContain("failure-secret");
    expect(snapshot?.failures[0]?.stackArtifactId).toBeNull();
  });
});
