---
summary: "Design for durable local research memory storage, entities, and privacy boundaries."
read_when:
  - "When designing or implementing durable research memory, storage schema, run history, or local-only persistence."
---

# Local Research Memory Design

Status: design only. This story chooses the storage direction and entity model for durable local research memory without
adding migrations, database open code, or runtime writes.

## Goals

- Keep research history durable on the user's machine across CLI, daemon, and extension sessions.
- Preserve enough context to inspect a run later: sources, extracted content, prompts, final artifacts, selected route,
  privacy mode, events, metrics, and failures.
- Keep local-only mode enforceable and auditable without storing secrets.
- Stay usable for a single-user local app with no server setup.
- Leave existing cache/session behavior intact until a later schema story implements storage.

## Non-goals

- Do not replace the existing cache in this design. Cache entries remain optimized for reuse and eviction, not for
  research history.
- Do not add a database, migrations, adapters, or write paths in this story.
- Do not add sync, collaboration, remote hosting, or cloud backup.
- Do not store API keys, bearer tokens, cookies, raw auth headers, or full environment snapshots.

## Storage Decision

Use a dedicated SQLite database as the durable research memory backend.

Default metadata path:

```text
~/.summarize/research-memory.sqlite
```

Default artifact root:

```text
~/.summarize/research-memory/artifacts/
```

SQLite should hold structured metadata, small text payloads, hashes, privacy decisions, route metadata, and event rows.
Large or binary artifacts should be stored as files under the artifact root and referenced from SQLite by relative path,
content hash, MIME type, and byte size. This keeps the database queryable while avoiding large WAL churn for videos,
slide images, screenshots, or bulky transcripts.

This database should be separate from `~/.summarize/cache.sqlite`. The cache may expire, evict, or overwrite values by
hash key; research memory needs a durable, user-inspectable record of what happened during a run.

## Backend Comparison

| Backend                        | Fit                                                  | Strengths                                                                                                                                                                                    | Weaknesses                                                                                                                                                                        | Decision                                                           |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SQLite                         | Best default for this fork                           | Single local file, zero service setup, works with Node 22/Bun native SQLite paths already used by cache, transactional writes, simple backup/export, good enough for single-user run history | Needs careful write serialization from daemon and CLI, migrations must be explicit, large blobs should stay out of the DB                                                         | Choose for initial durable memory                                  |
| Postgres                       | Useful later for multi-user or networked deployments | Strong concurrency, mature JSON/query/indexing, easier remote dashboards and collaboration                                                                                                   | Requires a running server, credentials, backup administration, and usually a network listener; conflicts with Mac-first local-first defaults                                      | Do not use as default; consider only as an optional future adapter |
| Existing cache/session storage | Good for current short-lived behavior                | Already present; cache stores summaries/extracts/transcripts in SQLite; daemon sessions buffer SSE events; extension automation artifacts use browser storage                                | Cache has TTL/size eviction and hash keys, not run history; daemon sessions are in-memory with short cleanup; extension artifacts are scoped to tab/session storage and may reset | Do not reuse as the research memory backend                        |

## Relationship To Existing Storage

- `src/cache.ts` stores `cache_entries(kind, key, value, size_bytes, created_at, last_accessed_at, expires_at)` with TTL
  and size eviction. Research memory should reference cache hits when useful but must not depend on cache retention.
- `src/daemon/server-session.ts` buffers live SSE events in memory and cleans sessions after a short TTL. Research memory
  should persist selected run events separately if the user has memory enabled.
- `apps/chrome-extension/src/automation/artifacts-store.ts` stores per-tab automation artifacts in
  `chrome.storage.session` when available. Research memory should treat those as temporary UI artifacts unless a later
  story explicitly imports them into the local store.
- Media and slide files may continue to live in their existing output/cache locations, but durable memory artifacts
  should either copy user-requested outputs into the memory artifact root or store a stable relative reference plus hash.

