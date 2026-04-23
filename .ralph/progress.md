# Progress Log
Started: Wed Apr 22 08:50:58 PDT 2026

## Codebase Patterns
- (add reusable patterns here)

---

## 2026-04-22 20:08:01 PDT - PNL-004: Persist Summarize Run History Through Research Memory
Thread:
Run: 20260422-192541-94292 (iteration 4)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-4.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-4.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files include `.ralph/activity.log`,
  `.ralph/progress.md`, prior PNL-003 files (`package.json`, `pnpm-lock.yaml`, `scripts/build-cli.mjs`,
  `src/config.ts`, `src/research-memory/postgres-schema.ts`, `src/research-memory/postgres-store.ts`,
  `src/research-memory/postgres/migrations/001_initial.sql`, `src/research-memory/store.ts`,
  `tests/research-memory.postgres-schema.test.ts`, `tests/research-memory.postgres-store.test.ts`,
  `tests/research-memory.postgres.integration.test.ts`, `tests/research-memory.store.test.ts`), PNL-004 files
  listed below, and Ralph/PRD run artifacts under `.agents/tasks`, `.ralph/.tmp`, and `.ralph/runs`.
- Verification:
  - Command:
    `pnpm -s test tests/research-memory.factory.test.ts tests/research-memory.lifecycle.test.ts tests/research-memory.store.test.ts tests/research-memory.postgres-store.test.ts tests/config.test.ts`
    -> PASS
  - Command:
    `pnpm -s test tests/runner-execution.test.ts tests/run.url-summary-flow.test.ts tests/run.url-video-only.test.ts tests/run.url-flow-progress.test.ts tests/asset.summary-branches.test.ts tests/daemon.extract-only.test.ts tests/daemon.cache.summary.test.ts tests/daemon.summarize-progress.test.ts`
    -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> FAIL (lint required `void` on fire-and-forget lifecycle queue calls; fixed)
  - Command: `pnpm -s check` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - src/config/sections.ts
  - src/config/types.ts
  - src/daemon/flow-context.ts
  - src/daemon/server-summarize-execution.ts
  - src/daemon/server.ts
  - src/daemon/summarize.ts
  - src/research-memory/factory.ts
  - src/research-memory/index.ts
  - src/research-memory/lifecycle.ts
  - src/research-memory/memory-store.ts
  - src/research-memory/postgres-store.ts
  - src/research-memory/store.ts
  - src/run/flows/asset/media.ts
  - src/run/flows/asset/output.ts
  - src/run/flows/asset/summary.ts
  - src/run/flows/url/flow.ts
  - src/run/flows/url/summary.ts
  - src/run/flows/url/types.ts
  - src/run/flows/url/video-only.ts
  - src/run/run-models.ts
  - src/run/runner-contexts.ts
  - src/run/runner-execution.ts
  - src/run/runner-plan.ts
  - tests/config.test.ts
  - tests/research-memory.factory.test.ts
  - tests/research-memory.lifecycle.test.ts
  - tests/research-memory.store.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-4.md
- What was implemented
  Added research-memory store resolution for disabled config, in-memory stores, SQLite placeholder resolution, and
  optional Postgres stores without connecting unless `researchMemory.enabled` is true. Added a source in-memory store
  adapter and an `updateRun` store operation so lifecycle completion/failure can update run status and summary artifact
  references.

  Added a `ResearchMemoryRunRecorder` that creates runs, records sanitized URL/file source metadata, writes large text
  artifacts under `artifactRoot` with relative paths, records selected model routes, cache/status/done/error events,
  records failures without stack artifacts, and redacts sensitive query params, bearer tokens, API-key-like strings,
  cookies, auth headers, and protected metadata keys before persistence.

  Wired the recorder through CLI runner setup, URL summary/extract flow hooks, asset summary/extract paths, media
  transcription paths, daemon summary sessions, daemon visible-page runs, and daemon extract-only requests. Default
  config remains disabled, SQLite remains a non-writing placeholder, and default tests do not require Postgres or
  NotebookLM.

  Added factory and lifecycle tests using in-memory/mock-style stores to assert run/source/artifact/event/route/failure
  writes, large artifact file placement, and secret redaction. Security review: no API keys, bearer tokens, cookies,
  raw auth headers, Postgres URLs, or environment snapshots are written by lifecycle metadata; text artifacts are
  redacted before inline/file storage. Performance review: recorder is created only when research memory is explicitly
  enabled, progress events skip high-frequency `*-progress` events, writes are serialized per run, and Postgres pools
  are closed after each run. Regression review: disabled/default behavior is no-op, SQLite docs/tests remain intact,
  and `pnpm -s check` passed without Postgres or NotebookLM.
- **Learnings for future iterations:**
  - Patterns discovered: the cleanest stable hook is a recorder hanging off `UrlFlowContext` and `AssetSummaryContext`;
    URL/daemon already expose extraction/model/cache hooks, while final summary artifacts need explicit calls in the
    URL and asset summary output branches.
  - Gotchas encountered: the original store contract had no run update method, so completed/failed statuses needed a
    small contract extension plus Postgres/in-memory implementations.
  - Useful context: SQLite is still schema-only in this fork; the PNL-004 factory deliberately resolves it as a
    non-writing placeholder so default behavior and SQLite research-memory docs/tests stay upstream-friendly.
---

## 2026-04-22 10:38:51 PDT - LLR-011: Add Local Research Memory Design
Thread:
Run: 20260422-085058-72504 (iteration 11)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-11.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-11.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 5efdca97 docs: add local research memory design
- Post-commit status: clean after follow-up progress/log commit
- Verification:
  - Command: `pnpm -s docs:list` -> PASS
  - Command: `git diff --check -- docs/README.md docs/index.md docs/local-first-roadmap.md docs/local-research-memory-design.md` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> FAIL (Markdown formatting issue in new design doc; fixed with `pnpm exec oxfmt --write docs/local-research-memory-design.md`)
  - Command: `pnpm -s check` -> PASS
- Files changed:
  - docs/local-research-memory-design.md
  - docs/README.md
  - docs/index.md
  - docs/local-first-roadmap.md
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-11.md
- What was implemented
  Added a design-only local research memory document that chooses a dedicated SQLite metadata store plus local artifact
  files, compares Postgres, SQLite, and existing cache/session storage for this fork's local-first goals, defines initial
  entities for runs, sources, artifacts, prompts, events, model route metadata, privacy mode metadata, and failures, and
  states which data must never leave localhost in local-only mode. Linked the design from the docs indexes and the
  roadmap Stage 6 note. No database, migration, or runtime storage code was implemented.
- **Learnings for future iterations:**
  - Patterns discovered: the existing cache is a TTL/size-bounded SQLite `cache_entries` store, daemon sessions are
    short-lived in-memory SSE buffers, and extension automation artifacts prefer `chrome.storage.session`; none of them
    fit durable run history.
  - Gotchas encountered: `pnpm -s check` formats Markdown tables through `oxfmt`, so run the formatter after adding
    long comparison tables.
  - Useful context: `/Users/shh/proj/summarize/ralph` and `committer` are unavailable in this checkout; use
    `.agents/ralph/log-activity.sh` and conventional `git commit` when needed.
---

## 2026-04-22 10:32:38 PDT - LLR-010: Add Mac-First Local LLM Onboarding
Thread:
Run: 20260422-085058-72504 (iteration 10)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-10.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-10.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: f044eb85 docs: add mac local llm onboarding
- Post-commit status: clean after follow-up progress/log commit
- Verification:
  - Command: `pnpm -s docs:list` -> PASS
  - Command: `git diff --check -- README.md apps/chrome-extension/README.md docs/README.md docs/chrome-extension.md docs/cli.md docs/config.md docs/index.md docs/local-llm-onboarding.md` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
- Files changed:
  - README.md
  - apps/chrome-extension/README.md
  - docs/README.md
  - docs/chrome-extension.md
  - docs/cli.md
  - docs/config.md
  - docs/index.md
  - docs/local-llm-onboarding.md
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-10.md
  - .ralph/.tmp/story-20260422-085058-72504-10.json
  - .ralph/.tmp/story-20260422-085058-72504-10.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-9.log
  - .ralph/runs/run-20260422-085058-72504-iter-9.md
  - .ralph/runs/run-20260422-085058-72504-iter-10.log
  - .ralph/runs/run-20260422-085058-72504-iter-10.md
