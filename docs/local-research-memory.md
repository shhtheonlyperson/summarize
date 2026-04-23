---
summary: "Optional durable research memory backends, Postgres setup, migration, testing, and privacy boundaries."
read_when:
  - "When configuring local research memory persistence."
  - "When initializing or testing the optional Postgres research-memory backend."
  - "When exporting persisted runs for NotebookLM."
---

# Local Research Memory

Local research memory records durable run history separately from the cache. Cache entries can expire or be evicted;
research memory is meant for later inspection, export, and NotebookLM source generation.

Research memory is disabled by default. Normal `summarize` usage, `pnpm -s check`, and default tests do not require a
database server.

## Backends

- `memory`: in-process store for deterministic tests and short-lived local experiments.
- `postgres`: optional persistent backend for local run history.
- `sqlite`: schema files and docs remain present for the local-first default direction, but the runtime factory currently
  reports it as a placeholder.

## Files

- Store contract: `src/research-memory/store.ts`
- Runtime factory: `src/research-memory/factory.ts`
- In-memory store: `src/research-memory/memory-store.ts`
- Postgres store: `src/research-memory/postgres-store.ts`
- Postgres schema manifest: `src/research-memory/postgres-schema.ts`
- Postgres migration: `src/research-memory/postgres/migrations/001_initial.sql`
- SQLite schema manifest: `src/research-memory/schema.ts`
- SQLite migration: `src/research-memory/migrations/001_initial.sql`
- Design rationale: `docs/local-research-memory-design.md`

## Configure Postgres

Create a local database with your normal Postgres tooling. On macOS with Homebrew:

```sh
brew install postgresql@16
brew services start postgresql@16
createdb summarize_memory
```

Enable the backend in `~/.summarize/config.json`:

```json
{
  "researchMemory": {
    "enabled": true,
    "backend": "postgres",
    "artifactRoot": "~/.summarize/research-memory/artifacts"
  }
}
```

Keep credentials in the environment when possible:

```sh
export SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL="postgresql://127.0.0.1:5432/summarize_memory"
```

`researchMemory.postgresUrl` is also supported for private local config files, and `RESEARCH_MEMORY_POSTGRES_URL` is
accepted as a fallback environment name. Do not commit config files containing database credentials.

The artifact root defaults to:

```text
~/.summarize/research-memory/artifacts
```

Large or binary artifacts, including NotebookLM markdown bundles and downloaded audio, are stored under this directory
and referenced from Postgres by relative path where possible.

## Initialize And Migrate

The Postgres store applies `src/research-memory/postgres/migrations/001_initial.sql` during store initialization. These
commands initialize the store without running a summary:

```sh
mkdir -p ~/.summarize/research-memory/artifacts
summarize memory status
```

To apply or inspect the migration manually from the repository root:

```sh
psql "$SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL" -v ON_ERROR_STOP=1 \
  -f src/research-memory/postgres/migrations/001_initial.sql
psql "$SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL" -c "\\dt research_*"
```

The Postgres schema includes settings, runs, sources, artifacts, events, model routes, failures, and NotebookLM export
metadata. The SQLite migration remains documented and tested separately so future SQLite work can proceed without making
Postgres mandatory.

## Run And Export

Check the configured backend:

```sh
summarize memory status
```

Persist a run, list recent successful runs, inspect one, and export a NotebookLM-ready bundle:

```sh
summarize "https://example.com/research" --language zh-TW --length long
summarize memory list --status succeeded
summarize memory show run_123
summarize memory export run_123 --output notebooklm.md --language zh-TW
```

Use `--json` with `status`, `list`, `show`, or `export` for machine-readable output.

## Privacy Boundary

Research memory must not store API keys, bearer tokens, cookies, raw auth headers, raw environment snapshots, or
NotebookLM credentials. Runtime records are sanitized before they are persisted.

Persisted source text, prompts, summaries, route metadata, failures, and artifacts can still be sensitive. Keep
`artifactRoot` on local storage if you do not want source content or generated audio in a synced folder. A NotebookLM
export or podcast command is an explicit user action that sends the selected markdown source bundle to NotebookLM; the
default test suite and ordinary disabled-memory runs do not contact NotebookLM.

## Test Posture

Default checks are deterministic and do not need a live Postgres server:

```sh
pnpm -s test tests/research-memory.store.test.ts \
  tests/research-memory.factory.test.ts \
  tests/research-memory.postgres-schema.test.ts \
  tests/research-memory.postgres-store.test.ts \
  tests/research-memory.lifecycle.test.ts \
  tests/cli.memory.test.ts
pnpm -s typecheck
pnpm -s docs:list
```

The live Postgres integration test is explicitly environment-gated:

```sh
pnpm -s test tests/research-memory.postgres.integration.test.ts
SUMMARIZE_POSTGRES_TEST_URL="$SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL" \
  pnpm -s test tests/research-memory.postgres.integration.test.ts
```

The first command is safe in default automation because it skips when `SUMMARIZE_POSTGRES_TEST_URL` is unset. Use the
second command only when a disposable local test database is available.
