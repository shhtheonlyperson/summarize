-- Local research memory initial schema.
-- Applies to ~/.summarize/research-memory.sqlite and keeps binary artifacts
-- under ~/.summarize/research-memory/artifacts/.

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE IF NOT EXISTS research_memory_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_memory_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  value_hash TEXT,
  source TEXT CHECK (
    source IS NULL OR source IN ('default', 'config', 'request', 'user', 'system')
  ),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'cli',
      'daemon-summary',
      'daemon-agent',
      'extension-panel',
      'extension-hover',
      'automation',
      'extract-only'
    )
  ),
  mode TEXT NOT NULL CHECK (
    mode IN ('url', 'page', 'file', 'media', 'chat', 'slides', 'extract')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  input_ref TEXT,
  length TEXT,
  language_raw TEXT,
  language_bucket TEXT CHECK (
    language_bucket IS NULL OR language_bucket IN (
      'english',
      'traditionalChinese',
      'bilingual',
      'fallback',
      'none'
    )
  ),
  requested_format TEXT,
  summary_artifact_id TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  config_fingerprint TEXT,
  privacy_mode_json TEXT NOT NULL DEFAULT '{}',
  CHECK (
    completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
  ),
  FOREIGN KEY (summary_artifact_id)
    REFERENCES research_artifacts(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN (
      'url',
      'visible-page',
      'local-file',
      'youtube',
      'video',
      'audio',
      'pdf',
      'image',
      'manual-text'
    )
  ),
  canonical_url TEXT,
  url_hash TEXT,
  title TEXT,
  site_name TEXT,
  content_type TEXT,
  language_hint TEXT,
  content_hash TEXT,
  extracted_artifact_id TEXT,
  fetch_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id)
    REFERENCES research_runs(id)
    ON DELETE CASCADE,
  FOREIGN KEY (extracted_artifact_id)
    REFERENCES research_artifacts(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS research_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_id TEXT,
  artifact_kind TEXT NOT NULL CHECK (
    artifact_kind IN (
      'extracted-text',
      'transcript',
      'rendered-prompt',
      'summary',
      'slide-image',
      'slides-json',
      'ocr-text',
      'chat-log',
      'failure-report',
      'user-note',
      'export'
    )
  ),
  storage_kind TEXT NOT NULL CHECK (
    storage_kind IN ('inline-text', 'inline-json', 'file')
  ),
  relative_path TEXT,
  inline_text TEXT,
  inline_json TEXT,
  mime_type TEXT,
  byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0),
  sha256 TEXT,
  privacy_class TEXT NOT NULL CHECK (
    privacy_class IN (
      'public-source',
      'user-private',
      'local-file',
      'model-prompt',
      'model-output',
      'diagnostic'
    )
  ),
  retention TEXT NOT NULL DEFAULT 'keep' CHECK (
    retention IN ('keep', 'user-delete')
  ),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  CHECK (
    (
      storage_kind = 'file'
      AND relative_path IS NOT NULL
      AND inline_text IS NULL
      AND inline_json IS NULL
    )
    OR (
      storage_kind = 'inline-text'
      AND relative_path IS NULL
      AND inline_text IS NOT NULL
      AND inline_json IS NULL
    )
    OR (
      storage_kind = 'inline-json'
      AND relative_path IS NULL
      AND inline_text IS NULL
      AND inline_json IS NOT NULL
    )
  ),
  FOREIGN KEY (run_id)
    REFERENCES research_runs(id)
    ON DELETE CASCADE,
  FOREIGN KEY (source_id)
    REFERENCES research_sources(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS research_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'status',
      'model-selected',
      'cache-hit',
      'cache-miss',
      'chunk',
      'slides-status',
      'metrics',
      'warning',
      'error',
      'done'
    )
  ),
  created_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  artifact_id TEXT,
  visible_to_ui INTEGER NOT NULL DEFAULT 0 CHECK (visible_to_ui IN (0, 1)),
  FOREIGN KEY (run_id)
    REFERENCES research_runs(id)
    ON DELETE CASCADE,
  FOREIGN KEY (artifact_id)
    REFERENCES research_artifacts(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS research_model_routes (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  attempt_index INTEGER NOT NULL CHECK (attempt_index >= 0),
  requested_model_input TEXT,
  selection_source TEXT NOT NULL CHECK (
    selection_source IN ('explicit', 'env', 'config', 'local-routing', 'auto', 'fallback')
  ),
  language_bucket TEXT NOT NULL DEFAULT 'none' CHECK (
    language_bucket IN ('english', 'traditionalChinese', 'bilingual', 'fallback', 'none')
  ),
  selected_model_id TEXT,
  provider_kind TEXT,
  local_runtime_kind TEXT CHECK (
    local_runtime_kind IS NULL OR local_runtime_kind IN (
      'openai-compatible',
      'llama-cpp',
      'ollama'
    )
  ),
  endpoint_host TEXT,
  base_url_source TEXT CHECK (
    base_url_source IS NULL OR base_url_source IN ('configured', 'default')
  ),
  probe_status TEXT NOT NULL DEFAULT 'not-run' CHECK (
    probe_status IN ('not-run', 'reachable', 'unreachable', 'invalid')
  ),
  local_only_allowed INTEGER NOT NULL CHECK (local_only_allowed IN (0, 1)),
  blocked_reason TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id)
    REFERENCES research_runs(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_research_memory_settings_updated_at
  ON research_memory_settings(updated_at);

CREATE INDEX IF NOT EXISTS idx_research_runs_status_created_at
  ON research_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_research_runs_kind_created_at
  ON research_runs(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_research_runs_config_fingerprint
  ON research_runs(config_fingerprint);

CREATE INDEX IF NOT EXISTS idx_research_sources_run_id
  ON research_sources(run_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_url_hash
  ON research_sources(url_hash);
CREATE INDEX IF NOT EXISTS idx_research_sources_content_hash
  ON research_sources(content_hash);

CREATE INDEX IF NOT EXISTS idx_research_artifacts_run_id
  ON research_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_research_artifacts_source_id
  ON research_artifacts(source_id);
CREATE INDEX IF NOT EXISTS idx_research_artifacts_kind_created_at
  ON research_artifacts(artifact_kind, created_at);
CREATE INDEX IF NOT EXISTS idx_research_artifacts_sha256
  ON research_artifacts(sha256);

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_events_run_sequence
  ON research_events(run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_research_events_type_created_at
  ON research_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_research_events_visible_to_ui
  ON research_events(run_id, visible_to_ui, sequence);

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_model_routes_run_attempt
  ON research_model_routes(run_id, attempt_index);
CREATE INDEX IF NOT EXISTS idx_research_model_routes_language_bucket
  ON research_model_routes(language_bucket);
CREATE INDEX IF NOT EXISTS idx_research_model_routes_provider
  ON research_model_routes(provider_kind, selected_model_id);

INSERT OR IGNORE INTO research_memory_schema_migrations (version, name, applied_at)
VALUES (1, '001_initial', CAST(unixepoch('now') * 1000 AS INTEGER));

COMMIT;
