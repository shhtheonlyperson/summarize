import { readFileSync } from "node:fs";
import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import { RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION } from "./postgres-schema.js";
import type {
  ResearchMemoryArtifact,
  ResearchMemoryArtifactId,
  ResearchMemoryEvent,
  ResearchMemoryFailure,
  ResearchMemoryJsonObject,
  ResearchMemoryJsonValue,
  ResearchMemoryListRunsOptions,
  ResearchMemoryModelRoute,
  ResearchMemoryNotebookExport,
  ResearchMemoryPrivacyMode,
  ResearchMemoryRun,
  ResearchMemoryRunId,
  ResearchMemoryRunSnapshot,
  ResearchMemorySource,
  ResearchMemoryStore,
} from "./store.js";

const defaultMigrationUrl = new URL(
  `./postgres/migrations/${RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION}`,
  import.meta.url,
);

export const RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION_SQL = readFileSync(
  defaultMigrationUrl,
  "utf8",
);

export type ResearchMemoryPostgresClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
  end?: () => Promise<void>;
};

export type PostgresResearchMemoryStoreOptions = {
  postgresUrl?: string;
  poolConfig?: Omit<PoolConfig, "connectionString">;
  client?: ResearchMemoryPostgresClient;
  migrationSql?: string;
};

type Row = Record<string, unknown>;

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function jsonObject(value: unknown): ResearchMemoryJsonObject {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as ResearchMemoryJsonObject)
    : {};
}

function jsonValue(value: unknown): ResearchMemoryJsonValue {
  return parseJson(value) as ResearchMemoryJsonValue;
}

function jsonParam(value: unknown): string {
  return JSON.stringify(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10);
  return Number.NaN;
}

function nullableNumber(value: unknown): number | null {
  return value === null || typeof value === "undefined" ? null : numberValue(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}

function nullableBoolean(value: unknown): boolean | null {
  return value === null || typeof value === "undefined" ? null : booleanValue(value);
}

function rowToRun(row: Row): ResearchMemoryRun {
  return {
    id: String(row.id),
    kind: String(row.kind) as ResearchMemoryRun["kind"],
    mode: String(row.mode) as ResearchMemoryRun["mode"],
    status: String(row.status) as ResearchMemoryRun["status"],
    createdAt: numberValue(row.created_at),
    startedAt: nullableNumber(row.started_at),
    completedAt: nullableNumber(row.completed_at),
    inputRef: nullableString(row.input_ref),
    length: nullableString(row.length),
    languageRaw: nullableString(row.language_raw),
    languageBucket: nullableString(row.language_bucket) as ResearchMemoryRun["languageBucket"],
    requestedFormat: nullableString(row.requested_format),
    summaryArtifactId: nullableString(row.summary_artifact_id) as ResearchMemoryArtifactId | null,
    metrics: jsonObject(row.metrics_json),
    configFingerprint: nullableString(row.config_fingerprint),
    privacyMode: jsonObject(row.privacy_mode_json) as unknown as ResearchMemoryPrivacyMode,
  };
}

function rowToSource(row: Row): ResearchMemorySource {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    sourceKind: String(row.source_kind) as ResearchMemorySource["sourceKind"],
    canonicalUrl: nullableString(row.canonical_url),
    urlHash: nullableString(row.url_hash),
    title: nullableString(row.title),
    siteName: nullableString(row.site_name),
    contentType: nullableString(row.content_type),
    languageHint: nullableString(row.language_hint),
    contentHash: nullableString(row.content_hash),
    extractedArtifactId: nullableString(
      row.extracted_artifact_id,
    ) as ResearchMemoryArtifactId | null,
    fetchMetadata: jsonObject(row.fetch_metadata_json),
    createdAt: numberValue(row.created_at),
  };
}

