import type { QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";
import {
  PostgresResearchMemoryStore,
  type ResearchMemoryPostgresClient,
} from "../src/research-memory/postgres-store.js";
import type { ResearchMemoryPrivacyMode, ResearchMemoryRun } from "../src/research-memory/store.js";

type Row = Record<string, unknown>;

class FakePostgresClient implements ResearchMemoryPostgresClient {
  readonly queries: Array<{ text: string; values: unknown[] }> = [];

  constructor(private readonly results: Row[][]) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values: unknown[] = [],
  ): Promise<{ rows: T[] }> {
    this.queries.push({ text: queryText, values });
    return { rows: ((this.results.shift() ?? []) as unknown[]).map((row) => row as T) };
  }
}

const privacyMode: ResearchMemoryPrivacyMode = {
  localOnlyEnabled: true,
  localOnlySource: "privacy.localOnly",
  policyResult: "allowed",
  allowedTransports: ["openai-compatible localhost"],
  protectedData: ["source-content", "prompts", "model-output"],
  exportState: "not-exported",
  notes: "Unit test policy.",
  metadata: { policyVersion: 1 },
};

const runRow = {
  id: "run-1",
  kind: "cli",
  mode: "url",
  status: "running",
  created_at: "1000",
  started_at: "1001",
  completed_at: null,
  input_ref: "https://example.com",
  length: "long",
  language_raw: "Traditional Chinese",
  language_bucket: "traditionalChinese",
  requested_format: "markdown",
  summary_artifact_id: null,
  metrics_json: { cacheStatus: "miss" },
  config_fingerprint: "cfg-1",
  privacy_mode_json: privacyMode,
};

const expectedRun: ResearchMemoryRun = {
  id: "run-1",
  kind: "cli",
  mode: "url",
  status: "running",
  createdAt: 1000,
  startedAt: 1001,
  completedAt: null,
  inputRef: "https://example.com",
  length: "long",
  languageRaw: "Traditional Chinese",
  languageBucket: "traditionalChinese",
  requestedFormat: "markdown",
  summaryArtifactId: null,
  metrics: { cacheStatus: "miss" },
  configFingerprint: "cfg-1",
  privacyMode,
};

