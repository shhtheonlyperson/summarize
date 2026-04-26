export const RESEARCH_MEMORY_SCHEMA_VERSION = 1;
export const RESEARCH_MEMORY_INITIAL_MIGRATION = "001_initial.sql";

export const DEFAULT_RESEARCH_MEMORY_DB_PATH = "~/.summarize/research-memory.sqlite";
export const DEFAULT_RESEARCH_MEMORY_ARTIFACT_ROOT = "~/.summarize/research-memory/artifacts";

export type ResearchMemoryEntityName =
  | "settings"
  | "runs"
  | "sources"
  | "artifacts"
  | "events"
  | "modelRoutes";

export type ResearchMemorySchemaEntity = {
  name: ResearchMemoryEntityName;
  table: string;
  requiredColumns: readonly string[];
  requiredIndexes: readonly string[];
};

export const RESEARCH_MEMORY_SCHEMA_ENTITIES = [
  {
    name: "settings",
    table: "research_memory_settings",
    requiredColumns: ["key", "value_json", "value_hash", "source", "updated_at"],
    requiredIndexes: ["idx_research_memory_settings_updated_at"],
  },
  {
    name: "runs",
    table: "research_runs",
    requiredColumns: [
      "id",
      "kind",
      "mode",
      "status",
      "created_at",
      "started_at",
      "completed_at",
      "input_ref",
      "length",
      "language_raw",
      "language_bucket",
      "requested_format",
      "summary_artifact_id",
      "metrics_json",
      "config_fingerprint",
      "privacy_mode_json",
    ],
    requiredIndexes: [
      "idx_research_runs_status_created_at",
      "idx_research_runs_kind_created_at",
      "idx_research_runs_config_fingerprint",
    ],
  },
  {
    name: "sources",
    table: "research_sources",
    requiredColumns: [
      "id",
      "run_id",
      "source_kind",
      "canonical_url",
      "url_hash",
      "title",
      "site_name",
      "content_type",
      "language_hint",
      "content_hash",
      "extracted_artifact_id",
      "fetch_metadata_json",
      "created_at",
    ],
    requiredIndexes: [
      "idx_research_sources_run_id",
      "idx_research_sources_url_hash",
      "idx_research_sources_content_hash",
    ],
  },
  {
    name: "artifacts",
    table: "research_artifacts",
    requiredColumns: [
      "id",
      "run_id",
      "source_id",
      "artifact_kind",
      "storage_kind",
      "relative_path",
      "inline_text",
      "inline_json",
      "mime_type",
      "byte_size",
      "sha256",
      "privacy_class",
      "retention",
      "metadata_json",
      "created_at",
    ],
    requiredIndexes: [
      "idx_research_artifacts_run_id",
      "idx_research_artifacts_source_id",
      "idx_research_artifacts_kind_created_at",
      "idx_research_artifacts_sha256",
    ],
  },
  {
    name: "events",
    table: "research_events",
    requiredColumns: [
      "id",
      "run_id",
      "sequence",
      "event_type",
      "created_at",
      "payload_json",
      "artifact_id",
      "visible_to_ui",
    ],
    requiredIndexes: [
      "idx_research_events_run_sequence",
      "idx_research_events_type_created_at",
      "idx_research_events_visible_to_ui",
    ],
  },
  {
    name: "modelRoutes",
    table: "research_model_routes",
    requiredColumns: [
      "id",
      "run_id",
      "attempt_index",
      "requested_model_input",
      "selection_source",
      "language_bucket",
      "selected_model_id",
      "provider_kind",
      "local_runtime_kind",
      "endpoint_host",
      "base_url_source",
      "probe_status",
      "local_only_allowed",
      "blocked_reason",
      "metadata_json",
      "created_at",
    ],
    requiredIndexes: [
      "idx_research_model_routes_run_attempt",
      "idx_research_model_routes_language_bucket",
      "idx_research_model_routes_provider",
    ],
  },
] as const satisfies readonly ResearchMemorySchemaEntity[];

export const RESEARCH_MEMORY_REQUIRED_TABLES = RESEARCH_MEMORY_SCHEMA_ENTITIES.map(
  (entity) => entity.table,
);

export const RESEARCH_MEMORY_REQUIRED_INDEXES = RESEARCH_MEMORY_SCHEMA_ENTITIES.flatMap(
  (entity) => entity.requiredIndexes,
);