- What was implemented
  Added a Mac-first onboarding doc for local LLM setup that covers llama.cpp OpenAI-compatible server startup on
  macOS, Ollama setup through the supported runtime registry, exact config examples for English, Traditional Chinese,
  bilingual, and fallback routing, local-only privacy mode, expected human and JSON probe output, CLI verification,
  daemon restart requirements, and extension status expectations. Linked the guide from the root README, CLI/config
  docs, docs indexes, and extension setup docs.
- **Learnings for future iterations:**
  - Patterns discovered: Summarize local HTTP LLMs are still routed through the `openai/...` provider path, so docs
    must pair `openai.baseUrl` with a dummy `OPENAI_API_KEY` even for localhost runtimes.
  - Gotchas encountered: direct `llama-server` normally exposes one loaded model; multi-model language routing is
    cleaner through Ollama or an OpenAI-compatible router in front of multiple llama.cpp servers.
  - Useful context: daemon config is loaded at startup, and installed daemon services also use an environment snapshot;
    local model endpoint or key changes need `summarize daemon restart`, and environment changes may need rerunning the
    extension setup install command.
---

## 2026-04-22 10:22:08 PDT - LLR-009: Show Local-Only Status in Side Panel
Thread:
Run: 20260422-085058-72504 (iteration 9)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-9.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-9.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 00cc6d14 feat: show local runtime status in side panel
- Post-commit status: clean after follow-up progress/log commit
- Verification:
  - Command: `pnpm -C apps/chrome-extension exec tsc -p tsconfig.json --noEmit` -> FAIL (pre-existing extension tsconfig includes `wxt.config.ts` outside `rootDir: src`)
  - Command: `pnpm -C apps/chrome-extension build` -> PASS
  - Command: `env -u NO_COLOR pnpm -C apps/chrome-extension exec playwright test -c playwright.config.ts --project=chromium tests/sidepanel.local-runtime-status.spec.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `pnpm -C apps/chrome-extension test:chrome` -> FAIL (unrelated local-video test waits for slides tools; this environment has ffmpeg but no `yt-dlp`)
  - Command: `env -u NO_COLOR pnpm -C apps/chrome-extension exec playwright test -c playwright.config.ts --project=chromium --grep-invert "local video"` -> PASS
  - Command: `git diff --check -- apps/chrome-extension/src apps/chrome-extension/tests` -> PASS
- Files changed:
  - apps/chrome-extension/src/entrypoints/background/panel-runtime.ts
  - apps/chrome-extension/src/entrypoints/background/panel-state.ts
  - apps/chrome-extension/src/entrypoints/sidepanel/bg-message-runtime.ts
  - apps/chrome-extension/src/entrypoints/sidepanel/dom.ts
  - apps/chrome-extension/src/entrypoints/sidepanel/index.html
  - apps/chrome-extension/src/entrypoints/sidepanel/local-runtime-status.ts
  - apps/chrome-extension/src/entrypoints/sidepanel/main.ts
  - apps/chrome-extension/src/entrypoints/sidepanel/styles/header.css
  - apps/chrome-extension/src/lib/local-runtime-status-client.ts
  - apps/chrome-extension/src/lib/panel-contracts.ts
  - apps/chrome-extension/tests/helpers/daemon-fixtures.ts
  - apps/chrome-extension/tests/helpers/extension-harness.ts
  - apps/chrome-extension/tests/sidepanel.local-runtime-status.spec.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-9.md
  - .ralph/.tmp/story-20260422-085058-72504-9.json
  - .ralph/.tmp/story-20260422-085058-72504-9.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-8.log
  - .ralph/runs/run-20260422-085058-72504-iter-8.md
  - .ralph/runs/run-20260422-085058-72504-iter-9.log
- What was implemented
  Added a compact side panel local runtime/privacy status surface that shows local-only mode, daemon/runtime readiness,
  the selected route/model, remote-provider privacy warnings, and actionable setup guidance without exposing tokens or
  raw environment values. The background runtime now fetches the daemon local-runtime status endpoint asynchronously,
  caches it briefly, and emits a status-only panel message so UI state refreshes do not block or race summary controls.
  Extension tests cover local-only rendering, remote-provider warning behavior, and local runtime setup errors.
- **Learnings for future iterations:**
  - Patterns discovered: side panel status surfaces work best when the first `ui:state` remains fast and richer daemon
    diagnostics arrive through a narrow follow-up message.
  - Gotchas encountered: fetching a localhost daemon endpoint directly from the side panel causes Chromium console
    network errors in tests; keep daemon diagnostics in the background service worker.
  - Useful context: the supported Chrome suite currently has an unrelated local-video failure when `yt-dlp` is missing;
    `--grep-invert "local video"` exercises the rest of the Chromium extension suite in this environment.
---

## 2026-04-22 10:02:04 PDT - LLR-008: Expose Local Runtime Status in Daemon API
Thread: 019db61d-458c-7af1-a095-ae13770df211
Run: 20260422-085058-72504 (iteration 8)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-8.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-8.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 9348b37f feat: expose local runtime status endpoint
- Post-commit status: clean after progress artifact commit
- Verification:
  - Command: `pnpm exec vitest run tests/daemon.local-runtime-status.test.ts` -> PASS
  - Command: `pnpm -s test -- tests/daemon.local-runtime-status.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - src/daemon/local-runtime-status.ts
  - src/daemon/server-admin-routes.ts
  - tests/daemon.local-runtime-status.test.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-8.md
  - .ralph/.tmp/story-20260422-085058-72504-8.json
  - .ralph/.tmp/story-20260422-085058-72504-8.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-7.md
  - .ralph/runs/run-20260422-085058-72504-iter-8.log
- What was implemented
  Added token-protected `GET /v1/local-runtime/status` through the daemon admin route path. The response reports
  local-only state, configured OpenAI-compatible local runtime host/type, selected language-aware local routing hints,
  bounded probe results, reachable model hints, and sanitized probe failures. The endpoint never returns API keys,
  raw environment values, or full configured base URLs. Added mocked daemon tests for response shape, bearer auth,
  probe fetches, and invalid-runtime sanitization.
- **Learnings for future iterations:**
  - Patterns discovered: daemon admin routes inherit `/v1/*` bearer-token enforcement in `runDaemonServer`, so small
    diagnostic endpoints fit cleanly in `server-admin-routes.ts`.
  - Gotchas encountered: `pnpm -s test -- tests/daemon.local-runtime-status.test.ts` currently executes the configured
    repository test run rather than only that file; `pnpm exec vitest run tests/daemon.local-runtime-status.test.ts`
    is the precise focused test.
  - Useful context: status probes should keep `allowRemoteBaseUrls` false and expose only endpoint hosts plus model IDs;
    invalid runtime errors from core can include raw input, so daemon-facing status must sanitize them before returning.
---