function rowToArtifact(row: Row): ResearchMemoryArtifact {
  const base = {
    id: String(row.id),
    runId: String(row.run_id),
    sourceId: nullableString(row.source_id),
    artifactKind: String(row.artifact_kind) as ResearchMemoryArtifact["artifactKind"],
    mimeType: nullableString(row.mime_type),
    byteSize: nullableNumber(row.byte_size),
    sha256: nullableString(row.sha256),
    privacyClass: String(row.privacy_class) as ResearchMemoryArtifact["privacyClass"],
    retention: String(row.retention) as ResearchMemoryArtifact["retention"],
    metadata: jsonObject(row.metadata_json),
    createdAt: numberValue(row.created_at),
  };
  const storageKind = String(row.storage_kind);
  if (storageKind === "file") {
    return {
      ...base,
      storageKind,
      relativePath: String(row.relative_path),
      inlineText: null,
      inlineJson: null,
    };
  }
  if (storageKind === "inline-text") {
    return {
      ...base,
      storageKind,
      relativePath: null,
      inlineText: String(row.inline_text),
      inlineJson: null,
    };
  }
  if (storageKind === "inline-json") {
    return {
      ...base,
      storageKind,
      relativePath: null,
      inlineText: null,
      inlineJson: jsonValue(row.inline_json),
    };
  }
  throw new Error(`Unknown research memory artifact storage kind: ${storageKind}`);
}

function rowToEvent(row: Row): ResearchMemoryEvent {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    sequence: numberValue(row.sequence),
    eventType: String(row.event_type) as ResearchMemoryEvent["eventType"],
    createdAt: numberValue(row.created_at),
    payload: jsonObject(row.payload_json),
    artifactId: nullableString(row.artifact_id),
    visibleToUi: booleanValue(row.visible_to_ui),
  };
}

function rowToModelRoute(row: Row): ResearchMemoryModelRoute {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    attemptIndex: numberValue(row.attempt_index),
    requestedModelInput: nullableString(row.requested_model_input),
    selectionSource: String(row.selection_source) as ResearchMemoryModelRoute["selectionSource"],
    languageBucket: String(row.language_bucket) as ResearchMemoryModelRoute["languageBucket"],
    selectedModelId: nullableString(row.selected_model_id),
    providerKind: nullableString(row.provider_kind),
    localRuntimeKind: nullableString(
      row.local_runtime_kind,
    ) as ResearchMemoryModelRoute["localRuntimeKind"],
    endpointHost: nullableString(row.endpoint_host),
    baseUrlSource: nullableString(row.base_url_source) as ResearchMemoryModelRoute["baseUrlSource"],
    probeStatus: String(row.probe_status) as ResearchMemoryModelRoute["probeStatus"],
    localOnlyAllowed: booleanValue(row.local_only_allowed),
    blockedReason: nullableString(row.blocked_reason),
    metadata: jsonObject(row.metadata_json),
    createdAt: numberValue(row.created_at),
  };
}

function rowToFailure(row: Row): ResearchMemoryFailure {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    sourceId: nullableString(row.source_id),
    routeId: nullableString(row.route_id),
    failureStage: String(row.failure_stage) as ResearchMemoryFailure["failureStage"],
    errorCode: nullableString(row.error_code),
    message: String(row.message),
    stackArtifactId: nullableString(row.stack_artifact_id),
    retryable: nullableBoolean(row.retryable),
    createdAt: numberValue(row.created_at),
    sanitized: booleanValue(row.sanitized),
    metadata: jsonObject(row.metadata_json),
  };
}

function rowToNotebookExport(row: Row): ResearchMemoryNotebookExport {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    provider: String(row.provider) as ResearchMemoryNotebookExport["provider"],
    status: String(row.status) as ResearchMemoryNotebookExport["status"],
    notebookId: nullableString(row.notebook_id),
    notebookTitle: nullableString(row.notebook_title),
    notebookUrl: nullableString(row.notebook_url),
    sourceArtifactId: nullableString(row.source_artifact_id),
    exportArtifactId: nullableString(row.export_artifact_id),
    audioArtifactId: nullableString(row.audio_artifact_id),
    languageRaw: nullableString(row.language_raw),
    outputFormat: nullableString(row.output_format),
    createdAt: numberValue(row.created_at),
    updatedAt: numberValue(row.updated_at),
    metadata: jsonObject(row.metadata_json),
  };
}

