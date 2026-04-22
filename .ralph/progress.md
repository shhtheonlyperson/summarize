# Progress Log
Started: Wed Apr 22 08:50:58 PDT 2026

## Codebase Patterns
- (add reusable patterns here)

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