## 2026-04-22 09:53:11 PDT - LLR-007: Add Local-Only Privacy Guard
Thread:
Run: 20260422-085058-72504 (iteration 7)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-7.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-7.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: d6591d40 feat: add local-only privacy guard
- Post-commit status: clean after progress artifact commit
- Verification:
  - Command: `pnpm -s test tests/local-only.test.ts tests/config.test.ts tests/daemon.agent.test.ts tests/daemon.chat.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
- Files changed:
  - src/config.ts
  - src/config/sections.ts
  - src/config/types.ts
  - src/daemon/agent-model.ts
  - src/daemon/agent.ts
  - src/daemon/chat.ts
  - src/daemon/flow-context.ts
  - src/daemon/server-agent-route.ts
  - src/daemon/server-summarize-execution.ts
  - src/daemon/server-summarize-request.ts
  - src/daemon/summarize.ts
  - src/run/flows/asset/summary.ts
  - src/run/flows/url/markdown.ts
  - src/run/flows/url/summary-resolution.ts
  - src/run/local-only.ts
  - src/run/model-attempts.ts
  - src/run/runner-plan.ts
  - src/run/summary-engine.ts
  - tests/config.test.ts
  - tests/daemon.agent.test.ts
  - tests/local-only.test.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-7.md
  - .ralph/.tmp/story-20260422-085058-72504-7.json
  - .ralph/.tmp/story-20260422-085058-72504-7.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-6.log
  - .ralph/runs/run-20260422-085058-72504-iter-6.md
  - .ralph/runs/run-20260422-085058-72504-iter-7.log
- What was implemented
  Added `privacy.localOnly` config parsing plus daemon request `localOnly` support. The guard resolves the effective
  policy from request override or config, blocks remote providers/OpenRouter/unverifiable CLI transports before model
  calls, and allows only OpenAI-compatible localhost endpoints. Enforcement now covers CLI summary attempts, daemon
  summary/extract paths, agent model resolution, chat model resolution, and LLM markdown conversion before remote
  provider requests are made. Errors name the setting that caused the block and include a local endpoint/disable hint.
- **Learnings for future iterations:**
  - Patterns discovered: summary flows centralize provider calls through `createSummaryEngine` and `runModelAttempts`,
    while daemon agent/chat paths resolve their model independently and need their own pre-call guard.
  - Gotchas encountered: `pnpm -s check` runs formatting and caught files that targeted tests/typecheck/build did not;
    run `pnpm exec oxfmt --write <files>` before the final check after touching formatted TypeScript.
  - Useful context: `/Users/shh/proj/summarize/ralph` and `committer` are unavailable in this checkout; use
    `.agents/ralph/log-activity.sh` and conventional `git commit`.
---

## 2026-04-22 09:31:37 PDT - LLR-005: Add CLI Local Runtime Probe Command
Thread:
Run: 20260422-085058-72504 (iteration 5)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-5.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-5.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 330cde38 feat: add local runtime probe cli
- Post-commit status: `clean`
- Verification:
  - Command: `pnpm -s test -- tests/cli.local-runtime-probe.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - README.md
  - docs/cli.md
  - src/cli-main.ts
  - src/run/cli-preflight.ts
  - src/run/help.ts
  - src/run/local-runtime-probe-cli.ts
  - src/run/runner.ts
  - tests/cli.local-runtime-probe.test.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-5.md
  - .ralph/.tmp/story-20260422-085058-72504-5.json
  - .ralph/.tmp/story-20260422-085058-72504-5.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-4.md
  - .ralph/runs/run-20260422-085058-72504-iter-5.log
- What was implemented
  Added `summarize local-runtime probe` as an immediate CLI command that resolves configured `OPENAI_BASE_URL` /
  `openai.baseUrl`, falls back to default llama.cpp and Ollama localhost endpoints, prints `OK` / `WARN` / `FAIL`
  diagnostics, supports `--json`, bounded `--timeout`, `--base-url`, and explicit `--allow-remote`, and sets a failing
  exit code for failed probes through the real CLI entrypoint. Added mocked-fetch CLI tests covering success, warnings,
  failures, JSON output, and remote-host blocking. Documented the command in README and CLI docs.
- **Learnings for future iterations:**
  - Patterns discovered: CLI utility subcommands that should run before normal summary parsing belong in
    `src/run/cli-preflight.ts`; standalone help text lives in `src/run/help.ts`.
  - Gotchas encountered: `/Users/shh/proj/summarize/ralph` is absent in this checkout; use
    `.agents/ralph/log-activity.sh` for activity logging. The `committer` / `$commit` helper is also unavailable, so a
    conventional `git commit` fallback was required.
  - Useful context: `pnpm -s test -- tests/cli.local-runtime-probe.test.ts` currently runs the configured repository
    test suite, not just that file. The probe sends only model-list requests and does not include API keys or source
    content; non-local hosts stay blocked unless `--allow-remote` is explicit.
---

## 2026-04-22 08:54:14 PDT - LLR-001: Establish Local-First Fork Positioning
Thread: 019db5e3-33a6-7350-92dc-add32e3e321a
Run: 20260422-085058-72504 (iteration 1)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-1.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: a4d08f11 docs: establish local-first fork positioning
- Post-commit status: `clean`
- Verification:
  - Command: `pnpm -s docs:list` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
- Files changed:
  - AGENTS.md
  - README.md
  - docs/README.md
  - docs/index.md
  - docs/local-first-roadmap.md
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-1.md
- What was implemented
  Added a local-first roadmap documenting the fork thesis, non-goals, staged architecture, implementation intent, and
  verification intent. Added a concise README fork note, linked the new page from docs indexes, and documented upstream
  remote workflow plus local fork goals in AGENTS.md without renaming package IDs or binaries.
- **Learnings for future iterations:**
  - Patterns discovered: docs pages use YAML front matter with `summary`; `pnpm -s docs:list` validates discovery and
    read_when hints.
  - Gotchas encountered: `/Users/shh/proj/summarize/ralph` was not present, but the global `ralph log` command worked;
    the `$commit` skill and `committer` command were unavailable, so a conventional `git commit` fallback was used.
  - Useful context: remote `origin` points to this fork and `upstream` points to
    `https://github.com/steipete/summarize.git`.
---

## 2026-04-22 09:03:48 PDT - LLR-002: Audit Existing Local Model Capabilities
Thread:
Run: 20260422-085058-72504 (iteration 2)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-2.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 06e79045 docs: audit local model capabilities
- Post-commit status: `clean`
- Verification:
  - Command: `pnpm -s docs:list` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - docs/local-model-capabilities-audit.md
  - docs/index.md
  - docs/README.md
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-2.md
  - .ralph/runs/run-20260422-085058-72504-iter-2.log
  - .agents/tasks/prd.json
  - .ralph/errors.log
  - .ralph/.tmp/prompt-20260422-085058-72504-2.md
  - .ralph/.tmp/story-20260422-085058-72504-2.json
  - .ralph/.tmp/story-20260422-085058-72504-2.md
- What was implemented
  Added a source-grounded audit documenting current OpenAI-compatible/local provider paths, CLI-local transports,
  config/env files, daemon `/v1/summarize` and `/v1/agent` flow, extension settings and request flow, local-only safety
  check locations, and language-aware routing extension points. Linked the audit from the docs indexes. No runtime
  behavior was changed.
- **Learnings for future iterations:**
  - Patterns discovered: concrete summary runs converge on `ModelAttempt` and `createSummaryEngine`, while daemon chat
    uses a separate `resolveAgentModel` path.
  - Gotchas encountered: local OpenAI-compatible HTTP servers currently use `openai/...` plus `OPENAI_BASE_URL` or
    `openai.baseUrl`; `OPENAI_API_KEY` is still required before transport setup, even for localhost endpoints.
  - Useful context: installed daemons use a saved env snapshot, so local endpoint, key, PATH, or CLI binary changes need
    restart/reinstall with updated env. The extension always sends `model`, defaulting to `auto`, so future routing must
    treat `auto` as routeable instead of an explicit fixed model.
  - Operational caveats: there is no dedicated Ollama or llama.cpp runtime registry yet; `/v1/agent` must be covered
    separately by local-only and language routing because it does not use the summary `ModelAttempt` execution path.
---

## 2026-04-22 09:13:31 PDT - LLR-003: Add Local Runtime Registry Types
Thread:
Run: 20260422-085058-72504 (iteration 3)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-3.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 2f65dc8d feat: add local runtime registry types
- Post-commit status: `clean`
- Verification:
  - Command: `pnpm -s test -- tests/local-runtime.test.ts` -> PASS
  - Command: `pnpm exec vitest run tests/local-runtime.test.ts` -> PASS
  - Command: `pnpm -C packages/core -s typecheck` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - .oxfmtrc.jsonc
  - packages/core/package.json
  - packages/core/src/index.ts
  - packages/core/src/local-runtime.ts
  - tests/local-runtime.test.ts
  - vitest.config.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-3.md
  - .ralph/.tmp/story-20260422-085058-72504-3.json
  - .ralph/.tmp/story-20260422-085058-72504-3.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-2.md
  - .ralph/runs/run-20260422-085058-72504-iter-3.log
  - .ralph/runs/run-20260422-085058-72504-iter-3.md