export class PostgresResearchMemoryStore implements ResearchMemoryStore {
  private readonly client: ResearchMemoryPostgresClient;
  private readonly ownsClient: boolean;
  private readonly migrationSql: string;
  private initialized = false;
  private closed = false;

  constructor(options: PostgresResearchMemoryStoreOptions) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
    } else {
      const postgresUrl = options.postgresUrl?.trim();
      if (!postgresUrl) {
        throw new Error("Postgres research memory requires a non-empty postgresUrl.");
      }
      this.client = new Pool({
        connectionString: postgresUrl,
        max: 4,
        allowExitOnIdle: true,
        ...options.poolConfig,
      });
      this.ownsClient = true;
    }
    this.migrationSql = options.migrationSql ?? RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION_SQL;
  }

  async initialize(): Promise<void> {
    if (this.closed) {
      throw new Error("research memory store is closed");
    }
    await this.client.query(this.migrationSql);
    this.initialized = true;
  }

  async createRun(run: ResearchMemoryRun): Promise<ResearchMemoryRun> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        INSERT INTO research_runs (
          id, kind, mode, status, created_at, started_at, completed_at, input_ref, length,
          language_raw, language_bucket, requested_format, summary_artifact_id, metrics_json,
          config_fingerprint, privacy_mode_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb
        )
        RETURNING *
      `,
      [
        run.id,
        run.kind,
        run.mode,
        run.status,
        run.createdAt,
        run.startedAt,
        run.completedAt,
        run.inputRef,
        run.length,
        run.languageRaw,
        run.languageBucket,
        run.requestedFormat,
        run.summaryArtifactId,
        jsonParam(run.metrics),
        run.configFingerprint,
        jsonParam(run.privacyMode),
      ],
    );
    return rowToRun(row);
  }

  async updateRun(run: ResearchMemoryRun): Promise<ResearchMemoryRun> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        UPDATE research_runs
        SET kind = $2,
            mode = $3,
            status = $4,
            created_at = $5,
            started_at = $6,
            completed_at = $7,
            input_ref = $8,
            length = $9,
            language_raw = $10,
            language_bucket = $11,
            requested_format = $12,
            summary_artifact_id = $13,
            metrics_json = $14::jsonb,
            config_fingerprint = $15,
            privacy_mode_json = $16::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        run.id,
        run.kind,
        run.mode,
        run.status,
        run.createdAt,
        run.startedAt,
        run.completedAt,
        run.inputRef,
        run.length,
        run.languageRaw,
        run.languageBucket,
        run.requestedFormat,
        run.summaryArtifactId,
        jsonParam(run.metrics),
        run.configFingerprint,
        jsonParam(run.privacyMode),
      ],
    );
    return rowToRun(row);
  }

  async upsertSource(source: ResearchMemorySource): Promise<ResearchMemorySource> {
    this.assertOpen();
    const row = await this.queryOptional(
      `
        INSERT INTO research_sources (
          id, run_id, source_kind, canonical_url, url_hash, title, site_name, content_type,
          language_hint, content_hash, extracted_artifact_id, fetch_metadata_json, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13
        )
        ON CONFLICT (id) DO UPDATE SET
          source_kind = EXCLUDED.source_kind,
          canonical_url = EXCLUDED.canonical_url,
          url_hash = EXCLUDED.url_hash,
          title = EXCLUDED.title,
          site_name = EXCLUDED.site_name,
          content_type = EXCLUDED.content_type,
          language_hint = EXCLUDED.language_hint,
          content_hash = EXCLUDED.content_hash,
          extracted_artifact_id = EXCLUDED.extracted_artifact_id,
          fetch_metadata_json = EXCLUDED.fetch_metadata_json,
          created_at = EXCLUDED.created_at
        WHERE research_sources.run_id = EXCLUDED.run_id
        RETURNING *
      `,
      [
        source.id,
        source.runId,
        source.sourceKind,
        source.canonicalUrl,
        source.urlHash,
        source.title,
        source.siteName,
        source.contentType,
        source.languageHint,
        source.contentHash,
        source.extractedArtifactId,
        jsonParam(source.fetchMetadata),
        source.createdAt,
      ],
    );
    if (!row) {
      throw new Error(`research memory source belongs to a different run: ${source.id}`);
    }
    return rowToSource(row);
  }

  async addArtifact(artifact: ResearchMemoryArtifact): Promise<ResearchMemoryArtifact> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        INSERT INTO research_artifacts (
          id, run_id, source_id, artifact_kind, storage_kind, relative_path, inline_text,
          inline_json, mime_type, byte_size, sha256, privacy_class, retention, metadata_json,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14::jsonb, $15
        )
        RETURNING *
      `,
      [
        artifact.id,
        artifact.runId,
        artifact.sourceId,
        artifact.artifactKind,
        artifact.storageKind,
        artifact.relativePath,
        artifact.inlineText,
        artifact.inlineJson === null ? null : jsonParam(artifact.inlineJson),
        artifact.mimeType,
        artifact.byteSize,
        artifact.sha256,
        artifact.privacyClass,
        artifact.retention,
        jsonParam(artifact.metadata),
        artifact.createdAt,
      ],
    );
    return rowToArtifact(row);
  }

  async addEvent(event: ResearchMemoryEvent): Promise<ResearchMemoryEvent> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        INSERT INTO research_events (
          id, run_id, sequence, event_type, created_at, payload_json, artifact_id, visible_to_ui
        ) VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, $8
        )
        RETURNING *
      `,
      [
        event.id,
        event.runId,
        event.sequence,
        event.eventType,
        event.createdAt,
        jsonParam(event.payload),
        event.artifactId,
        event.visibleToUi,
      ],
    );
    return rowToEvent(row);
  }

  async addModelRoute(route: ResearchMemoryModelRoute): Promise<ResearchMemoryModelRoute> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        INSERT INTO research_model_routes (
          id, run_id, attempt_index, requested_model_input, selection_source, language_bucket,
          selected_model_id, provider_kind, local_runtime_kind, endpoint_host, base_url_source,
          probe_status, local_only_allowed, blocked_reason, metadata_json, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16
        )
        RETURNING *
      `,
      [
        route.id,
        route.runId,
        route.attemptIndex,
        route.requestedModelInput,
        route.selectionSource,
        route.languageBucket,
        route.selectedModelId,
        route.providerKind,
        route.localRuntimeKind,
        route.endpointHost,
        route.baseUrlSource,
        route.probeStatus,
        route.localOnlyAllowed,
        route.blockedReason,
        jsonParam(route.metadata),
        route.createdAt,
      ],
    );
    return rowToModelRoute(row);
  }

  async addFailure(failure: ResearchMemoryFailure): Promise<ResearchMemoryFailure> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        INSERT INTO research_failures (
          id, run_id, source_id, route_id, failure_stage, error_code, message,
          stack_artifact_id, retryable, created_at, sanitized, metadata_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
        )
        RETURNING *
      `,
      [
        failure.id,
        failure.runId,
        failure.sourceId,
        failure.routeId,
        failure.failureStage,
        failure.errorCode,
        failure.message,
        failure.stackArtifactId,
        failure.retryable,
        failure.createdAt,
        failure.sanitized,
        jsonParam(failure.metadata),
      ],
    );
    return rowToFailure(row);
  }

  async addNotebookExport(
    notebookExport: ResearchMemoryNotebookExport,
  ): Promise<ResearchMemoryNotebookExport> {
    this.assertOpen();
    const row = await this.queryOne(
      `
        INSERT INTO research_notebook_exports (
          id, run_id, provider, status, notebook_id, notebook_title, notebook_url,
          source_artifact_id, export_artifact_id, audio_artifact_id, language_raw,
          output_format, created_at, updated_at, metadata_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
        )
        RETURNING *
      `,
      [
        notebookExport.id,
        notebookExport.runId,
        notebookExport.provider,
        notebookExport.status,
        notebookExport.notebookId,
        notebookExport.notebookTitle,
        notebookExport.notebookUrl,
        notebookExport.sourceArtifactId,
        notebookExport.exportArtifactId,
        notebookExport.audioArtifactId,
        notebookExport.languageRaw,
        notebookExport.outputFormat,
        notebookExport.createdAt,
        notebookExport.updatedAt,
        jsonParam(notebookExport.metadata),
      ],
    );
    return rowToNotebookExport(row);
  }

  async getRun(runId: ResearchMemoryRunId): Promise<ResearchMemoryRunSnapshot | null> {
    this.assertOpen();
    const runRow = await this.queryOptional("SELECT * FROM research_runs WHERE id = $1", [runId]);
    if (!runRow) return null;
    const [sources, artifacts, events, modelRoutes, failures, notebookExports] = await Promise.all([
      this.queryMany(
        "SELECT * FROM research_sources WHERE run_id = $1 ORDER BY created_at ASC, id ASC",
        [runId],
      ),
      this.queryMany(
        "SELECT * FROM research_artifacts WHERE run_id = $1 ORDER BY created_at ASC, id ASC",
        [runId],
      ),
      this.queryMany(
        `SELECT * FROM research_events
           WHERE run_id = $1
           ORDER BY sequence ASC, created_at ASC, id ASC`,
        [runId],
      ),
      this.queryMany(
        `SELECT * FROM research_model_routes
           WHERE run_id = $1
           ORDER BY attempt_index ASC, id ASC`,
        [runId],
      ),
      this.queryMany(
        "SELECT * FROM research_failures WHERE run_id = $1 ORDER BY created_at ASC, id ASC",
        [runId],
      ),
      this.queryMany(
        `SELECT * FROM research_notebook_exports
           WHERE run_id = $1
           ORDER BY created_at ASC, id ASC`,
        [runId],
      ),
    ]);
    return {
      run: rowToRun(runRow),
      sources: sources.map(rowToSource),
      artifacts: artifacts.map(rowToArtifact),
      events: events.map(rowToEvent),
      modelRoutes: modelRoutes.map(rowToModelRoute),
      failures: failures.map(rowToFailure),
      notebookExports: notebookExports.map(rowToNotebookExport),
    };
  }

  async listRuns(
    options: ResearchMemoryListRunsOptions = {},
  ): Promise<readonly ResearchMemoryRun[]> {
    this.assertOpen();
    const where: string[] = [];
    const values: unknown[] = [];
    if (options.status) {
      values.push(options.status);
      where.push(`status = $${values.length}`);
    }
    if (options.kind) {
      values.push(options.kind);
      where.push(`kind = $${values.length}`);
    }
    const order = options.order === "asc" ? "ASC" : "DESC";
    const limit =
      typeof options.limit === "number" ? Math.max(0, Math.trunc(options.limit)) : undefined;
    const limitSql = typeof limit === "number" ? ` LIMIT $${values.push(limit)}` : "";
    const whereSql = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
    const rows = await this.queryMany(
      `SELECT * FROM research_runs${whereSql} ORDER BY created_at ${order}, id ASC${limitSql}`,
      values,
    );
    return rows.map(rowToRun);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.ownsClient && this.client.end) {
      await this.client.end();
    }
  }

  private assertOpen(): void {
    if (!this.initialized) throw new Error("research memory store must be initialized");
    if (this.closed) throw new Error("research memory store is closed");
  }

  private async queryOne(queryText: string, values: unknown[] = []): Promise<Row> {
    const row = await this.queryOptional(queryText, values);
    if (!row) throw new Error("Postgres research memory query returned no rows.");
    return row;
  }

  private async queryOptional(queryText: string, values: unknown[] = []): Promise<Row | null> {
    const result = await this.client.query<Row>(queryText, values);
    return result.rows[0] ?? null;
  }

  private async queryMany(queryText: string, values: unknown[] = []): Promise<Row[]> {
    const result = await this.client.query<Row>(queryText, values);
    return result.rows;
  }
}

export function createPostgresResearchMemoryStore(
  options: PostgresResearchMemoryStoreOptions,
): ResearchMemoryStore {
  return new PostgresResearchMemoryStore(options);
}
