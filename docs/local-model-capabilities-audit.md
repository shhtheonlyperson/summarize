---
summary: "Source-grounded audit of local and OpenAI-compatible model paths."
read_when:
  - "When adding local runtime descriptors, probes, local-only privacy checks, or language-aware routing."
  - "When changing daemon or extension model request flow."
---

# Local Model Capabilities Audit

Audit date: 2026-04-22. Scope: source inspection only; no runtime behavior changes.

## Current Provider Paths

### OpenAI-compatible HTTP paths

- `openai/...` model IDs are parsed by `src/model-spec.ts` and `src/llm/model-id.ts`.
- `OPENAI_BASE_URL` or `openai.baseUrl` in `~/.summarize/config.json` overrides the OpenAI endpoint through
  `src/run/run-env.ts`, `packages/core/src/openai/base-url.ts`, and `src/llm/providers/openai.ts`.
- `src/llm/providers/openai.ts` treats custom OpenAI base URLs as chat-completions endpoints. This is the current path
  for llama.cpp-style OpenAI-compatible local servers.
- `openai/...` still requires an `OPENAI_API_KEY` before transport setup, even when `OPENAI_BASE_URL` points at
  localhost and the server ignores bearer auth.
- OpenAI document attachments are only allowed for `api.openai.com`; `src/llm/providers/openai.ts` rejects attachments
  when the OpenAI base URL host is not `api.openai.com`.
- `openrouter/...` is a separate forced transport in `src/model-spec.ts` and `src/model-auto.ts`; it resolves to the
  OpenAI-compatible OpenRouter API with `OPENROUTER_API_KEY`.
- `zai/...`, `nvidia/...`, and `github-copilot/...` use OpenAI-compatible transport helpers through
  `src/llm/provider-profile.ts`, `src/llm/providers/models.ts`, and `src/run/summary-engine.ts`, but they carry their
  own required env keys and default base URLs.

There is no dedicated Ollama provider, llama.cpp provider, or local runtime registry in the current source. Local model
server usage is therefore configured as an OpenAI-compatible `openai/...` endpoint override.

### Local CLI model paths

- `cli/<provider>/<model>` is parsed in `src/model-spec.ts`; supported CLI providers are declared in
  `src/config/types.ts`.
- CLI execution lives in `src/llm/cli.ts`, with binary overrides from provider-specific config or env such as
  `CODEX_PATH`, `GEMINI_PATH`, `OPENCLAW_PATH`, and `OPENCODE_PATH`.
- Auto CLI fallback is configured by `cli.autoFallback` and implemented by `src/model-auto-cli.ts`.
- CLI transports are local process executions, not OpenAI-compatible HTTP runtimes. They should be considered separately
  from localhost model servers for probing and local-only policy.

## Config Files And Env

- User defaults: `~/.summarize/config.json`, parsed by `src/config.ts`, `src/config/types.ts`,
  `src/config/model.ts`, and `src/config/sections.ts`.
- Config env defaults: `env` and legacy `apiKeys` are merged by `src/config/env.ts`; process env wins.
- OpenAI-compatible endpoint config: `openai.baseUrl`, `openai.useChatCompletions`, and env
  `OPENAI_BASE_URL` / `OPENAI_USE_CHAT_COMPLETIONS`.
- Provider endpoint overrides: `nvidia.baseUrl`, `anthropic.baseUrl`, `google.baseUrl`, `xai.baseUrl`, `zai.baseUrl`,
  plus corresponding env variables in `src/run/run-env.ts`.
- Daemon pairing and env snapshot: `~/.summarize/daemon.json`, read/written by `src/daemon/config.ts`. Installed daemon
  env keys are selected in `src/daemon/env-snapshot.ts` and merged in `src/daemon/env-merge.ts`.
- Extension settings: `chrome.storage.local` key `settings`, normalized and saved by
  `apps/chrome-extension/src/lib/settings.ts`.

Operational caveat: daemon installs snapshot the environment. Changing `OPENAI_BASE_URL`, local server API keys, PATH, or
CLI binary paths requires reinstalling or restarting the daemon with an updated snapshot, depending on how the service was
installed.