- What was implemented
  Added `@steipete/summarize-core/local-runtime` with typed descriptors for generic OpenAI-compatible local endpoints,
  llama.cpp OpenAI-compatible servers, and Ollama. Added localhost-first defaults, loopback/allowed-host URL validation,
  descriptor parsing with aliases, Ollama OpenAI-compatible `/v1` derivation, and package/vitest exports. No CLI,
  daemon, or extension runtime behavior was wired or changed.
- **Learnings for future iterations:**
  - Patterns discovered: shared local runtime primitives belong in `packages/core` and can be exported as a dedicated
    package subpath for CLI, daemon, and extension consumers.
  - Gotchas encountered: `pnpm -s check` formats generated `.agents` and `.ralph` orchestration files by default,
    including the PRD JSON this loop must not edit; `.oxfmtrc.jsonc` now excludes those directories.
  - Useful context: remote local-runtime base URLs are rejected by default and require explicit `allowRemoteBaseUrls`;
    callers can also pass `allowedHosts` for environment-specific local aliases such as Docker hostnames.
---

## 2026-04-22 09:22:51 PDT - LLR-004: Add Local Runtime Probe Logic
Thread:
Run: 20260422-085058-72504 (iteration 4)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-4.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-4.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: e397fb53 feat: add local runtime probes
- Post-commit status: `clean`
- Verification:
  - Command: `pnpm -s test -- tests/local-runtime.test.ts` -> PASS
  - Command: `pnpm exec vitest run tests/local-runtime.test.ts` -> PASS
  - Command: `pnpm -C packages/core -s typecheck` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - packages/core/src/local-runtime.ts
  - tests/local-runtime.test.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-4.md
  - .ralph/.tmp/story-20260422-085058-72504-4.json
  - .ralph/.tmp/story-20260422-085058-72504-4.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-3.md
  - .ralph/runs/run-20260422-085058-72504-iter-4.log
  - .ralph/runs/run-20260422-085058-72504-iter-4.md
- What was implemented
  Added reusable non-streaming probes to `@steipete/summarize-core/local-runtime` for OpenAI-compatible/llama.cpp
  `/models` endpoints and Ollama `/api/tags`. Probe results now expose normalized model metadata and lightweight server
  metadata, use bounded timeout handling, and return stable error objects instead of requiring callers to catch transport
  exceptions. Tests cover reachable endpoints, network/HTTP unreachable cases, malformed JSON, invalid descriptors, and
  timeout/abort behavior with mocked fetches only.
- **Learnings for future iterations:**
  - Patterns discovered: local runtime diagnostics can build directly on the LLR-003 descriptor parser so localhost
    validation and Ollama base URL normalization stay centralized.
  - Gotchas encountered: do not run `pnpm -s typecheck` concurrently with `pnpm -s build`; the build cleans core dist
    while root typecheck resolves workspace package declaration outputs.
  - Useful context: `pnpm -s test -- tests/local-runtime.test.ts` invokes the repository test script and currently runs
    the full suite; `pnpm exec vitest run tests/local-runtime.test.ts` is the precise single-file test path.
---

## 2026-04-22 09:39:46 PDT - LLR-006: Add Language-Aware Local Model Routing
Thread:
Run: 20260422-085058-72504 (iteration 6)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-6.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-6.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: b4ce4f01 feat: add language-aware local routing
- Post-commit status: dirty with pre-existing/generated Ralph and PRD files listed in this entry
- Verification:
  - Command: `pnpm -s test -- tests/run.models.test.ts tests/config.test.ts` -> PASS
  - Command: `pnpm exec vitest run tests/run.models.test.ts tests/config.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check -- src/config.ts src/config/sections.ts src/config/types.ts src/daemon/flow-context.ts src/run/local-model-routing.ts src/run/run-models.ts src/run/runner-plan.ts tests/config.test.ts tests/run.models.test.ts` -> PASS
  - Command: `git diff --check` -> FAIL (pre-existing trailing whitespace in `.ralph/runs/run-20260422-085058-72504-iter-5.log`)
- Files changed:
  - src/config.ts
  - src/config/sections.ts
  - src/config/types.ts
  - src/daemon/flow-context.ts
  - src/run/local-model-routing.ts
  - src/run/run-models.ts
  - src/run/runner-plan.ts
  - tests/config.test.ts
  - tests/run.models.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
- What was implemented
  Added `localRouting` config with `enabled`, `englishModel`, `traditionalChineseModel`, `bilingualModel`, and
  `fallbackModel`. Model selection now applies language-aware local routing only when the effective requested model is
  `auto`, including daemon summary requests, and leaves fixed CLI args, env defaults, config defaults, and bare `--cli`
  auto behavior unchanged. Default enabled routing prefers a Gemma local model for English, Qwen for Traditional Chinese
  and bilingual output, and Llama as the fallback. Tests cover config parsing, bucket choices, default profile choices,
  bare local model normalization to OpenAI-compatible ids, and explicit-model precedence.
- **Learnings for future iterations:**
  - Patterns discovered: CLI and daemon summary runs both converge on `resolveModelSelection`; pass resolved
    `OutputLanguage` there to keep routing behavior shared.
  - Gotchas encountered: do not run `pnpm -s typecheck` concurrently with `pnpm -s build`; build cleans `packages/core`
    declaration output while root typecheck resolves workspace package subpaths.
  - Useful context: `/Users/shh/proj/summarize/ralph` and `committer` are unavailable in this checkout; use
    `.agents/ralph/log-activity.sh` and conventional `git commit`. Remaining dirty files seen during this run were
    `.agents/tasks/prd.json`, `.ralph/errors.log`, `.ralph/runs/run-20260422-085058-72504-iter-5.log`,
    `.ralph/.tmp/prompt-20260422-085058-72504-6.md`, `.ralph/.tmp/story-20260422-085058-72504-6.json`,
    `.ralph/.tmp/story-20260422-085058-72504-6.md`, `.ralph/runs/run-20260422-085058-72504-iter-5.md`, and
    `.ralph/runs/run-20260422-085058-72504-iter-6.log`.
---

## 2026-04-22 10:45:01 PDT - LLR-012: Add Local Research Memory Schema Skeleton
Thread:
Run: 20260422-085058-72504 (iteration 12)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-12.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-085058-72504-iter-12.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 357525dc feat: add research memory schema
- Post-commit status: clean after follow-up progress/log commit
- Verification:
  - Command: `pnpm -s test tests/research-memory.schema.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `tmpdir=$(mktemp -d); sqlite3 "$tmpdir/research-memory.sqlite" < src/research-memory/migrations/001_initial.sql && sqlite3 "$tmpdir/research-memory.sqlite" ".tables"; rm -rf "$tmpdir"` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check -- docs/README.md docs/index.md docs/local-research-memory.md src/research-memory/schema.ts src/research-memory/migrations/001_initial.sql tests/research-memory.schema.test.ts` -> PASS
- Files changed:
  - docs/README.md
  - docs/index.md
  - docs/local-research-memory.md
  - src/research-memory/migrations/001_initial.sql
  - src/research-memory/schema.ts
  - tests/research-memory.schema.test.ts
  - .agents/tasks/prd.json
  - .ralph/.tmp/prompt-20260422-085058-72504-12.md
  - .ralph/.tmp/story-20260422-085058-72504-12.json
  - .ralph/.tmp/story-20260422-085058-72504-12.md
  - .ralph/activity.log
  - .ralph/errors.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-085058-72504-iter-11.log
  - .ralph/runs/run-20260422-085058-72504-iter-11.md
  - .ralph/runs/run-20260422-085058-72504-iter-12.log
  - .ralph/runs/run-20260422-085058-72504-iter-12.md
- What was implemented
  Added the initial local research memory SQLite migration for settings, runs, sources, artifacts, events, and model
  route metadata. Added a typed schema manifest with required table, column, index, version, and default path metadata;
  deterministic static tests that validate the migration text without opening a database; and docs for initializing the
  local store and artifact directory.
