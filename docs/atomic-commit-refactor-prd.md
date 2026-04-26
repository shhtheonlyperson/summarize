---
summary: "PRD for refactoring the local-first fork history into atomic upstreamable commits."
read_when:
  - "When preparing this fork for contribution back to upstream."
  - "When splitting local-first, locale, local LLM, persistence, or NotebookLM work into atomic commits."
---

# Atomic Commit Refactor PRD

## Context

The current `main` branch is rebased on top of upstream `steipete/summarize` `main` and contains a working
local-first fork stack. The stack was built through Ralph stories and includes source changes, tests, docs, private
run logs, generated task files, and progress-only commits.

That history is useful for local traceability but too noisy for contribution. Before opening upstream PRs, rewrite the
fork work into small reviewable commits where each commit has one behavioral purpose, includes its own tests and docs
when needed, and keeps generated agent artifacts out of the contribution branch.

## Goals

- Preserve the current fork behavior while turning the history into atomic, reviewable commits.
- Separate generic upstreamable features from private fork defaults and local-only preferences.
- Keep every target commit buildable and testable on its own.
- Make locale support, local LLM setup, persistence, and NotebookLM workflow independently reviewable.
- Remove `.ralph`, `.agents/ralph`, generated task overviews, and run logs from any upstream contribution branch.

## Non-Goals

- Do not rename package IDs, binaries, or public package ownership.
- Do not require live local LLM servers, Postgres, NotebookLM, or browser extension credentials for default tests.
- Do not make upstream summarize default to Traditional Chinese unless that is intentionally proposed as fork-only
  behavior.
- Do not force-push over `origin/main` as part of the refactor without a separate explicit approval.

## Current History Shape

The rebased stack currently falls into these groups:

- Fork positioning and local-first docs.
- Ralph task runner assets, progress logs, and generated run artifacts.
- Local runtime descriptor and probe foundation.
- CLI local runtime probe command.
- Language-aware local model routing.
- Local-only privacy guard.
- Daemon status endpoints for local runtime and local-only state.
- Chrome extension side-panel local status UI.
- Mac-first local LLM onboarding docs.
- Durable research memory design and SQLite schema skeleton.
- Locale support for English and Traditional Chinese in the side panel, including default Traditional Chinese behavior.
- Optional Postgres research memory backend.
- CLI and daemon run lifecycle persistence.
- Memory query/export CLI.
- NotebookLM CLI wrapper and `summarize podcast create`.
- Postgres and NotebookLM docs, including Traditional Chinese summary.

## Target Workstreams

### 1. Contribution Hygiene

Create a clean branch from upstream `main` and replay only product, test, and documentation files. Do not include
`.ralph`, `.agents/ralph`, `.ralph/.tmp`, `.ralph/runs`, generated task overview files, or progress-only commits.

Acceptance criteria:

- `git diff --name-only upstream/main...branch` contains no generated Ralph run artifacts.
- Every target commit passes its scoped tests.
- Final branch passes `pnpm -s check`.

### 2. Local-First Positioning

Keep fork intent and upstream compatibility guidance in documentation only.

Target commit:

- `docs: document local-first fork positioning`

Candidate files:

- `README.md`
- `AGENTS.md`
- `docs/local-first-roadmap.md`

Validation:

- `pnpm -s docs:list`
- `git diff --check`

### 3. Local LLM Runtime Foundation

Add model-runtime descriptors and probes without changing default model selection. This is the base for Gemma/Qwen
local routing and UI status.

Target commits:

- `feat(core): add local runtime descriptors and probes`
- `feat(cli): add local runtime probe command`

Candidate files:

- `packages/core/src/local-runtime.ts`
- `packages/core/src/index.ts`
- `packages/core/package.json`
- `src/run/local-runtime-probe-cli.ts`
- `src/run/cli-preflight.ts`
- `src/run/help.ts`
- `tests/local-runtime.test.ts`
- `tests/cli.local-runtime-probe.test.ts`

Validation:

- `pnpm -s test tests/local-runtime.test.ts tests/cli.local-runtime-probe.test.ts`
- `pnpm -s typecheck`

### 4. Language Routing and Locale Support

Split model-routing behavior from UI translation behavior.

Target commits:

- `feat(run): add language-aware local model routing`
- `feat(extension): add English and Traditional Chinese locale UI`
- `feat(extension): default side panel locale to Traditional Chinese`
- `test(extension): cover side panel locale toggle`

Behavior boundaries:

- English summaries default to local `openai/gemma4-31b` only when local routing is enabled and no explicit model is
  selected.
- Traditional Chinese summaries default to local `openai/qwen3.6-35b-a3b` only when local routing is enabled and no
  explicit model is selected.
- Gemini 3.1 Pro remains an explicit provider/model option, not an implicit local default.
- UI locale can be toggled between English and Traditional Chinese; default Traditional Chinese should be a separate
  fork-policy commit so upstream can accept generic locale support without accepting the private default.

Candidate files:

- `src/run/local-model-routing.ts`
- `src/run/run-models.ts`
- `src/run/model-attempts.ts`
- `src/run/summary-engine.ts`
- `src/config.ts`
- `src/config/sections.ts`
- `src/config/types.ts`
- `apps/chrome-extension/src/entrypoints/sidepanel/i18n.ts`
- `apps/chrome-extension/src/entrypoints/sidepanel/*`
- `apps/chrome-extension/src/lib/settings.ts`
- locale and side-panel tests under `tests/` and `apps/chrome-extension/tests/`

Validation:

- `pnpm -s test tests/run.models.test.ts tests/config.test.ts tests/sidepanel.i18n.test.ts`
- `pnpm -C apps/chrome-extension build`
- `pnpm -C apps/chrome-extension test:chrome`

