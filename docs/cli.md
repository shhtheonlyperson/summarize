---
summary: "CLI model providers and config for Claude, Codex, Gemini, Cursor Agent, OpenClaw, and OpenCode."
read_when:
  - "When changing CLI model integration."
---

# CLI models

Summarize can use installed CLIs (Claude, Codex, Gemini, Cursor Agent, OpenClaw, OpenCode) as local model backends.

## Model ids

- `cli/claude/<model>` (e.g. `cli/claude/sonnet`)
- `cli/codex/<model>` (e.g. `cli/codex/gpt-5.2`)
- `cli/gemini/<model>` (e.g. `cli/gemini/flash`)
- `cli/agent/<model>` (e.g. `cli/agent/auto`)
- `cli/openclaw/<model>` (e.g. `cli/openclaw/main`)
- `openclaw/<model>` (alias for the same OpenClaw CLI path)
- `cli/opencode/<model>` (e.g. `cli/opencode/openai/gpt-5.4`)
- `cli/opencode` (use the OpenCode runtime default model)

Use `--cli [provider]` (case-insensitive) for the provider default, or `--model cli/<provider>/<model>` to pin a model.
If `--cli` is provided without a provider, auto selection is used with CLI enabled.

Codex GPT Fast:

- `--model codex-fast` maps to `cli/codex/gpt-fast`.
- OpenAI fast mode is not a CLI model. Use `--model openai/gpt-5.5 --fast --thinking medium`; see `docs/openai.md`.

## Auto mode

Auto mode can prepend CLI attempts in two ways:

- `cli.enabled` set in config:
  - Auto always uses this list order.
  - Also acts as an allowlist for explicit `--cli` / `--model cli/...`.
- Auto CLI fallback (`cli.autoFallback`, default enabled):
  - Applies only to **implicit** auto (when no model is set via flag/env/config).
  - Default behavior: only when no API key is configured.
  - Default order: `claude, gemini, codex, agent, openclaw, opencode`.
  - Remembers + prioritizes the last successful CLI provider (`~/.summarize/cli-state.json`).

Gemini CLI performance: summarize sets `GEMINI_CLI_NO_RELAUNCH=true` for Gemini CLI runs to avoid a costly self-relaunch (can be overridden by setting it yourself).

Set explicit CLI allowlist:

```json
{
  "cli": { "enabled": ["gemini"] }
}
```

Configure auto CLI fallback:

```json
{
  "cli": {
    "autoFallback": {
      "enabled": true,
      "onlyWhenNoApiKeys": true,
      "order": ["claude", "gemini", "codex", "agent", "openclaw", "opencode"]
    }
  }
}
```

Disable auto CLI fallback:

```json
{
  "cli": { "autoFallback": { "enabled": false } }
}
```

Note: `--model auto` (explicit) does not trigger auto CLI fallback unless `cli.enabled` is set.

## CLI discovery

Binary lookup:

- `CLAUDE_PATH`, `CODEX_PATH`, `GEMINI_PATH` (optional overrides)
- `AGENT_PATH` (optional override)
- `OPENCLAW_PATH` (optional override)
- `OPENCODE_PATH` (optional override)
- Otherwise uses `PATH`

## Attachments (images/files)

When a CLI attempt is used for an image or non-text file, Summarize switches to a
path-based prompt and enables the required tool flags:

- Claude: `--tools Read --dangerously-skip-permissions`
- Gemini: `--yolo` and `--include-directories <dir>`
- Codex: `codex exec --output-last-message ...` and `-i <image>` for images
- Agent: uses built-in file tools in `agent --print` mode (no extra flags)
- OpenCode: `opencode run --format json ... --file <path>` when a file/image path is required

## Config

```json
{
  "cli": {
    "enabled": ["claude", "gemini", "codex", "agent", "openclaw", "opencode"],
    "autoFallback": {
      "enabled": true,
      "onlyWhenNoApiKeys": true,
      "order": ["claude", "gemini", "codex", "agent", "openclaw", "opencode"]
    },
    "codex": { "model": "gpt-5.2" },
    "gemini": { "model": "flash", "extraArgs": ["--verbose"] },
    "claude": {
      "model": "sonnet",
      "binary": "/usr/local/bin/claude",
      "extraArgs": ["--verbose"]
    },
    "agent": {
      "model": "auto",
      "binary": "/usr/local/bin/agent"
    },
    "openclaw": {
      "model": "main",
      "binary": "/usr/local/bin/openclaw"
    },
    "opencode": {
      "binary": "/usr/local/bin/opencode"
    }
  }
}
```

