import { describe, expect, it } from "vitest";
import {
  RESEARCH_MEMORY_FAILURE_STAGES,
  RESEARCH_MEMORY_NOTEBOOK_EXPORT_STATUSES,
  RESEARCH_MEMORY_STORE_CONTRACT_VERSION,
  type ResearchMemoryArtifact,
  type ResearchMemoryEvent,
  type ResearchMemoryFailure,
  type ResearchMemoryModelRoute,
  type ResearchMemoryNotebookExport,
  type ResearchMemoryPrivacyMode,
  type ResearchMemoryRun,
  type ResearchMemoryRunId,
  type ResearchMemoryRunSnapshot,
  type ResearchMemorySource,
  type ResearchMemoryStore,
} from "../src/research-memory/store.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sortByCreatedAtThenId<T extends { createdAt: number; id: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

class InMemoryResearchMemoryStore implements ResearchMemoryStore {
  private initialized = false;
  private closed = false;
  private readonly runs = new Map<ResearchMemoryRunId, ResearchMemoryRun>();
  private readonly sources = new Map<string, ResearchMemorySource>();
  private readonly artifacts = new Map<string, ResearchMemoryArtifact>();
  private readonly events = new Map<string, ResearchMemoryEvent>();
  private readonly modelRoutes = new Map<string, ResearchMemoryModelRoute>();
  private readonly failures = new Map<string, ResearchMemoryFailure>();
  private readonly notebookExports = new Map<string, ResearchMemoryNotebookExport>();

  async initialize(): Promise<void> {
    this.initialized = true;
    this.closed = false;
  }