### 5. Local-Only Privacy and Status

Keep privacy enforcement separate from status display.

Target commits:

- `feat(run): add local-only privacy guard`
- `feat(daemon): expose local runtime status endpoint`
- `feat(extension): show local runtime status in side panel`

Candidate files:

- `src/run/local-only.ts`
- `src/daemon/local-runtime-status.ts`
- `src/daemon/server-admin-routes.ts`
- `src/daemon/server-agent-route.ts`
- `src/daemon/chat.ts`
- `apps/chrome-extension/src/lib/local-runtime-status-client.ts`
- `apps/chrome-extension/src/entrypoints/sidepanel/local-runtime-status.ts`
- related daemon, run, and side-panel tests

Validation:

- `pnpm -s test tests/local-only.test.ts tests/daemon.local-runtime-status.test.ts`
- `pnpm -C apps/chrome-extension test:chrome`

### 6. Research Memory Schema and Store Contract

Separate the storage contract from specific persistence backends.

Target commits:

- `docs: design durable local research memory`
- `feat(memory): add research memory schema skeleton`
- `feat(memory): add research memory store contract`

Candidate files:

- `docs/local-research-memory-design.md`
- `docs/local-research-memory.md`
- `src/research-memory/schema.ts`
- `src/research-memory/migrations/001_initial.sql`
- `src/research-memory/store.ts`
- `src/research-memory/index.ts`
- `tests/research-memory.schema.test.ts`
- `tests/research-memory.store.test.ts`

Validation:

- `pnpm -s test tests/research-memory.schema.test.ts tests/research-memory.store.test.ts`
- `pnpm -s docs:list`

### 7. Local Postgres Persistence

Keep Postgres optional and local-first. This is likely fork-friendly but may need upstream framing because it adds `pg`.

Target commits:

- `feat(memory): add optional postgres backend`
- `feat(memory): persist cli and daemon run lifecycle`
- `feat(cli): add memory status list show export commands`

Candidate files:

- `package.json`
- `pnpm-lock.yaml`
- `scripts/build-cli.mjs`
- `src/research-memory/factory.ts`
- `src/research-memory/memory-store.ts`
- `src/research-memory/lifecycle.ts`
- `src/research-memory/postgres-schema.ts`
- `src/research-memory/postgres-store.ts`
- `src/research-memory/postgres/migrations/001_initial.sql`
- `src/run/memory-cli.ts`
- CLI, daemon, flow, and asset files that pass a recorder through run execution
- related memory and integration tests

Validation:

- `pnpm -s test tests/research-memory.factory.test.ts tests/research-memory.lifecycle.test.ts tests/research-memory.postgres-schema.test.ts tests/research-memory.postgres-store.test.ts tests/research-memory.postgres.integration.test.ts tests/cli.memory.test.ts`
- `pnpm -s typecheck`
- Optional live check with `SUMMARIZE_POSTGRES_TEST_URL` set.

### 8. NotebookLM Podcast Workflow

Keep NotebookLM behind an explicit CLI command and fake-service tests. Do not require a real NotebookLM account in
default checks.

Target commits:

- `feat(notebooklm): add NotebookLM CLI service wrapper`
- `feat(cli): add podcast creation command`
- `docs: document Postgres NotebookLM workflow`
- `docs: add Traditional Chinese Postgres NotebookLM summary`

Candidate files:

- `src/notebooklm/index.ts`
- `src/notebooklm/service.ts`
- `src/run/podcast-cli.ts`
- `src/run/memory-cli.ts`
- `src/run/cli-preflight.ts`
- `src/run/help.ts`
- `docs/notebooklm-podcast-workflow.md`
- `docs/postgres-notebooklm-summary.zh-TW.md`
- `tests/notebooklm.service.test.ts`
- `tests/cli.podcast.test.ts`

Validation:

- `pnpm -s test tests/notebooklm.service.test.ts tests/cli.podcast.test.ts tests/cli.memory.test.ts`
- `pnpm -s docs:list`

### 9. Final Documentation Indexing

After the feature commits are split, make one final docs-index commit only if links need to be synchronized.

Target commit:

- `docs: update local-first documentation index`

Candidate files:

- `README.md`
- `docs/README.md`
- `docs/index.md`
- `docs/config.md`
- `docs/cli.md`
- `docs/chrome-extension.md`

Validation:

- `pnpm -s docs:list`
- `git diff --check`

## Refactor Procedure

1. Create a preservation tag for the current branch.
2. Create a new branch from `upstream/main`.
3. Reconstruct each target commit by checking out only the relevant paths from the current fork branch.
4. After each target commit, run the scoped validation listed above.
5. Run `pnpm -s check` after the final commit.
6. Compare the clean branch diff against the current fork diff, excluding generated Ralph/task artifacts.
7. Push the clean branch for review before deciding whether to replace `main`.

Suggested comparison commands:

```sh
git diff --stat upstream/main..main
git diff --stat upstream/main..clean-local-first
git diff --name-only upstream/main..clean-local-first | rg '(^\.ralph|^\.agents/ralph|\.overview\.md$)'
```

## Acceptance Criteria

- The clean branch contains no progress-only commits.
- Locale support can be reviewed without local Postgres or NotebookLM changes.
- Local LLM setup can be reviewed without side-panel translation changes.
- Postgres persistence can be reviewed without NotebookLM audio generation.
- NotebookLM podcast generation can be reviewed as an explicit CLI feature.
- Private defaults, especially Traditional Chinese default locale and local Gemma/Qwen model IDs, are isolated from
  generic upstreamable infrastructure.
- `pnpm -s check` passes on the final clean branch.
