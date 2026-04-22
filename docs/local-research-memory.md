---
summary: "Local research memory SQLite schema and initialization."
read_when:
  - "When initializing, migrating, or testing the durable local research memory store."
---

# Local Research Memory

Local research memory is a dedicated SQLite store for durable run history. It is separate from the cache because cache
entries can expire or be evicted, while research memory records runs, sources, artifacts, event timelines, and model
route decisions for later inspection.

The current implementation adds the initial schema and deterministic static tests only. Runtime write paths are not
enabled yet.

## Files

- Schema manifest: `src/research-memory/schema.ts`
- Initial migration: `src/research-memory/migrations/001_initial.sql`
- Design rationale: `docs/local-research-memory-design.md`

## Default Paths

```text
~/.summarize/research-memory.sqlite
~/.summarize/research-memory/artifacts/
```

SQLite stores structured metadata, small inline payloads, hashes, privacy decisions, events, and route metadata. Large
or binary artifacts should live under the artifact directory and be referenced by relative path, MIME type, byte size,
and SHA-256 hash.

## Initialize The Store

From the repository root:

```sh
mkdir -p ~/.summarize/research-memory/artifacts
sqlite3 ~/.summarize/research-memory.sqlite < src/research-memory/migrations/001_initial.sql
sqlite3 ~/.summarize/research-memory.sqlite ".tables"
```

The `.tables` output should include:

```text
research_artifacts
research_events
research_memory_schema_migrations
research_memory_settings
research_model_routes
research_runs
research_sources
```

Do not store API keys, bearer tokens, cookies, raw auth headers, or full environment snapshots in this database. In
local-only mode, source content, prompts, model outputs, route details, and diagnostic payloads remain local unless the
user explicitly exports them.

## Test Posture

Default tests validate the migration text and schema manifest statically. They do not open SQLite or require a live
database. Add future live database checks only behind an explicit environment flag so the normal test suite remains
deterministic.
