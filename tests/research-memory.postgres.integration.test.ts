import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PostgresResearchMemoryStore } from "../src/research-memory/postgres-store.js";
import type {
  ResearchMemoryArtifact,
  ResearchMemoryFailure,
  ResearchMemoryModelRoute,
  ResearchMemoryNotebookExport,
  ResearchMemoryPrivacyMode,
  ResearchMemoryRun,
  ResearchMemorySource,
} from "../src/research-memory/store.js";

const postgresTestUrl = process.env.SUMMARIZE_POSTGRES_TEST_URL?.trim();
const describePostgres = postgresTestUrl ? describe : describe.skip;

const privacyMode: ResearchMemoryPrivacyMode = {
  localOnlyEnabled: true,
  localOnlySource: "privacy.localOnly",
  policyResult: "allowed",
  allowedTransports: ["openai-compatible localhost"],
  protectedData: ["source-content", "prompts", "model-output"],
  exportState: "not-exported",
  notes: "Integration test local-only policy.",
  metadata: { policyVersion: 1 },
};

function makeRun(runId: string, createdAt: number): ResearchMemoryRun {
  return {
    id: runId,
    kind: "automation",
    mode: "url",
    status: "running",
    createdAt,
    startedAt: createdAt + 1,
    completedAt: null,
    inputRef: "https://example.com/postgres-memory",
    length: "long",
    languageRaw: "Traditional Chinese",
    languageBucket: "traditionalChinese",
    requestedFormat: "markdown",
    summaryArtifactId: null,
    metrics: { cacheStatus: "miss", integration: true },
    configFingerprint: "pg-test-config",
    privacyMode,
  };
}

function makeSource(runId: string, sourceId: string): ResearchMemorySource {
  return {
    id: sourceId,
    runId,
    sourceKind: "url",
    canonicalUrl: "https://example.com/postgres-memory",
    urlHash: "pg-test-url-hash",
    title: "Postgres memory source",
    siteName: "Example",
    contentType: "text/html",
    languageHint: "zh-TW",
    contentHash: "pg-test-content-hash",
    extractedArtifactId: null,
    fetchMetadata: { httpStatus: 200, cacheHit: false },
    createdAt: 2_000,
  };
}

function makeArtifact(
  runId: string,
  sourceId: string,
  artifactId: string,
  overrides: Partial<ResearchMemoryArtifact> = {},
): ResearchMemoryArtifact {
  return {
    id: artifactId,
    runId,
    sourceId,
    artifactKind: "summary",
    storageKind: "inline-text",
    relativePath: null,
    inlineText: "Postgres-backed summary.",
    inlineJson: null,
    mimeType: "text/markdown",
    byteSize: 24,
    sha256: "pg-test-artifact-hash",
    privacyClass: "model-output",
    retention: "keep",
    metadata: { citations: 1 },
    createdAt: 2_030,
    ...overrides,
  } as ResearchMemoryArtifact;
}

function makeRoute(runId: string, routeId: string): ResearchMemoryModelRoute {
  return {
    id: routeId,
    runId,
    attemptIndex: 0,
    requestedModelInput: "auto",
    selectionSource: "local-routing",
    languageBucket: "traditionalChinese",
    selectedModelId: "openai/qwen-local",
    providerKind: "openai",
    localRuntimeKind: "ollama",
    endpointHost: "127.0.0.1:11434",
    baseUrlSource: "configured",
    probeStatus: "reachable",
    localOnlyAllowed: true,
    blockedReason: null,
    metadata: { routeReason: "language bucket" },
    createdAt: 2_020,
  };
}

function makeFailure(
  runId: string,
  sourceId: string,
  routeId: string,
  failureId: string,
): ResearchMemoryFailure {
  return {
    id: failureId,
    runId,
    sourceId,
    routeId,
    failureStage: "model",
    errorCode: "MODEL_TIMEOUT",
    message: "Sanitized timeout from integration test.",
    stackArtifactId: null,
    retryable: true,
    createdAt: 2_040,
    sanitized: true,
    metadata: { attempt: 1 },
  };
}