## CLI Request Flow

1. `src/run/runner.ts` normalizes argv and calls `prepareRunEnvironment` in `src/run/runner-setup.ts`.
2. `prepareRunEnvironment` loads config and merges config env defaults before Commander parses flags.
3. `src/run/runner-plan.ts` resolves flags, output language, env status, and model selection.
4. `src/run/run-models.ts` resolves explicit model, env `SUMMARIZE_MODEL`, config `model`, named presets, or default
   `auto`.
5. Fixed and auto choices become `ModelAttempt` objects in `src/model-spec.ts`, `src/model-auto.ts`,
   `src/run/flows/url/summary-resolution.ts`, or `src/run/flows/asset/summary-attempts.ts`.
6. `src/run/model-attempts.ts` skips missing env for auto mode or errors for fixed models.
7. `src/run/summary-engine.ts` runs the selected attempt through `src/llm/cli.ts` for `cli/...` or through
   `src/llm/generate-text.ts` / `src/llm/generate-text-stream.ts` for native/OpenRouter transports.

## Daemon Request Flow

1. `summarize daemon install` writes `~/.summarize/daemon.json` and snapshots selected env in
   `src/daemon/cli.ts`.
2. `summarize daemon run` merges the saved env snapshot and starts `runDaemonServer` in `src/daemon/server.ts`.
3. `POST /v1/summarize` is token-authenticated, parsed by `src/daemon/server-summarize-request.ts`, and executed by
   `src/daemon/server-summarize-execution.ts`.
4. `streamSummaryForUrl` and `streamSummaryForVisiblePage` in `src/daemon/summarize.ts` build a
   `UrlFlowContext` with `src/daemon/flow-context.ts`.
5. `src/daemon/flow-context.ts` mirrors CLI setup: config/env resolution, output language, model selection, metrics, and
   `createSummaryEngine`.
6. Summary output streams through daemon sessions as SSE from `src/daemon/server-session.ts` and
   `src/daemon/server-session-routes.ts`.
7. `POST /v1/agent` is handled separately by `src/daemon/server-agent-route.ts`,
   `src/daemon/agent-model.ts`, and `src/daemon/agent.ts`.

Operational caveat: `/v1/summarize` uses the shared summary engine path, but `/v1/agent` resolves model transport in
`src/daemon/agent-model.ts` and calls pi-ai directly. Local-only checks and language routing must cover both paths if
chat is in scope.

## Extension Setting Flow

1. Options UI loads/saves `Settings` through `apps/chrome-extension/src/lib/settings.ts`.
2. Options form wiring lives in `apps/chrome-extension/src/entrypoints/options/main.ts`,
   `form-state.ts`, `bindings.ts`, and `model-presets.ts`.
3. Side-panel summarization runs in `apps/chrome-extension/src/entrypoints/background/panel-summarize.ts`.
4. Summary request bodies are built by `apps/chrome-extension/src/lib/daemon-payload.ts`, which sends `model`, `length`,
   `language`, prompt overrides, and advanced overrides to `/v1/summarize`.
5. Hover summaries use `apps/chrome-extension/src/entrypoints/background/hover-controller.ts`; they reuse settings but
   force `length: "short"`, `mode: "url"`, and a short timeout.
6. Automation's `summarize` tool builds a direct `/v1/summarize` body in
   `apps/chrome-extension/src/automation/tools.ts`.
7. Side-panel chat sends `model`, `length`, and `language` to `/v1/agent` from
   `apps/chrome-extension/src/entrypoints/background/panel-chat.ts`.

Operational caveat: the extension always sends a model setting, whose default is `auto`. Future routing should treat
`model: "auto"` as routeable rather than as an explicit fixed-model override.

## Local-only Safety Check Locations

Local-only enforcement should run after model selection has produced a concrete transport/model attempt and before any
provider transport or remote model probe starts.

- Shared attempt classification: add reusable local-runtime predicates near future local runtime registry code in
  `@steipete/summarize-core`; consume them from the CLI package.
