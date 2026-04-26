import type {
  ResearchMemoryArtifact,
  ResearchMemoryEvent,
  ResearchMemoryFailure,
  ResearchMemoryListRunsOptions,
  ResearchMemoryModelRoute,
  ResearchMemoryNotebookExport,
  ResearchMemoryRun,
  ResearchMemoryRunId,
  ResearchMemoryRunSnapshot,
  ResearchMemorySource,
  ResearchMemoryStore,
} from "./store.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function valuesForRun<T extends { runId: ResearchMemoryRunId }>(
  values: Iterable<T>,
  runId: ResearchMemoryRunId,
): T[] {
  return Array.from(values)
    .filter((value) => value.runId === runId)
    .map((value) => clone(value));
}

export class MemoryResearchMemoryStore implements ResearchMemoryStore {
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
    if (this.events.has(event.id))
      throw new Error(`research memory event already exists: ${event.id}`);
    for (const existing of this.events.values()) {
      if (existing.runId === event.runId && existing.sequence === event.sequence) {
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
      throw new Error(`research memory route already exists: ${route.id}`);
    }
    for (const existing of this.modelRoutes.values()) {
      if (existing.runId === route.runId && existing.attemptIndex === route.attemptIndex) {
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
    if (failure.routeId) this.assertModelRouteExists(failure.routeId);
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
      sources: valuesForRun(this.sources.values(), runId).sort((a, b) => a.id.localeCompare(b.id)),
      artifacts: valuesForRun(this.artifacts.values(), runId).sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ),
      events: valuesForRun(this.events.values(), runId).sort(
        (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id),
      ),
      modelRoutes: valuesForRun(this.modelRoutes.values(), runId).sort(
        (a, b) => a.attemptIndex - b.attemptIndex || a.id.localeCompare(b.id),
      ),
      failures: valuesForRun(this.failures.values(), runId).sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ),
      notebookExports: valuesForRun(this.notebookExports.values(), runId).sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ),
    };
  }

  async listRuns(
    options: ResearchMemoryListRunsOptions = {},
  ): Promise<readonly ResearchMemoryRun[]> {
    this.assertOpen();
    const order = options.order === "asc" ? 1 : -1;
    const limit =
      typeof options.limit === "number" ? Math.max(0, Math.trunc(options.limit)) : undefined;
    const rows = Array.from(this.runs.values())
      .filter((run) => (options.status ? run.status === options.status : true))
      .filter((run) => (options.kind ? run.kind === options.kind : true))
      .sort((a, b) => (a.createdAt - b.createdAt || a.id.localeCompare(b.id)) * order)
      .map((run) => clone(run));
    return typeof limit === "number" ? rows.slice(0, limit) : rows;
  }

  async close(): Promise<void> {
    this.closed = true;
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

  private assertModelRouteExists(routeId: string): void {
    if (!this.modelRoutes.has(routeId)) {
      throw new Error(`research memory model route not found: ${routeId}`);
    }
  }
}

export function createMemoryResearchMemoryStore(): ResearchMemoryStore {
  return new MemoryResearchMemoryStore();
}