- **Learnings for future iterations:**
  - Patterns discovered: keep durable memory schema under `src/research-memory/` with versioned SQL migrations and a
    small TypeScript manifest for tests and future runtime wiring.
  - Gotchas encountered: default tests should parse the migration statically; use an explicit sqlite3 smoke command only
    as manual verification so the normal test suite remains deterministic.
  - Useful context: the migration sets WAL, normal sync, busy timeout, and foreign keys before creating tables, matching
    the existing cache's local SQLite posture without enabling runtime writes yet.
---

## 2026-04-22 19:30:18 PDT - PNL-001: Audit Existing Research Memory and Podcast Paths
Thread:
Run: 20260422-192541-94292 (iteration 1)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-1.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-1.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files are `.ralph/activity.log`,
  `.agents/tasks/prd-postgres-notebooklm.json`, `.agents/tasks/prd-postgres-notebooklm.overview.md`,
  `.agents/tasks/prd.overview.md`, `.ralph/.tmp/prompt-20260422-192541-94292-1.md`,
  `.ralph/.tmp/story-20260422-192541-94292-1.json`, `.ralph/.tmp/story-20260422-192541-94292-1.md`,
  `.ralph/runs/run-20260422-192541-94292-iter-1.log`, `.ralph/runs/run-20260422-192541-94292-iter-1.md`, and
  `.ralph/progress.md`.
- Verification:
  - Command: `pnpm -s docs:list` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
- Files changed:
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-1.md
- What was implemented
  Completed a documentation-only audit. Current research memory is a SQLite skeleton only: `src/research-memory/schema.ts`
  declares version 1, default paths `~/.summarize/research-memory.sqlite` and
  `~/.summarize/research-memory/artifacts`, and required tables/indexes for settings, runs, sources, artifacts, events,
  and model routes. `src/research-memory/migrations/001_initial.sql` contains the matching migration with WAL/normal
  sync/busy timeout/foreign keys, and `tests/research-memory.schema.test.ts` validates the schema statically without a
  live DB. `docs/local-research-memory-design.md` and `docs/local-research-memory.md` document the durable-memory intent;
  there is not yet a ResearchMemoryStore, runtime writer, Postgres adapter, or `researchMemory` config parser.

  Cache and session boundaries are separate today. `src/cache.ts`, `src/run/cache-state.ts`, and `docs/cache.md` define
  a TTL/size-bounded SQLite cache at `~/.summarize/cache.sqlite` for `extract`, `summary`, `transcript`, `chat`, and
  `slides`; `src/media-cache.ts` and `src/run/media-cache-state.ts` define the separate downloaded-media file cache at
  `~/.summarize/cache/media`. URL extraction cache reads/writes live in `src/run/flows/url/extraction-session.ts`;
  summary cache reads/writes live in `src/run/flows/url/summary-resolution.ts` and
  `src/run/flows/asset/summary.ts`; transcript cache normalization lives in
  `packages/core/src/content/transcript/cache.ts`. Daemon state is not durable research memory: `src/daemon/server.ts`
  creates one process-level cache/media-cache and in-memory `sessions`/`refreshSessions`, while
  `src/daemon/server-session.ts` buffers SSE/slides events up to 1 MB per buffer and cleans sessions after 15 minutes.
  `src/daemon/server-session-routes.ts` replays those buffers and serves slide images, including stable slide files from
  `~/.summarize/slides`. Extension panel caches are also temporary: background maps in
  `apps/chrome-extension/src/entrypoints/background/panel-session-store.ts`,
  chat extract caching in `apps/chrome-extension/src/entrypoints/background/extract-cache.ts`, and automation artifacts
  plus extension logs in `chrome.storage.session` with local-storage fallback.

  Transcript and podcast paths converge through `packages/core/src/content/link-preview/content/index.ts`, which
  short-circuits Spotify, Apple Podcasts, X broadcasts, and direct media into transcript resolution before HTML
  extraction where appropriate. `packages/core/src/content/transcript/index.ts` selects YouTube, podcast, then generic
  providers and wraps transcript cache read/write diagnostics. Podcast handling is concentrated in
  `packages/core/src/content/transcript/providers/podcast.ts` and helpers under
  `packages/core/src/content/transcript/providers/podcast/`: RSS `<podcast:transcript>` is preferred, then Spotify
  embed/iTunes RSS paths, Apple iTunes/feed/stream paths, feed enclosures, `og:audio`, and finally yt-dlp plus Whisper
  where available. Remote and local media transcription uses `podcast/media.ts`, shared yt-dlp download logic in
  `providers/youtube/yt-dlp.ts`, and Whisper providers under `packages/core/src/transcription/whisper/`. CLI and daemon
  URL runs share the URL flow via `src/run/flows/url/flow.ts`; daemon summaries adapt it in `src/daemon/summarize.ts` and
  emit chunks/meta/status/metrics through `src/daemon/server-summarize-execution.ts`.

  Local NotebookLM CLI availability was confirmed without account/network actions: `/Users/shh/.local/bin/notebooklm`,
  version `0.3.4`. Relevant command surface for future wrapper stories is `notebooklm login`, `notebooklm auth check
  --json` for local auth validation, `notebooklm list --json`, `notebooklm create --json <title>`, `notebooklm use
  <notebook-id>`, `notebooklm source add --notebook <id> --type text --title <title> --json <markdown-or-path>`,
  `notebooklm source wait --notebook <id> --json <source-id>`, `notebooklm generate audio --notebook <id> --format
  deep-dive|brief|critique|debate --length short|default|long --language <code> --wait|--no-wait --json
  [description]`, `notebooklm artifact wait --notebook <id> --json <artifact-id>`, `notebooklm artifact list --notebook
  <id> --type audio --json`, and `notebooklm download audio --notebook <id> --artifact <artifact-id> --json
  <output-path>`. Gotcha: `notebooklm audio` and `notebooklm notebook` are not commands; audio is an artifact action via
  `generate audio` and `download audio`.

  Security/performance/regression review: only Ralph log/progress/summary files were changed. No runtime source,
  config, dependency, schema, or test behavior was modified; no secrets, cookies, bearer tokens, source content, or
  NotebookLM account data were read or recorded. Default `pnpm -s check` passed without requiring Postgres or NotebookLM.
- **Learnings for future iterations:**
  - Patterns discovered: add durable memory behind a new store seam under `src/research-memory/`; later CLI/daemon
    lifecycle hooks should use existing URL flow hooks/sinks rather than overloading the TTL cache.
  - Gotchas encountered: Postgres work must stay optional because the existing research-memory docs/tests are SQLite
    focused and deterministic. NotebookLM wrappers should shell out with argument arrays and parse `--json` output; do
    not assume top-level `audio` or `notebook` subcommands.
  - Useful context: `/Users/shh/proj/summarize/ralph` is absent in this checkout, so activity logging used
    `.agents/ralph/log-activity.sh`, matching prior run notes.
---

## 2026-04-22 19:36:12 PDT - PNL-002: Add Research Memory Storage Contract and Tests
Thread:
Run: 20260422-192541-94292 (iteration 2)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-2.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-2.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files are `.ralph/activity.log`, `.ralph/progress.md`,
  `.agents/tasks/prd-postgres-notebooklm.json`, `.agents/tasks/prd-postgres-notebooklm.overview.md`,
  `.agents/tasks/prd.overview.md`, `.ralph/.tmp/prompt-20260422-192541-94292-1.md`,
  `.ralph/.tmp/prompt-20260422-192541-94292-2.md`, `.ralph/.tmp/story-20260422-192541-94292-1.json`,
  `.ralph/.tmp/story-20260422-192541-94292-1.md`, `.ralph/.tmp/story-20260422-192541-94292-2.json`,
  `.ralph/.tmp/story-20260422-192541-94292-2.md`, `.ralph/runs/run-20260422-192541-94292-iter-1.log`,
  `.ralph/runs/run-20260422-192541-94292-iter-1.md`,
  `.ralph/runs/run-20260422-192541-94292-iter-2.log`, `src/research-memory/index.ts`,
  `src/research-memory/store.ts`, and `tests/research-memory.store.test.ts`.