Notes:

- CLI output is treated as text only (no token accounting).
- If a CLI call fails, auto mode falls back to the next candidate.
- Cursor Agent CLI uses the `agent` binary and relies on Cursor CLI auth (login or `CURSOR_API_KEY`).
- Gemini CLI is invoked in headless mode with `--prompt` for compatibility with current Gemini CLI releases.
- OpenClaw uses `openclaw agent --agent <model> --message <prompt> --json` because current OpenClaw requires `-m/--message`; very large extracted inputs are rejected before launch to avoid argv limits.
- OpenCode uses `opencode run --format json`, streams prompt text over stdin, and uses the runtime default model when none is configured.

## Quick smoke test (all CLI providers)

Use a tiny local text file and run each provider with a longer timeout (Gemini can be slower):

```bash
printf "Summarize CLI smoke input.\nOne short paragraph. Reply can be brief.\n" >/tmp/summarize-cli-smoke.txt

summarize --cli codex --plain --timeout 2m /tmp/summarize-cli-smoke.txt
summarize --cli claude --plain --timeout 2m /tmp/summarize-cli-smoke.txt
summarize --cli gemini --plain --timeout 2m /tmp/summarize-cli-smoke.txt
summarize --cli agent --plain --timeout 2m /tmp/summarize-cli-smoke.txt
summarize --cli openclaw --plain --timeout 2m /tmp/summarize-cli-smoke.txt
summarize --cli opencode --plain --timeout 2m /tmp/summarize-cli-smoke.txt
```

If Agent fails with auth, run `agent login` (interactive) or set `CURSOR_API_KEY`.

## Testing and coverage

Last measured: 2026-04-23 03:48:06 PDT.

```bash
pnpm test
pnpm lint
pnpm test:coverage
pnpm test:coverage:html
pnpm check
pnpm build
pnpm test:extension-e2e
```

`pnpm test:coverage` prints the terminal-readable V8 coverage table and writes
`coverage/coverage-summary.json`. `pnpm test:coverage:html` also writes the visual
HTML report at `coverage/index.html`.

Latest coverage summary:

- Statements: 84.77% (16393/19338)
- Branches: 75.12% (12445/16565)
- Functions: 87.49% (2505/2863)
- Lines: 87.91% (15058/17127)

Coverage focuses on `src/**/*.ts`; the Vitest config excludes daemon internals, slide extraction internals, type-only
entrypoints, and external OS/browser integration paths that are covered by higher-level or manual suites.

## Local runtime probe

`summarize local-runtime probe` verifies local HTTP model runtimes before daemon or extension use. It only calls the
runtime model-list endpoint, so it does not start a summarization run or send source content.

Examples:

```bash
summarize local-runtime probe
summarize local-runtime probe ollama
summarize local-runtime probe llama-cpp --base-url http://127.0.0.1:8080/v1
summarize local-runtime probe --json
```

Resolution order:

- If `OPENAI_BASE_URL` or `openai.baseUrl` is configured, probe it as an OpenAI-compatible local runtime.
- If no endpoint is configured, probe the default llama.cpp and Ollama localhost endpoints.
- Use `--base-url` to test a specific endpoint and `--allow-remote` only when intentionally probing a non-local host.

Human output uses `OK`, `WARN`, and `FAIL` lines. JSON output is intended for tests and scripts; CLI tests mock the
probe response and do not require a live model server.

For macOS llama.cpp/Ollama setup, exact local routing config, local-only mode, and extension verification, see
[`docs/local-llm-onboarding.md`](local-llm-onboarding.md).

## Generate free preset (OpenRouter)

`summarize` ships with a built-in preset `free`, backed by OpenRouter `:free` models.
To regenerate the candidate list (and persist it in your config):

```bash
summarize refresh-free
```

Options:

- `--runs 2` (default): extra timing runs per selected model (total runs = 1 + runs)
- `--smart 3` (default): number of “smart-first” picks (rest filled by fastest)
- `--set-default`: also sets `"model": "free"` in `~/.summarize/config.json`
