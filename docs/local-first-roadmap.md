---
summary: "Local-first fork thesis, non-goals, and staged architecture."
read_when:
  - "When changing local runtime, bilingual routing, privacy, or research memory behavior."
---

# Local-first roadmap

This fork keeps Summarize useful as a generic URL, file, media, CLI, and browser side-panel summarizer while making
private local research workflows first-class.

The intended value proposition is:

- Preserve upstream extraction, media handling, daemon, side-panel, CLI, and publishing compatibility.
- Add private local LLM setup for localhost OpenAI-compatible runtimes, llama.cpp-style servers, and Ollama-style
  workflows as they are implemented.
- Add language-aware local model routing for English, Traditional Chinese, and bilingual outputs without overriding an
  explicit user-selected model.
- Add local research memory so runs, sources, summaries, route metadata, and failures can be reviewed locally over time.

## Thesis

Summarize already has strong source ingestion and broad provider support. The fork should not replace that foundation.
Instead, it should make the private path obvious, diagnosable, and durable:

1. A user can run summarization against local model servers without guessing which config key or endpoint is active.
2. A bilingual user can prefer different local models for English, Traditional Chinese, and bilingual outputs.
3. A research workflow can keep its history, artifacts, prompts, model routes, and failures on the user's machine.
4. Upstream-compatible package names and binaries remain stable unless a later release plan explicitly changes them.

## Non-goals

- Do not remove upstream generic summarization, cloud provider support, media extraction, or side-panel behavior.
- Do not rename npm package IDs such as `@steipete/summarize` or `@steipete/summarize-core` in this roadmap phase.
- Do not rename the `summarize` or `summarizer` binaries in this roadmap phase.
- Do not make every workflow local-only by default before diagnostics, routing, and user-facing status exist.
- Do not implement durable storage as part of this positioning work; storage design and schema are separate stories.
- Do not require a live local LLM server for default tests.

## Staged Architecture

### Stage 0: Positioning

Document the fork's local-first purpose, upstream compatibility expectations, and implementation boundaries. This page is
the source for product intent; `AGENTS.md` stays operational.

### Stage 1: Source-grounded audit

Audit existing local and OpenAI-compatible model paths, daemon request flow, extension settings flow, and config loading
before adding new abstractions. The goal is to extend existing seams instead of duplicating provider logic.

### Stage 2: Runtime registry and probes

Add shared core types for local runtime descriptors, localhost-first endpoint validation, and bounded probe functions.
Probe tests should mock network calls and avoid requiring a live llama.cpp or Ollama server.

### Stage 3: Language-aware local routing

Add config for English, Traditional Chinese, bilingual, and fallback local model choices. Explicit `--model` and request
model selections keep current precedence; routing only applies when local routing is enabled and no explicit model was
chosen.

### Stage 4: Local-only privacy guard and daemon status

Add a local-only mode that blocks remote provider calls before transport setup. Expose token-authenticated daemon status
for local-only state, selected route hints, endpoint host, and probe results without leaking keys or raw environment
values.

### Stage 5: Side-panel visibility and onboarding

Show whether a side-panel run will stay local, which route/model is selected, and what setup issue blocks local
execution. Add Mac-first onboarding for local model servers and verification commands.

### Stage 6: Local research memory

Design and then add a local storage layer for runs, sources, artifacts, prompt metadata, model route metadata, privacy
mode metadata, and failures. Local-only mode must keep protected run metadata and artifacts on localhost.

## Implementation Intent

- Keep reusable local runtime and routing primitives in `@steipete/summarize-core` so the CLI, daemon, and extension can
  share behavior without importing CLI-only dependencies.
- Prefer `127.0.0.1` or localhost endpoints for built-in local runtime defaults.
- Preserve current model/config precedence and existing provider behavior unless a story explicitly changes it.
- Shape user-facing errors around the setting that caused a local runtime, routing, or privacy decision.
- Keep status responses and logs free of API keys and sensitive environment values.

## Verification Intent

Documentation-only positioning changes can use no-op-safe verification such as `pnpm -s docs:list`, with
`pnpm -s typecheck` when a story asks for it.

Runtime stories should add deterministic unit tests with mocked probes. Side-panel stories should run the extension build
and supported Chrome extension test path when feasible.