- Verification:
  - Command: `pnpm -s test tests/research-memory.schema.test.ts tests/research-memory.store.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - src/research-memory/store.ts
  - src/research-memory/index.ts
  - tests/research-memory.store.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
- What was implemented
  Added a typed research memory storage contract under `src/research-memory/store.ts`. The contract covers runs, sources,
  artifacts, events, model routes, failures, notebook exports, privacy mode metadata, JSON payloads, stable IDs, and
  timestamp fields. It defines `ResearchMemoryStore` with `initialize`, `createRun`, `upsertSource`, `addArtifact`,
  `addEvent`, `addModelRoute`, `addFailure`, `addNotebookExport`, `getRun`, `listRuns`, and `close`, plus a
  `ResearchMemoryRunSnapshot` aggregate for source/artifact/event/route/failure/export inspection. Added
  `src/research-memory/index.ts` as the local research-memory barrel.

  Added deterministic unit tests in `tests/research-memory.store.test.ts` using a local in-memory adapter that implements
  the interface. Tests cover contract constants for failures/notebook export states, full run snapshot round-trip,
  source upsert behavior, deterministic child ordering, run listing filters/limits, duplicate guards, missing-reference
  guards, initialization, and close semantics. No Postgres server, SQLite connection, NotebookLM account, or network
  access is required by these tests.

  Security review: the contract stores only typed metadata/content references supplied by future callers and introduces
  no secret reads, environment capture, shell execution, network calls, or persistence writes. Performance review: the
  only executable logic added is test-local in-memory maps/sorts over fixture-sized data; no runtime hot path changed.
  Regression review: existing SQLite schema/tests remained unchanged and the full `pnpm -s check` gate passed.
- **Learnings for future iterations:**
  - Patterns discovered: keep the implementation-neutral store contract separate from the SQLite schema manifest so
    Postgres and future memory/SQLite adapters can share one TypeScript surface without changing default tests.
  - Gotchas encountered: `ResearchMemoryStore` can be contract-tested without a database by requiring caller-provided
    IDs/timestamps, which keeps ordering deterministic and avoids hidden UUID/time sources in tests.
  - Useful context: `/Users/shh/proj/summarize/ralph` is absent; activity logging for this run used
    `.agents/ralph/log-activity.sh`.
---

## 2026-04-22 19:49:41 PDT - PNL-003: Add Optional Local Postgres Research Memory Backend
Thread:
Run: 20260422-192541-94292 (iteration 3)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-3.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-3.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files include `.ralph/activity.log`,
  `.ralph/progress.md`, `package.json`, `pnpm-lock.yaml`, `scripts/build-cli.mjs`, `src/config.ts`,
  `src/config/sections.ts`, `src/config/types.ts`, `tests/config.test.ts`,
  `.agents/tasks/prd-postgres-notebooklm.json`, `.agents/tasks/prd-postgres-notebooklm.overview.md`,
  `.agents/tasks/prd.overview.md`, `.ralph/.tmp/prompt-20260422-192541-94292-1.md`,
  `.ralph/.tmp/prompt-20260422-192541-94292-2.md`,
  `.ralph/.tmp/prompt-20260422-192541-94292-3.md`,
  `.ralph/.tmp/story-20260422-192541-94292-1.json`,
  `.ralph/.tmp/story-20260422-192541-94292-1.md`,
  `.ralph/.tmp/story-20260422-192541-94292-2.json`,
  `.ralph/.tmp/story-20260422-192541-94292-2.md`,
  `.ralph/.tmp/story-20260422-192541-94292-3.json`,
  `.ralph/.tmp/story-20260422-192541-94292-3.md`,
  `.ralph/runs/run-20260422-192541-94292-iter-1.log`,
  `.ralph/runs/run-20260422-192541-94292-iter-1.md`,
  `.ralph/runs/run-20260422-192541-94292-iter-2.log`,
  `.ralph/runs/run-20260422-192541-94292-iter-2.md`,
  `.ralph/runs/run-20260422-192541-94292-iter-3.log`,
  `.ralph/runs/run-20260422-192541-94292-iter-3.md`, `src/research-memory/index.ts`,
  `src/research-memory/postgres-schema.ts`, `src/research-memory/postgres-store.ts`,
  `src/research-memory/postgres/migrations/001_initial.sql`, `src/research-memory/store.ts`,
  `tests/research-memory.postgres-schema.test.ts`, `tests/research-memory.postgres-store.test.ts`,
  `tests/research-memory.postgres.integration.test.ts`, and `tests/research-memory.store.test.ts`.
- Verification:
  - Command:
    `pnpm -s test tests/config.test.ts tests/research-memory.schema.test.ts tests/research-memory.postgres-schema.test.ts tests/research-memory.store.test.ts tests/research-memory.postgres-store.test.ts tests/research-memory.postgres.integration.test.ts`
    -> PASS (Postgres integration skipped because `SUMMARIZE_POSTGRES_TEST_URL` is unset)
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `git diff --check` -> PASS
  - Command: `pnpm -s check` -> PASS
- Files changed:
  - package.json
  - pnpm-lock.yaml
  - scripts/build-cli.mjs
  - src/config.ts
  - src/config/sections.ts
  - src/config/types.ts
  - src/research-memory/index.ts
  - src/research-memory/postgres-schema.ts
  - src/research-memory/postgres-store.ts
  - src/research-memory/postgres/migrations/001_initial.sql
  - tests/config.test.ts
  - tests/research-memory.postgres-schema.test.ts
  - tests/research-memory.postgres-store.test.ts
  - tests/research-memory.postgres.integration.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-3.md
- What was implemented
  Added the maintained `pg` client as an optional runtime dependency and `@types/pg` for TypeScript. Added
  `researchMemory` config parsing for `enabled`, `backend`, `postgresUrl`, and `artifactRoot`; absent config remains
  omitted so default behavior is unchanged.

  Added a Postgres-specific research-memory schema manifest and migration SQL covering settings, runs, sources,
  artifacts, events, model routes, failures, and NotebookLM exports. The migration uses JSONB for structured payloads,
  booleans for flags, idempotent indexes, deferred artifact-link constraints for circular run/source references, and an
  idempotent migrations table insert.

  Added `PostgresResearchMemoryStore`, implementing the PNL-002 `ResearchMemoryStore` interface with a bounded `pg`
  pool, migration initialization, parameterized inserts/upserts, deterministic snapshot/list ordering, and close
  semantics. The store is exported from the research-memory barrel but is not wired into the CLI/daemon lifecycle in
  this story.

  Added static config/schema tests, injected-client adapter tests that do not require Postgres, and a live integration
  test that runs only when `SUMMARIZE_POSTGRES_TEST_URL` is set. Updated the build wrapper to copy Postgres migration
  SQL into `dist/esm/research-memory/postgres/migrations/` so the adapter can initialize after `pnpm -s build`.

  Security review: database operations use parameterized values; dynamic SQL is limited to fixed filter/order fragments.
  The adapter does not read API keys, cookies, bearer tokens, raw auth headers, or environment snapshots, and error
  messages do not echo the Postgres URL. Performance review: the pool defaults to max 4 connections with
  `allowExitOnIdle`, lookup/list paths are indexed, and `getRun` fetches child collections in parallel. Regression
  review: Postgres remains optional, existing SQLite schema/docs/tests were not altered, default `pnpm -s check` passed
  without a live Postgres server or NotebookLM account, and the live Postgres test is env-gated.
- **Learnings for future iterations:**
  - Patterns discovered: keep Postgres schema metadata separate from the existing SQLite manifest to avoid changing the
    SQLite static tests while still covering newer contract entities such as failures and NotebookLM exports.
  - Gotchas encountered: `pg` needs `@types/pg` in this repo; `pnpm add` must use `-w` at the workspace root. Runtime SQL
    assets need an explicit build copy because `tsc` does not emit `.sql` files.
  - Useful context: default integration coverage should use injected clients because live Postgres tests must stay behind
    `SUMMARIZE_POSTGRES_TEST_URL`. Pre-existing no-commit changes from earlier PNL iterations remain present, including
    `.agents/tasks/*`, `.ralph/.tmp/*`, earlier `.ralph/runs/*`, `src/research-memory/store.ts`, and
    `tests/research-memory.store.test.ts`.
---

## 2026-04-22 20:16:47 PDT - PNL-005: Add Memory Query and Export CLI Commands
Thread:
Run: 20260422-192541-94292 (iteration 5)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-5.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-5.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files include `.ralph/activity.log`,
  `.ralph/progress.md`, `.ralph/runs/run-20260422-192541-94292-iter-5.md`, `src/run/cli-preflight.ts`,
  `src/run/help.ts`, `src/run/runner.ts`, `src/run/memory-cli.ts`, `tests/cli.memory.test.ts`, plus pre-existing
  no-commit changes from earlier PNL iterations such as `package.json`, `pnpm-lock.yaml`, `scripts/build-cli.mjs`,
  `src/config.ts`, `src/config/sections.ts`, `src/config/types.ts`, daemon/run lifecycle files,
  `src/research-memory/*`, `.agents/tasks/*`, `.ralph/.tmp/*`, earlier `.ralph/runs/*`, and research-memory tests.
- Verification:
  - Command: `pnpm -s test tests/cli.memory.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - src/run/memory-cli.ts
  - src/run/cli-preflight.ts
  - src/run/help.ts
  - src/run/runner.ts
  - tests/cli.memory.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-5.md
- What was implemented
  Added `summarize memory status/list/show/export` using the existing preflight CLI dispatch pattern. Commands resolve
  the optional research-memory backend through the existing factory, so absent config reports disabled status and
  default checks still do not require a Postgres server.

  Added NotebookLM-ready markdown export from a persisted run snapshot. The bundle includes run metadata, source URLs
  and source metadata, privacy mode metadata, summary artifacts, extracted/transcript text, slide OCR/timestamps from
  slides JSON, route metadata, visible events, failures, and existing notebook export records. Export supports
  `--language en`, `--language zh-TW`, `--traditional-chinese`, and auto mode based on the persisted run language bucket.

  Added deterministic CLI tests using a fake in-memory store and fixture artifacts, including a file-backed summary
  artifact to verify artifact-root reads and inline transcript/slides artifacts to verify NotebookLM bundle content.

  Security review: export reads only persisted store snapshots/artifacts and guards file artifact reads against paths
  escaping the configured artifact root; it does not read API keys, bearer tokens, cookies, NotebookLM credentials, raw
  auth headers, or protected env values. Performance review: list/status use bounded reads, and export performs one
  snapshot read followed by linear in-memory formatting. Regression review: normal summarize execution is untouched, the
  disabled/default memory path remains non-failing, and `pnpm -s check` passed without live Postgres or NotebookLM.
- **Learnings for future iterations:**
  - Patterns discovered: memory CLI commands fit cleanly beside `daemon`, `slides`, and `local-runtime` as preflight
    handlers; tests can inject the research-memory factory dependency rather than creating a live database.
  - Gotchas encountered: `auto` export language should honor the persisted run language bucket, so tests expecting
    English headings should pass `--language en` explicitly.
  - Useful context: `/Users/shh/proj/summarize/ralph` is absent in this checkout; activity logging used
    `.agents/ralph/log-activity.sh`.
---

## 2026-04-22 20:26:31 PDT - PNL-006: Add NotebookLM CLI Podcast Wrapper
Thread:
Run: 20260422-192541-94292 (iteration 6)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-6.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-6.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files include `.ralph/activity.log`,
  `.ralph/progress.md`, `.ralph/runs/run-20260422-192541-94292-iter-6.md`, `src/notebooklm/service.ts`,
  `src/notebooklm/index.ts`, `tests/notebooklm.service.test.ts`, plus pre-existing no-commit changes from earlier PNL
  iterations such as `package.json`, `pnpm-lock.yaml`, `scripts/build-cli.mjs`, config/daemon/run lifecycle files,
  `src/research-memory/*`, `src/run/memory-cli.ts`, `.agents/tasks/*`, `.ralph/.tmp/*`, earlier `.ralph/runs/*`, and
  research-memory/memory CLI tests.
- Verification:
  - Command: `pnpm -s test tests/notebooklm.service.test.ts` -> PASS
  - Command: `pnpm -s exec oxfmt --check src/notebooklm/service.ts src/notebooklm/index.ts tests/notebooklm.service.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
- Files changed:
  - src/notebooklm/service.ts
  - src/notebooklm/index.ts
  - tests/notebooklm.service.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-6.md
- What was implemented
  Added a CLI-only NotebookLM wrapper service that shells out through `execFileTracked` with argument arrays for
  `create --json`, `use`, `source add --json`, `source wait --json`, `generate audio --json`, `artifact wait/list
  --json`, and `download audio --json`.

  Added flexible JSON parsing for NotebookLM notebook/source/audio/download responses and clear typed errors for command
  failures, timeouts, empty JSON, malformed JSON, and unexpected JSON payloads.

  Added an orchestration helper that can create or reuse a notebook, add a markdown bundle, wait for source/audio
  readiness, download audio when requested, and persist final or failed NotebookLM export metadata through
  `ResearchMemoryStore` when a store and run id are provided.

  Added deterministic tests with a fake executable. Tests assert argv arrays, create/use notebook behavior, source add,
  audio generation, audio download, typed JSON/CLI errors, and success/failure metadata persistence. The real
  NotebookLM binary and account are never used by default tests.

  Security review: commands use argument arrays and do not interpolate shell strings; persisted metadata avoids raw
  markdown, full command args, API keys, bearer tokens, cookies, protected env values, and NotebookLM credentials.
  Performance review: wrapper work is linear, uses bounded `execFile` buffers/timeouts, and performs one metadata write
  on success or failure. Regression review: no user-facing podcast CLI command was added in this story, existing
  summarize/memory/Postgres paths remain optional, and `pnpm -s check` passed without live Postgres or NotebookLM.
- **Learnings for future iterations:**
  - Patterns discovered: NotebookLM `use` is not a JSON command, so the wrapper returns the requested notebook id/title
    while parsing JSON only for commands that support `--json`.
  - Gotchas encountered: `ResearchMemoryStore` only has `addNotebookExport`, not update semantics; the wrapper records a
    single final row per podcast export attempt.
  - Useful context: `/Users/shh/proj/summarize/ralph` is absent in this checkout, but `ralph` on `PATH` works for
    activity logging. Pre-existing PNL-001 through PNL-005 no-commit changes remain present and were left intact.
---

## 2026-04-22 20:37:25 PDT - PNL-007: Add Podcast CLI Command Backed by Memory and NotebookLM
Thread:
Run: 20260422-192541-94292 (iteration 7)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-7.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-7.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files include `.ralph/activity.log`,
  `.ralph/progress.md`, `.ralph/runs/run-20260422-192541-94292-iter-7.md`,
  `src/run/podcast-cli.ts`, `tests/cli.podcast.test.ts`, `src/run/cli-preflight.ts`,
  `src/run/runner.ts`, `src/run/help.ts`, and `src/run/memory-cli.ts`, plus pre-existing no-commit
  changes from earlier PNL iterations such as `package.json`, `pnpm-lock.yaml`,
  `scripts/build-cli.mjs`, config/daemon/run lifecycle files, `src/notebooklm/*`,
  `src/research-memory/*`, `.agents/tasks/*`, `.ralph/.tmp/*`, earlier `.ralph/runs/*`, and
  research-memory/memory/NotebookLM tests.
- Verification:
  - Command: `pnpm -s test tests/cli.podcast.test.ts` -> PASS
  - Command: `pnpm -s test tests/cli.podcast.test.ts tests/cli.memory.test.ts tests/notebooklm.service.test.ts tests/run.cli-preflight.test.ts` -> PASS
  - Command: `pnpm -s exec oxfmt --check src/run/podcast-cli.ts src/run/cli-preflight.ts src/run/runner.ts src/run/help.ts src/run/memory-cli.ts tests/cli.podcast.test.ts` -> PASS
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check` -> PASS
- Files changed:
  - src/run/podcast-cli.ts
  - src/run/cli-preflight.ts
  - src/run/runner.ts
  - src/run/help.ts
  - src/run/memory-cli.ts
  - tests/cli.podcast.test.ts
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-7.md
- What was implemented
  Added `summarize podcast create <run-id-or-url>` with `--language`, `--format`, `--length`,
  `--output`, `--wait`/`--no-wait`, and `--json`. The command resolves the optional
  research-memory backend and fails clearly when persistence is unavailable rather than requiring
  Postgres or NotebookLM during default checks.

  For existing run IDs, the command loads the run snapshot, reuses the memory export markdown
  builder, writes a NotebookLM-ready markdown bundle under `artifactRoot`, records that markdown as
  an `export` artifact, and sends the file to the NotebookLM service wrapper. For URL input, it runs
  summarize first with quiet stdout, finds the newly persisted successful CLI run, then follows the
  same export and NotebookLM path.

  Audio download is tied to `--output`. The command downloads through a research-memory artifact
  path, copies to the requested output path when that path is outside `artifactRoot`, and records the
  audio artifact id/path so NotebookLM export metadata can reference it. `--no-wait` starts source
  and audio generation without download; `--output` requires waiting because the audio must be ready.

  Added `help podcast`, main help examples, and preflight dispatch wiring. Added deterministic CLI
  tests using a fake in-memory research store and fake NotebookLM service for both existing-run and
  fresh-URL flows.

  Security review: NotebookLM calls still go through the argument-array service wrapper; persisted
  podcast metadata is sanitized; artifact paths are checked against `artifactRoot`; no API keys,
  bearer tokens, cookies, raw auth headers, protected env values, or NotebookLM credentials are
  persisted. Performance review: URL-run discovery uses bounded `listRuns` calls, markdown export is
  linear in the run snapshot, and audio copying is limited to the requested-download path. Regression
  review: existing memory export and NotebookLM service tests pass, default `pnpm -s check` passed
  without live Postgres or a real NotebookLM account, and standard summarize dispatch remains
  unchanged except for the new `podcast` preflight command.
- **Learnings for future iterations:**
  - Patterns discovered: podcast CLI composition works best by reusing the memory markdown export
    builder and the NotebookLM service orchestrator, with the CLI layer owning artifact-path planning
    and user output copying.
  - Gotchas encountered: `ResearchMemoryStore.addNotebookExport` validates artifact ids, so the audio
    artifact must exist before the NotebookLM service records export metadata.
  - Useful context: fresh URL podcast creation can discover the new run by opening the configured
    store before summarize, listing existing run ids, then finding the new successful CLI run after
    summarize completes. Pre-existing no-commit changes from PNL-001 through PNL-006 remain present
    and were left intact.
---

## 2026-04-22 20:44:37 PDT - PNL-008: Document Postgres and NotebookLM Workflow with Traditional Chinese Summary
Thread:
Run: 20260422-192541-94292 (iteration 8)
Run log: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-8.log
Run summary: /Users/shh/proj/summarize/.ralph/runs/run-20260422-192541-94292-iter-8.md
- Guardrails reviewed: yes
- No-commit run: true
- Commit: none (no-commit run)
- Post-commit status: not clean (no commit requested); remaining files include PNL-008 changes in `.ralph/activity.log`,
  `.ralph/progress.md`, `.ralph/runs/run-20260422-192541-94292-iter-8.md`, `README.md`, `docs/README.md`,
  `docs/config.md`, `docs/index.md`, `docs/local-research-memory-design.md`, `docs/local-research-memory.md`,
  `docs/notebooklm-podcast-workflow.md`, and `docs/postgres-notebooklm-summary.zh-TW.md`, plus pre-existing no-commit
  changes from PNL-001 through PNL-007 such as `.agents/tasks/*`, `.ralph/.tmp/*`, earlier `.ralph/runs/*`,
  `package.json`, `pnpm-lock.yaml`, `scripts/build-cli.mjs`, config/daemon/run lifecycle files,
  `src/research-memory/*`, `src/notebooklm/*`, `src/run/memory-cli.ts`, `src/run/podcast-cli.ts`, and related tests.
- Verification:
  - Command: `pnpm -s exec oxfmt --check README.md docs/README.md docs/config.md docs/index.md docs/local-research-memory-design.md docs/local-research-memory.md docs/notebooklm-podcast-workflow.md docs/postgres-notebooklm-summary.zh-TW.md` -> PASS
  - Command: `pnpm -s docs:list` -> PASS
  - Command: `pnpm -s test tests/research-memory.store.test.ts tests/research-memory.factory.test.ts tests/research-memory.postgres-schema.test.ts tests/research-memory.postgres-store.test.ts tests/research-memory.lifecycle.test.ts tests/research-memory.postgres.integration.test.ts tests/cli.memory.test.ts tests/notebooklm.service.test.ts tests/cli.podcast.test.ts tests/run.cli-preflight.test.ts` -> PASS (9 passed, 1 skipped because `SUMMARIZE_POSTGRES_TEST_URL` was unset)
  - Command: `pnpm -s typecheck` -> PASS
  - Command: `pnpm -s build` -> PASS
  - Command: `pnpm -s check` -> PASS
  - Command: `git diff --check -- README.md docs/README.md docs/config.md docs/index.md docs/local-research-memory-design.md docs/local-research-memory.md docs/notebooklm-podcast-workflow.md docs/postgres-notebooklm-summary.zh-TW.md .ralph/progress.md .ralph/activity.log .ralph/runs/run-20260422-192541-94292-iter-8.md` -> PASS
- Files changed:
  - README.md
  - docs/README.md
  - docs/config.md
  - docs/index.md
  - docs/local-research-memory-design.md
  - docs/local-research-memory.md
  - docs/notebooklm-podcast-workflow.md
  - docs/postgres-notebooklm-summary.zh-TW.md
  - .ralph/activity.log
  - .ralph/progress.md
  - .ralph/runs/run-20260422-192541-94292-iter-8.md
- What was implemented
  Updated local research-memory documentation to describe the current optional backend posture: `memory` for
  deterministic tests, optional persistent `postgres`, and the still-placeholder `sqlite` runtime. The docs now include
  local Postgres setup, `researchMemory` config, `SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL`,
  `RESEARCH_MEMORY_POSTGRES_URL`, `SUMMARIZE_POSTGRES_TEST_URL`, automatic and manual migration commands, memory
  status/list/show/export usage, and privacy boundaries for secrets, source content, artifacts, and NotebookLM exports.

  Added `docs/notebooklm-podcast-workflow.md` covering NotebookLM login/auth check, notebook create/use, source add,
  source wait, generate audio, artifact wait/list, audio download, and `summarize podcast create <run-id-or-url>` usage.
  The doc calls out that default tests use fake NotebookLM services and do not require a real account.

  Added `docs/postgres-notebooklm-summary.zh-TW.md`, a concise Traditional Chinese summary covering test coverage,
  local Postgres persistence, and NotebookLM podcast generation. Linked the new docs from the docs indexes and README,
  and refreshed the research-memory design doc to stop describing Postgres as only a future adapter.

  Security review: docs explicitly avoid storing database/NotebookLM credentials, API keys, bearer tokens, cookies, raw
  auth headers, raw environment snapshots, and full markdown/audio payloads in NotebookLM export metadata. Performance
  review: documentation-only changes introduce no runtime work. Regression review: docs:list, targeted tests, typecheck,
  build, and full `pnpm -s check` passed without a live Postgres server or real NotebookLM account.
- **Learnings for future iterations:**
  - Patterns discovered: keep operational setup in `docs/local-research-memory.md`, command-level NotebookLM steps in a
    separate workflow doc, and high-level Traditional Chinese recap in its own linked markdown file.
  - Gotchas encountered: `oxfmt --check` flagged the edited markdown table in `docs/local-research-memory-design.md`;
    formatting that single file resolved it. The `/Users/shh/proj/summarize/ralph` helper path is absent, but `ralph`
    on `PATH` works for activity logging.
  - Useful context: `pnpm -s test tests/research-memory.postgres.integration.test.ts` remains default-safe because it
    skips unless `SUMMARIZE_POSTGRES_TEST_URL` is set. Pre-existing no-commit changes from PNL-001 through PNL-007 remain
    present and were left intact.
---