function makeNotebookExport(
  runId: string,
  artifactId: string,
  notebookExportId: string,
): ResearchMemoryNotebookExport {
  return {
    id: notebookExportId,
    runId,
    provider: "notebooklm",
    status: "source-added",
    notebookId: "notebook-pg-test",
    notebookTitle: "Postgres Memory Test",
    notebookUrl: null,
    sourceArtifactId: artifactId,
    exportArtifactId: artifactId,
    audioArtifactId: null,
    languageRaw: "Traditional Chinese",
    outputFormat: "markdown",
    createdAt: 2_050,
    updatedAt: 2_051,
    metadata: { integration: true },
  };
}

async function cleanupRun(runId: string): Promise<void> {
  if (!postgresTestUrl) return;
  const pool = new Pool({ connectionString: postgresTestUrl, allowExitOnIdle: true });
  try {
    await pool.query("DELETE FROM research_runs WHERE id = $1", [runId]);
  } catch {
    // The migration may not have run if the test failed before initialize.
  } finally {
    await pool.end();
  }
}

describePostgres("PostgresResearchMemoryStore integration", () => {
  it("round-trips a run snapshot when SUMMARIZE_POSTGRES_TEST_URL is set", async () => {
    const suffix = randomUUID();
    const runId = `pg-test-run-${suffix}`;
    const sourceId = `pg-test-source-${suffix}`;
    const exportArtifactId = `pg-test-export-artifact-${suffix}`;
    const summaryArtifactId = `pg-test-summary-artifact-${suffix}`;
    const routeId = `pg-test-route-${suffix}`;
    const failureId = `pg-test-failure-${suffix}`;
    const notebookExportId = `pg-test-notebook-export-${suffix}`;
    const store = new PostgresResearchMemoryStore({ postgresUrl: postgresTestUrl });

    try {
      await store.initialize();
      const run = await store.createRun(makeRun(runId, Date.now()));
      await store.upsertSource(makeSource(runId, sourceId));
      const exportArtifact = await store.addArtifact(
        makeArtifact(runId, sourceId, exportArtifactId, {
          artifactKind: "export",
          storageKind: "file",
          relativePath: `runs/${runId}/notebook.md`,
          inlineText: null,
          inlineJson: null,
          byteSize: 42,
          createdAt: 2_010,
        }),
      );
      const updatedSource = await store.upsertSource({
        ...makeSource(runId, sourceId),
        title: "Postgres memory source updated",
        extractedArtifactId: exportArtifact.id,
        createdAt: 2_011,
      });
      const route = await store.addModelRoute(makeRoute(runId, routeId));
      const summaryArtifact = await store.addArtifact(
        makeArtifact(runId, sourceId, summaryArtifactId),
      );
      const failure = await store.addFailure(makeFailure(runId, sourceId, routeId, failureId));
      const notebookExport = await store.addNotebookExport(
        makeNotebookExport(runId, exportArtifactId, notebookExportId),
      );
      const event = await store.addEvent({
        id: `pg-test-event-${suffix}`,
        runId,
        sequence: 0,
        eventType: "model-selected",
        createdAt: 2_025,
        payload: { routeId },
        artifactId: summaryArtifact.id,
        visibleToUi: true,
      });

      await expect(store.getRun(runId)).resolves.toEqual({
        run,
        sources: [updatedSource],
        artifacts: [exportArtifact, summaryArtifact],
        events: [event],
        modelRoutes: [route],
        failures: [failure],
        notebookExports: [notebookExport],
      });
      await expect(
        store.listRuns({ status: "running", kind: "automation", limit: 20 }),
      ).resolves.toContainEqual(run);
    } finally {
      await store.close();
      await cleanupRun(runId);
    }
  });
});