- CLI URL and asset summaries: enforce against `ModelAttempt` values before `runSummaryAttempt` in
  `src/run/flows/url/summary-resolution.ts` and `src/run/flows/asset/summary.ts`, or centralize it in
  `src/run/model-attempts.ts` with enough context to produce useful errors.
- Summary engine fallback: keep a defensive check in `src/run/summary-engine.ts` before CLI/native transport setup, since
  this is the final shared choke point for CLI and daemon summary runs.
- Daemon `/v1/summarize`: parse a future request override in `src/daemon/server-summarize-request.ts`, thread it through
  `src/daemon/flow-context.ts`, and rely on the shared attempt-level guard.
- Daemon `/v1/agent`: add equivalent enforcement in `src/daemon/agent-model.ts` because agent model resolution bypasses
  `ModelAttempt` execution for non-summary chat.
- Extension-initiated runs: add settings and payload fields in `apps/chrome-extension/src/lib/settings.ts` and
  `apps/chrome-extension/src/lib/daemon-payload.ts`, but keep the daemon as the authority. Cover side panel, hover,
  automation summarize tool, and chat requests.

Classification should distinguish:

- Local OpenAI-compatible HTTP endpoints: `openai/...` with a base URL whose hostname is `localhost`, `127.0.0.1`, or
  another explicitly allowed loopback/local host.
- Remote OpenAI-compatible gateways: `api.openai.com`, OpenRouter, GitHub Models, NVIDIA, Z.AI, or arbitrary nonlocal
  base URLs.
- Local process transports: `cli/...`, subject to separate policy because provider CLIs may themselves call cloud models.

## Language-aware Routing Locations

Existing language parsing lives in `packages/core/src/language.ts`; CLI and daemon flows consume it through
`src/run/run-config.ts`, `src/run/run-settings.ts`, and `src/daemon/flow-context.ts`.

Routing should happen before concrete model attempts are built, while preserving explicit model precedence:

- CLI: `src/run/runner-plan.ts` already resolves `outputLanguage` before calling `resolveModelSelection`. A routing
  helper can be applied there when no explicit `--model` / `--cli` fixed model is supplied.
- Daemon summaries: `src/daemon/flow-context.ts` has `languageRaw`, config fallback language, and `modelOverride`.
  Compute final output language before `resolveModelSelection` if routing needs the same explicit-model precedence as
  CLI.
- Auto attempts: use existing `ModelConfig` and `AutoRule` shapes from `src/config/types.ts` if routing is implemented
  as model presets or auto-rule selection; add a dedicated config section if routing needs named language buckets.
- Recommended config extension point: `SummarizeConfig` in `src/config/types.ts`, parsed by `src/config/sections.ts`.
  Runtime descriptor primitives should live in `packages/core` once LLR-003 adds them, but persisted CLI config parsing
  currently lives in the CLI package.
- Agent chat: `apps/chrome-extension/src/entrypoints/background/panel-chat.ts` sends `language`, but
  `src/daemon/server-agent-route.ts` and `src/daemon/agent-model.ts` do not currently consume it. If chat should route
  by output language, the agent route must parse and thread language first.

Suggested route buckets for later stories:

- English: match `OutputLanguage` fixed tags/labels for English aliases.
- Traditional Chinese: match `zh-TW`, `zh-Hant`, and labels containing Traditional Chinese.
- Bilingual: add an explicit config/request hint; current `OutputLanguage` has no structured bilingual mode beyond
  free-form labels.
- Fallback local model: use when language is `auto`, unknown, or a bucket-specific model is not configured.

## Relevant Tests For Future Changes

- Config parsing and model selection: existing Vitest coverage under `tests/` for config, model auto, run models, and
  daemon payload/request behavior.
- Extension settings and payloads: `apps/chrome-extension/tests/options.spec.ts` and side-panel tests.
- Extension automated path: `pnpm -C apps/chrome-extension test:chrome`.
- Default repository gates: `pnpm -s typecheck`, `pnpm -s build`, and `pnpm -s check` for runtime/config/daemon changes.