describe("PostgresResearchMemoryStore", () => {
  it("requires a Postgres URL unless a client is injected", () => {
    expect(() => new PostgresResearchMemoryStore({ postgresUrl: "   " })).toThrow(/postgresUrl/);
  });

  it("maps a complete run snapshot through an injected client", async () => {
    const sourceRow = {
      id: "source-1",
      run_id: "run-1",
      source_kind: "url",
      canonical_url: "https://example.com",
      url_hash: "url-hash",
      title: "Title",
      site_name: "Example",
      content_type: "text/html",
      language_hint: "zh-TW",
      content_hash: "content-hash",
      extracted_artifact_id: "artifact-file",
      fetch_metadata_json: { httpStatus: 200 },
      created_at: "1010",
    };
    const fileArtifactRow = {
      id: "artifact-file",
      run_id: "run-1",
      source_id: "source-1",
      artifact_kind: "export",
      storage_kind: "file",
      relative_path: "runs/run-1/export.md",
      inline_text: null,
      inline_json: null,
      mime_type: "text/markdown",
      byte_size: "42",
      sha256: "sha-file",
      privacy_class: "model-output",
      retention: "keep",
      metadata_json: { exported: true },
      created_at: "1020",
    };
    const jsonArtifactRow = {
      id: "artifact-json",
      run_id: "run-1",
      source_id: null,
      artifact_kind: "slides-json",
      storage_kind: "inline-json",
      relative_path: null,
      inline_text: null,
      inline_json: { slides: 3 },
      mime_type: "application/json",
      byte_size: null,
      sha256: null,
      privacy_class: "diagnostic",
      retention: "keep",
      metadata_json: {},
      created_at: "1030",
    };
    const eventRow = {
      id: "event-1",
      run_id: "run-1",
      sequence: 0,
      event_type: "model-selected",
      created_at: "1040",
      payload_json: { routeId: "route-1" },
      artifact_id: "artifact-json",
      visible_to_ui: true,
    };
    const routeRow = {
      id: "route-1",
      run_id: "run-1",
      attempt_index: 0,
      requested_model_input: "auto",
      selection_source: "local-routing",
      language_bucket: "traditionalChinese",
      selected_model_id: "openai/qwen-local",
      provider_kind: "openai",
      local_runtime_kind: "ollama",
      endpoint_host: "127.0.0.1:11434",
      base_url_source: "configured",
      probe_status: "reachable",
      local_only_allowed: true,
      blocked_reason: null,
      metadata_json: { routeReason: "language bucket" },
      created_at: "1050",
    };
    const failureRow = {
      id: "failure-1",
      run_id: "run-1",
      source_id: "source-1",
      route_id: "route-1",
      failure_stage: "model",
      error_code: "MODEL_TIMEOUT",
      message: "Sanitized timeout.",
      stack_artifact_id: null,
      retryable: true,
      created_at: "1060",
      sanitized: true,
      metadata_json: { attempt: 1 },
    };
    const notebookExportRow = {
      id: "notebook-export-1",
      run_id: "run-1",
      provider: "notebooklm",
      status: "source-added",
      notebook_id: "notebook-1",
      notebook_title: "Notebook",
      notebook_url: null,
      source_artifact_id: "artifact-file",
      export_artifact_id: "artifact-file",
      audio_artifact_id: null,
      language_raw: "Traditional Chinese",
      output_format: "markdown",
      created_at: "1070",
      updated_at: "1071",
      metadata_json: { cli: "fake" },
    };
    const client = new FakePostgresClient([
      [],
      [runRow],
      [sourceRow],
      [fileArtifactRow, jsonArtifactRow],
      [eventRow],
      [routeRow],
      [failureRow],
      [notebookExportRow],
    ]);
    const store = new PostgresResearchMemoryStore({
      client,
      migrationSql: "-- fake migration",
    });

    await expect(store.getRun("run-1")).rejects.toThrow(/initialized/);
    await store.initialize();
    await expect(store.getRun("run-1")).resolves.toEqual({
      run: expectedRun,
      sources: [
        {
          id: "source-1",
          runId: "run-1",
          sourceKind: "url",
          canonicalUrl: "https://example.com",
          urlHash: "url-hash",
          title: "Title",
          siteName: "Example",
          contentType: "text/html",
          languageHint: "zh-TW",
          contentHash: "content-hash",
          extractedArtifactId: "artifact-file",
          fetchMetadata: { httpStatus: 200 },
          createdAt: 1010,
        },
      ],
      artifacts: [
        {
          id: "artifact-file",
          runId: "run-1",
          sourceId: "source-1",
          artifactKind: "export",
          storageKind: "file",
          relativePath: "runs/run-1/export.md",
          inlineText: null,
          inlineJson: null,
          mimeType: "text/markdown",
          byteSize: 42,
          sha256: "sha-file",
          privacyClass: "model-output",
          retention: "keep",
          metadata: { exported: true },
          createdAt: 1020,
        },
        {
          id: "artifact-json",
          runId: "run-1",
          sourceId: null,
          artifactKind: "slides-json",
          storageKind: "inline-json",
          relativePath: null,
          inlineText: null,
          inlineJson: { slides: 3 },
          mimeType: "application/json",
          byteSize: null,
          sha256: null,
          privacyClass: "diagnostic",
          retention: "keep",
          metadata: {},
          createdAt: 1030,
        },
      ],
      events: [
        {
          id: "event-1",
          runId: "run-1",
          sequence: 0,
          eventType: "model-selected",
          createdAt: 1040,
          payload: { routeId: "route-1" },
          artifactId: "artifact-json",
          visibleToUi: true,
        },
      ],
      modelRoutes: [
        {
          id: "route-1",
          runId: "run-1",
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
          createdAt: 1050,
        },
      ],
      failures: [
        {
          id: "failure-1",
          runId: "run-1",
          sourceId: "source-1",
          routeId: "route-1",
          failureStage: "model",
          errorCode: "MODEL_TIMEOUT",
          message: "Sanitized timeout.",
          stackArtifactId: null,
          retryable: true,
          createdAt: 1060,
          sanitized: true,
          metadata: { attempt: 1 },
        },
      ],
      notebookExports: [
        {
          id: "notebook-export-1",
          runId: "run-1",
          provider: "notebooklm",
          status: "source-added",
          notebookId: "notebook-1",
          notebookTitle: "Notebook",
          notebookUrl: null,
          sourceArtifactId: "artifact-file",
          exportArtifactId: "artifact-file",
          audioArtifactId: null,
          languageRaw: "Traditional Chinese",
          outputFormat: "markdown",
          createdAt: 1070,
          updatedAt: 1071,
          metadata: { cli: "fake" },
        },
      ],
    });

    expect(client.queries[0]?.text).toBe("-- fake migration");
  });

  it("builds parameterized list queries for run filters", async () => {
    const client = new FakePostgresClient([[], [runRow]]);
    const store = new PostgresResearchMemoryStore({ client, migrationSql: "-- fake migration" });

    await store.initialize();
    await expect(
      store.listRuns({ status: "running", kind: "cli", order: "asc", limit: 2 }),
    ).resolves.toEqual([expectedRun]);

    expect(client.queries[1]?.text).toContain("WHERE status = $1 AND kind = $2");
    expect(client.queries[1]?.text).toContain("ORDER BY created_at ASC, id ASC LIMIT $3");
    expect(client.queries[1]?.values).toEqual(["running", "cli", 2]);
  });
});