## Initial Entities

The first schema should be small and append-friendly. Names below are design names; LLR-012 can adjust exact table names
while preserving the relationships.

### Runs

One row per user-visible action.

Key fields:

- `id`: UUID generated before extraction/model work begins.
- `kind`: `cli`, `daemon-summary`, `daemon-agent`, `extension-panel`, `extension-hover`, `automation`, or `extract-only`.
- `mode`: `url`, `page`, `file`, `media`, `chat`, `slides`, or `extract`.
- `status`: `pending`, `running`, `succeeded`, `failed`, or `cancelled`.
- `created_at`, `started_at`, `completed_at`.
- `input_ref`: redacted URL, local file basename, or opaque source label.
- `length`, `language_raw`, normalized output language metadata, and requested format.
- `summary_artifact_id`: nullable link to the final summary artifact.
- `metrics_json`: token counts, elapsed time, cache status, slide counts, and other non-secret metrics.
- `config_fingerprint`: hash of relevant config after secret stripping.

### Sources

One run may have many sources.

Key fields:

- `id`, `run_id`.
- `source_kind`: `url`, `visible-page`, `local-file`, `youtube`, `video`, `audio`, `pdf`, `image`, or `manual-text`.
- `canonical_url` and `url_hash` when a URL exists.
- `title`, `site_name`, `content_type`, `language_hint`.
- `content_hash`: hash of normalized extracted text or transcript.
- `extracted_artifact_id`: link to extracted text/Markdown/transcript when persisted.
- `fetch_metadata_json`: HTTP status, transcript source, slide source, cache hit flags, and extraction mode with secrets
  stripped.

### Artifacts

Artifacts are durable local outputs or captured inputs.

Key fields:

- `id`, `run_id`, optional `source_id`.
- `artifact_kind`: `extracted-text`, `transcript`, `rendered-prompt`, `summary`, `slide-image`, `slides-json`,
  `ocr-text`, `chat-log`, `failure-report`, `user-note`, or `export`.
- `storage_kind`: `inline-text`, `inline-json`, or `file`.
- `relative_path`: path under `~/.summarize/research-memory/artifacts/` for file artifacts.
- `mime_type`, `byte_size`, `sha256`, `created_at`.
- `privacy_class`: `public-source`, `user-private`, `local-file`, `model-prompt`, `model-output`, or `diagnostic`.
- `retention`: `keep`, `user-delete`, or future policy markers.

### Prompts

Prompts record what was sent to the model, without secrets.

Key fields:

- `id`, `run_id`.
- `prompt_kind`: `summary`, `chat`, `slides`, `markdown-conversion`, or `custom`.
- `prompt_hash` and `content_hash`.
- `instruction_artifact_id`: rendered instruction or system prompt artifact.
- `input_artifact_id`: rendered user/content prompt artifact when persisted.
- `custom_prompt`: boolean.
- `prompt_template_version`: current prompt format version or named template.
- `redaction_state`: `raw-local`, `redacted`, or `hash-only`.

### Events

Events provide an append-only timeline for diagnostics and UI replay.

Key fields:

- `id`, `run_id`, `sequence`.
- `event_type`: `status`, `model-selected`, `cache-hit`, `cache-miss`, `chunk`, `slides-status`, `metrics`, `warning`,
  `error`, or `done`.
- `created_at`.
- `payload_json`: sanitized event payload.
- `artifact_id`: optional link when the event payload is too large or sensitive for inline JSON.
- `visible_to_ui`: boolean for events safe to replay in the side panel.

Chunk events should not duplicate full summary text by default if a final summary artifact is stored. Store checkpoint
events or chunk hashes unless the user enables full event replay.

### Model Route Metadata

One row per model attempt or selected route.

Key fields:

