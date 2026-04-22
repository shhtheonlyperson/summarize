# Progress Log
Started: Wed Apr 22 08:50:58 PDT 2026

## Codebase Patterns
- (add reusable patterns here)

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