  async createRun(run: ResearchMemoryRun): Promise<ResearchMemoryRun> {
    this.assertOpen();
    if (this.runs.has(run.id)) throw new Error(`research memory run already exists: ${run.id}`);
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async updateRun(run: ResearchMemoryRun): Promise<ResearchMemoryRun> {
    this.assertOpen();
    if (!this.runs.has(run.id)) throw new Error(`research memory run not found: ${run.id}`);
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async upsertSource(source: ResearchMemorySource): Promise<ResearchMemorySource> {
    this.assertOpen();
    this.assertRunExists(source.runId);
    const existing = this.sources.get(source.id);
    if (existing && existing.runId !== source.runId) {
      throw new Error(`research memory source belongs to a different run: ${source.id}`);
    }
    this.sources.set(source.id, clone(source));
    return clone(source);
  }

  async addArtifact(artifact: ResearchMemoryArtifact): Promise<ResearchMemoryArtifact> {
    this.assertOpen();
    this.assertRunExists(artifact.runId);
    if (artifact.sourceId) this.assertSourceExists(artifact.sourceId);
    if (this.artifacts.has(artifact.id)) {
      throw new Error(`research memory artifact already exists: ${artifact.id}`);
    }
    this.artifacts.set(artifact.id, clone(artifact));
    return clone(artifact);
  }

  async addEvent(event: ResearchMemoryEvent): Promise<ResearchMemoryEvent> {
    this.assertOpen();
    this.assertRunExists(event.runId);
    if (event.artifactId) this.assertArtifactExists(event.artifactId);
    if (this.events.has(event.id)) {
      throw new Error(`research memory event already exists: ${event.id}`);
    }
    for (const stored of this.events.values()) {
      if (stored.runId === event.runId && stored.sequence === event.sequence) {
        throw new Error(`research memory event sequence already exists: ${event.sequence}`);
      }
    }
    this.events.set(event.id, clone(event));
    return clone(event);
  }

  async addModelRoute(route: ResearchMemoryModelRoute): Promise<ResearchMemoryModelRoute> {
    this.assertOpen();
    this.assertRunExists(route.runId);
    if (this.modelRoutes.has(route.id)) {
      throw new Error(`research memory model route already exists: ${route.id}`);
    }
    for (const stored of this.modelRoutes.values()) {
      if (stored.runId === route.runId && stored.attemptIndex === route.attemptIndex) {
        throw new Error(`research memory route attempt already exists: ${route.attemptIndex}`);
      }
    }
    this.modelRoutes.set(route.id, clone(route));
    return clone(route);
  }

  async addFailure(failure: ResearchMemoryFailure): Promise<ResearchMemoryFailure> {
    this.assertOpen();
    this.assertRunExists(failure.runId);
    if (failure.sourceId) this.assertSourceExists(failure.sourceId);
    if (failure.routeId) this.assertRouteExists(failure.routeId);
    if (failure.stackArtifactId) this.assertArtifactExists(failure.stackArtifactId);
    if (this.failures.has(failure.id)) {
      throw new Error(`research memory failure already exists: ${failure.id}`);
    }
    this.failures.set(failure.id, clone(failure));
    return clone(failure);
  }

  async addNotebookExport(
    notebookExport: ResearchMemoryNotebookExport,
  ): Promise<ResearchMemoryNotebookExport> {
    this.assertOpen();
    this.assertRunExists(notebookExport.runId);
    if (notebookExport.sourceArtifactId) this.assertArtifactExists(notebookExport.sourceArtifactId);
    if (notebookExport.exportArtifactId) this.assertArtifactExists(notebookExport.exportArtifactId);
    if (notebookExport.audioArtifactId) this.assertArtifactExists(notebookExport.audioArtifactId);
    if (this.notebookExports.has(notebookExport.id)) {
      throw new Error(`research memory notebook export already exists: ${notebookExport.id}`);
    }
    this.notebookExports.set(notebookExport.id, clone(notebookExport));
    return clone(notebookExport);
  }

  async getRun(runId: ResearchMemoryRunId): Promise<ResearchMemoryRunSnapshot | null> {
    this.assertOpen();
    const run = this.runs.get(runId);
    if (!run) return null;
    return {
      run: clone(run),
      sources: sortByCreatedAtThenId(this.valuesForRun(this.sources, runId)).map(clone),
      artifacts: sortByCreatedAtThenId(this.valuesForRun(this.artifacts, runId)).map(clone),
      events: this.valuesForRun(this.events, runId)
        .sort(
          (a, b) =>
            a.sequence - b.sequence || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
        )
        .map(clone),
      modelRoutes: this.valuesForRun(this.modelRoutes, runId)
        .sort((a, b) => a.attemptIndex - b.attemptIndex || a.id.localeCompare(b.id))
        .map(clone),
      failures: sortByCreatedAtThenId(this.valuesForRun(this.failures, runId)).map(clone),
      notebookExports: sortByCreatedAtThenId(this.valuesForRun(this.notebookExports, runId)).map(
        clone,
      ),
    };
  }

  async listRuns(
    options: Parameters<ResearchMemoryStore["listRuns"]>[0] = {},
  ): Promise<readonly ResearchMemoryRun[]> {
    this.assertOpen();
    const order = options.order ?? "desc";
    const limit =
      typeof options.limit === "number" ? Math.max(0, Math.trunc(options.limit)) : undefined;
    let runs = [...this.runs.values()];
    if (options.status) runs = runs.filter((run) => run.status === options.status);
    if (options.kind) runs = runs.filter((run) => run.kind === options.kind);
    runs.sort((a, b) => {
      const createdAtCompare =
        order === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      return createdAtCompare || a.id.localeCompare(b.id);
    });
    return runs.slice(0, limit).map(clone);
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private valuesForRun<T extends { runId: ResearchMemoryRunId }>(
    map: ReadonlyMap<string, T>,
    runId: ResearchMemoryRunId,
  ): T[] {
    return [...map.values()].filter((value) => value.runId === runId);
  }

  private assertOpen(): void {
    if (!this.initialized) throw new Error("research memory store must be initialized");
    if (this.closed) throw new Error("research memory store is closed");
  }

  private assertRunExists(runId: ResearchMemoryRunId): void {
    if (!this.runs.has(runId)) throw new Error(`research memory run not found: ${runId}`);
  }

  private assertSourceExists(sourceId: string): void {
    if (!this.sources.has(sourceId))
      throw new Error(`research memory source not found: ${sourceId}`);
  }

  private assertArtifactExists(artifactId: string): void {
    if (!this.artifacts.has(artifactId)) {
      throw new Error(`research memory artifact not found: ${artifactId}`);
    }
  }

  private assertRouteExists(routeId: string): void {
    if (!this.modelRoutes.has(routeId)) {
      throw new Error(`research memory model route not found: ${routeId}`);
    }
  }
}

const privacyMode: ResearchMemoryPrivacyMode = {
  localOnlyEnabled: true,
  localOnlySource: "privacy.localOnly",
  policyResult: "allowed",
  allowedTransports: ["openai-compatible localhost"],
  protectedData: ["source-content", "prompts", "model-output"],
  exportState: "not-exported",
  notes: "Local-only run.",
  metadata: { policyVersion: 1 },
};

function makeRun(overrides: Partial<ResearchMemoryRun> = {}): ResearchMemoryRun {
  return {
    id: "run-1",
    kind: "cli",
    mode: "url",
    status: "running",
    createdAt: 1_000,
    startedAt: 1_001,
    completedAt: null,
    inputRef: "https://example.com/article",
    length: "long",
    languageRaw: "Traditional Chinese",
    languageBucket: "traditionalChinese",
    requestedFormat: "markdown",
    summaryArtifactId: null,
    metrics: { cacheStatus: "miss" },
    configFingerprint: "cfg-abc",
    privacyMode,
    ...overrides,
  };
}

function makeSource(overrides: Partial<ResearchMemorySource> = {}): ResearchMemorySource {
  return {
    id: "source-1",
    runId: "run-1",
    sourceKind: "url",
    canonicalUrl: "https://example.com/article",
    urlHash: "url-sha256",
    title: "Original title",
    siteName: "Example",
    contentType: "text/html",
    languageHint: "zh-TW",
    contentHash: "content-sha256",
    extractedArtifactId: null,
    fetchMetadata: { httpStatus: 200, cacheHit: false },
    createdAt: 1_010,
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<ResearchMemoryArtifact> = {}): ResearchMemoryArtifact {
  return {
    id: "artifact-1",
    runId: "run-1",
    sourceId: "source-1",
    artifactKind: "summary",
    storageKind: "inline-text",
    relativePath: null,
    inlineText: "Summary text.",
    inlineJson: null,
    mimeType: "text/markdown",
    byteSize: 13,
    sha256: "artifact-sha256",
    privacyClass: "model-output",
    retention: "keep",
    metadata: { citations: 2 },
    createdAt: 1_040,
    ...overrides,
  } as ResearchMemoryArtifact;
}

function makeEvent(overrides: Partial<ResearchMemoryEvent> = {}): ResearchMemoryEvent {
  return {
    id: "event-1",
    runId: "run-1",
    sequence: 0,
    eventType: "status",
    createdAt: 1_020,
    payload: { status: "started" },
    artifactId: null,
    visibleToUi: true,
    ...overrides,
  };
}

function makeRoute(overrides: Partial<ResearchMemoryModelRoute> = {}): ResearchMemoryModelRoute {
  return {
    id: "route-1",
    runId: "run-1",
    attemptIndex: 0,
    requestedModelInput: "auto",
    selectionSource: "local-routing",
    languageBucket: "traditionalChinese",
    selectedModelId: "openai/qwen-local",
    providerKind: "openai",
    localRuntimeKind: "llama-cpp",
    endpointHost: "127.0.0.1:8080",
    baseUrlSource: "configured",
    probeStatus: "reachable",
    localOnlyAllowed: true,
    blockedReason: null,
    metadata: { routeReason: "language bucket" },
    createdAt: 1_030,
    ...overrides,
  };
}

function makeFailure(overrides: Partial<ResearchMemoryFailure> = {}): ResearchMemoryFailure {
  return {
    id: "failure-1",
    runId: "run-1",
    sourceId: "source-1",
    routeId: "route-1",
    failureStage: "model",
    errorCode: "MODEL_TIMEOUT",
    message: "Model timed out after sanitized retry.",
    stackArtifactId: null,
    retryable: true,
    createdAt: 1_050,
    sanitized: true,
    metadata: { attempt: 1 },
    ...overrides,
  };
}

function makeNotebookExport(
  overrides: Partial<ResearchMemoryNotebookExport> = {},
): ResearchMemoryNotebookExport {
  return {
    id: "notebook-export-1",
    runId: "run-1",
    provider: "notebooklm",
    status: "source-added",
    notebookId: "notebook-123",
    notebookTitle: "Research Notebook",
    notebookUrl: null,
    sourceArtifactId: "artifact-2",
    exportArtifactId: "artifact-2",
    audioArtifactId: null,
    languageRaw: "Traditional Chinese",
    outputFormat: "markdown",
    createdAt: 1_060,
    updatedAt: 1_061,
    metadata: { notebooklmCli: "fake" },
    ...overrides,
  };
}

describe("ResearchMemoryStore contract", () => {
  it("declares the storage contract version plus failure and notebook export states", () => {
    expect(RESEARCH_MEMORY_STORE_CONTRACT_VERSION).toBe(1);
    expect(RESEARCH_MEMORY_FAILURE_STAGES).toEqual([
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
    ]);
    expect(RESEARCH_MEMORY_NOTEBOOK_EXPORT_STATUSES).toEqual([
      "pending",
      "markdown-exported",
      "source-added",
      "audio-generating",
      "audio-ready",
      "failed",
    ]);
  });

  it("round-trips a complete run snapshot with deterministic child ordering", async () => {
    const store: ResearchMemoryStore = new InMemoryResearchMemoryStore();
    await store.initialize();

    const run = await store.createRun(makeRun());
    await store.upsertSource(makeSource());

    const exportArtifact = await store.addArtifact(
      makeArtifact({
        id: "artifact-2",
        artifactKind: "export",
        storageKind: "file",
        relativePath: "runs/run-1/notebook.md",
        inlineText: null,
        inlineJson: null,
        mimeType: "text/markdown",
        byteSize: 42,
        privacyClass: "model-output",
        createdAt: 1_035,
      }),
    );
    const summaryArtifact = await store.addArtifact(makeArtifact());
    const updatedSource = await store.upsertSource(
      makeSource({
        title: "Updated title",
        extractedArtifactId: exportArtifact.id,
      }),
    );
    const route1 = await store.addModelRoute(makeRoute());
    const route2 = await store.addModelRoute(
      makeRoute({
        id: "route-2",
        attemptIndex: 1,
        selectedModelId: "openai/fallback-local",
        createdAt: 1_031,
      }),
    );
    const event2 = await store.addEvent(
      makeEvent({
        id: "event-2",
        sequence: 1,
        eventType: "model-selected",
        payload: { routeId: route1.id },
        createdAt: 1_021,
      }),
    );
    const event1 = await store.addEvent(makeEvent());
    const failure = await store.addFailure(makeFailure());
    const notebookExport = await store.addNotebookExport(makeNotebookExport());

    const snapshot = await store.getRun(run.id);

    expect(snapshot).toEqual({
      run,
      sources: [updatedSource],
      artifacts: [exportArtifact, summaryArtifact],
      events: [event1, event2],
      modelRoutes: [route1, route2],
      failures: [failure],
      notebookExports: [notebookExport],
    });
    expect(await store.getRun("missing-run")).toBeNull();
  });

  it("lists runs deterministically with filters and limits", async () => {
    const store: ResearchMemoryStore = new InMemoryResearchMemoryStore();
    await store.initialize();

    const run1 = await store.createRun(
      makeRun({ id: "run-1", status: "succeeded", createdAt: 1_000 }),
    );
    const run2 = await store.createRun(
      makeRun({
        id: "run-2",
        kind: "daemon-summary",
        status: "failed",
        createdAt: 1_100,
      }),
    );
    const run3 = await store.createRun(
      makeRun({ id: "run-3", status: "succeeded", createdAt: 1_200 }),
    );

    await expect(store.listRuns()).resolves.toEqual([run3, run2, run1]);
    await expect(store.listRuns({ status: "succeeded", order: "asc" })).resolves.toEqual([
      run1,
      run3,
    ]);
    await expect(store.listRuns({ kind: "daemon-summary", limit: 1 })).resolves.toEqual([run2]);
  });

  it("enforces initialization, run references, uniqueness, and close semantics", async () => {
    const store: ResearchMemoryStore = new InMemoryResearchMemoryStore();

    await expect(store.createRun(makeRun())).rejects.toThrow(/initialized/);
    await store.initialize();
    await expect(store.upsertSource(makeSource())).rejects.toThrow(/run not found/);

    await store.createRun(makeRun());
    await store.upsertSource(makeSource());
    await store.addEvent(makeEvent());

    await expect(store.createRun(makeRun())).rejects.toThrow(/run already exists/);
    await expect(
      store.addEvent(makeEvent({ id: "event-duplicate-id", sequence: 0 })),
    ).rejects.toThrow(/event sequence already exists/);
    await expect(store.addArtifact(makeArtifact({ sourceId: "missing-source" }))).rejects.toThrow(
      /source not found/,
    );

    await store.close();
    await expect(store.listRuns()).rejects.toThrow(/closed/);
  });
});