- `id`, `run_id`.
- `attempt_index`.
- `requested_model_input`: raw model setting after redaction, such as `auto` or `openai/qwen3-local`.
- `selection_source`: `explicit`, `env`, `config`, `local-routing`, `auto`, or `fallback`.
- `language_bucket`: `english`, `traditionalChinese`, `bilingual`, `fallback`, or `none`.
- `selected_model_id` and `provider_kind`.
- `local_runtime_kind`: `openai-compatible`, `llama-cpp`, `ollama`, or null.
- `endpoint_host`: host only, never credentials or API keys.
- `base_url_source`: `configured`, `default`, or null.
- `probe_status`: `not-run`, `reachable`, `unreachable`, or `invalid`.
- `local_only_allowed`: boolean.
- `blocked_reason`: nullable sanitized reason when local-only mode blocks a route.

### Privacy Mode Metadata

One row per run, with optional per-route details in model route metadata.

Key fields:

- `run_id`.
- `local_only_enabled`: boolean.
- `local_only_source`: `privacy.localOnly`, `request localOnly`, `default`, or null.
- `policy_result`: `allowed`, `blocked`, or `not-applicable`.
- `allowed_transports_json`: sanitized list such as `["openai-compatible localhost"]`.
- `protected_data_json`: data classes covered by local-only mode for the run.
- `export_state`: `not-exported`, `user-exported`, or `deleted`.
- `notes`: optional user-visible policy explanation.

### Failures

Failures should be queryable without scraping events.

Key fields:

- `id`, `run_id`, optional `source_id`, optional `route_id`.
- `failure_stage`: `input`, `extract`, `transcript`, `slides`, `prompt`, `route`, `local-only`, `model`, `cache`,
  `storage`, or `unknown`.
- `error_code`, `message`, `stack_artifact_id`.
- `retryable`: boolean or null.
- `created_at`.
- `sanitized`: boolean.

Stacks and raw provider errors should be stored only after secret stripping. In local-only mode, stacks that include
source content, prompts, file paths, or model output remain local artifacts and must not be exported automatically.

## Local-only Privacy Boundary

When local-only mode is enabled, the following data must never leave localhost except for the user's explicit source
fetch itself or an explicit user export:

- Raw extracted source text, transcripts, OCR text, screenshots, slide images, media-derived frames, and local file
  contents.
- Rendered prompts, custom prompt overrides, system/developer instruction text, chat history, and prompt metadata that
  reveals source content.
- Final summaries, partial summary chunks, model outputs, chat outputs, and generated research artifacts.
- Source URLs, titles, local file paths, tab/page text, selected text, and visible-page content after the browser has
  handed them to the local daemon.
- Model route metadata that could reveal private setup details, including local endpoint hosts, local model names, route
  buckets, probe errors, and blocked-route explanations.
- Failure messages, stack traces, event payloads, metrics, and logs when they contain any of the data above.

Local-only mode permits calls to loopback OpenAI-compatible runtimes such as `127.0.0.1`, `localhost`, or approved
loopback aliases. It must block cloud providers, remote OpenAI-compatible gateways, unverifiable CLI transports, telemetry
uploads, and automatic sync of research memory. API keys, cookies, bearer tokens, auth headers, and raw environment
values should never be stored in research memory in any mode.

## Implementation Intent For Later Stories

- Add schema and migration files in the next story, not here.
- Keep the database optional at first; summaries should still work if memory is disabled or the DB cannot open.
- Use WAL, bounded busy timeout, and explicit migrations, mirroring the cache's local SQLite operational posture.
- Serialize daemon writes through one local memory service to avoid concurrent write contention.
- Store route and privacy decisions at the point where the CLI/daemon already knows the selected model attempt and
  local-only policy result.
- Store event payloads after applying the same sanitization rules used for daemon status responses.
- Provide a user-facing deletion/export plan before any sync feature is considered.

## Verification Intent

Documentation-only changes should use `pnpm -s docs:list` and `git diff --check`. Runtime, schema, or TypeScript changes
in later memory stories should add deterministic tests and run the broader gates required for the touched package.
