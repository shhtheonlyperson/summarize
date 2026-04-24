---
summary: "Mac-first local LLM setup for llama.cpp, Ollama, routing, probes, daemon, and extension."
read_when:
  - "When setting up local LLM runtimes, language-aware local routing, or local-only mode."
---

# Mac-first local LLM onboarding

This guide connects a local LLM server to the Summarize CLI, daemon, and browser extension on macOS.

Summarize talks to localhost model servers through the existing OpenAI-compatible provider path. In practice:

- Set `openai.baseUrl` or `OPENAI_BASE_URL` to the local `/v1` endpoint.
- Use `openai/<local-model-name>` model ids, or bare local model names in `localRouting`.
- Set a dummy `OPENAI_API_KEY`; local servers usually ignore it, but Summarize still requires the key before provider setup.
- Restart the daemon after changing `~/.summarize/config.json` or the environment; the daemon reads config at startup.

The config file is `~/.summarize/config.json`. It is JSON5, but comments are rejected.

## llama.cpp server

Install the server on macOS:

```bash
brew install llama.cpp
```

Download a chat/instruct GGUF model, then start `llama-server` on loopback. The `--alias` value is the model id returned
by `/v1/models`, so use the same name in Summarize config.

```bash
mkdir -p ~/Models/llama.cpp
export SUMMARIZE_LLAMA_GGUF="$HOME/Models/llama.cpp/qwen3-local.gguf"

llama-server \
  -m "$SUMMARIZE_LLAMA_GGUF" \
  --host 127.0.0.1 \
  --port 8080 \
  --alias qwen3-local \
  -c 8192
```

Probe the server before running summaries:

```bash
summarize local-runtime probe llama-cpp --base-url http://127.0.0.1:8080/v1
```

Expected output shape:

```text
Local runtime probe
OK llama.cpp server (llama-cpp)
  Endpoint: http://127.0.0.1:8080/v1/models
  Models: qwen3-local (1)
  Server: status=200 server=llama.cpp
```

Direct `llama-server` normally exposes one loaded model. For a single-model local-only setup, route every language bucket
to that alias:

```json
{
  "model": "auto",
  "openai": {
    "baseUrl": "http://127.0.0.1:8080/v1"
  },
  "env": {
    "OPENAI_API_KEY": "sk-local"
  },
  "localRouting": {
    "enabled": true,
    "englishModel": "qwen3-local",
    "traditionalChineseModel": "qwen3-local",
    "bilingualModel": "qwen3-local",
    "fallbackModel": "qwen3-local"
  },
  "privacy": {
    "localOnly": true
  }
}
```

If you run multiple llama.cpp models behind an OpenAI-compatible router, keep the same config shape and set each bucket
to the model id exposed by that router.

## Ollama

Ollama is supported by the implemented local runtime registry and probe command. Install the macOS app, then start it
once so the `ollama` CLI and localhost server are available. If you manage GUI apps with Homebrew:

```bash
brew install --cask ollama
open -a Ollama
```

Pull local models. These names are examples; keep the config model names equal to `ollama list`.

```bash
ollama pull gemma3
ollama pull qwen3:8b
ollama pull llama3.2
ollama list
```

Probe Ollama through its native tags endpoint:

```bash
summarize local-runtime probe ollama
```

Expected output shape:

```text
Local runtime probe
OK Ollama (ollama)
  Endpoint: http://127.0.0.1:11434/api/tags
  Models: gemma3, qwen3:8b, llama3.2 (3)
  Server: status=200 version=...
```

Summaries use Ollama's OpenAI-compatible API at `http://127.0.0.1:11434/v1`:

```json
{
  "model": "auto",
  "openai": {
    "baseUrl": "http://127.0.0.1:11434/v1"
  },
  "env": {
    "OPENAI_API_KEY": "ollama"
  },
  "localRouting": {
    "enabled": true,
    "englishModel": "gemma3",
    "traditionalChineseModel": "qwen3:8b",
    "bilingualModel": "qwen3:8b",
    "fallbackModel": "llama3.2"
  },
  "privacy": {
    "localOnly": true
  }
}
```

## Verify routing

Leave `--model` unset, or set it to `auto`, when you want language-aware routing. Explicit fixed models keep precedence.

```bash
summarize "https://example.com" --language en --plain
summarize "https://example.com" --language "Traditional Chinese" --plain
summarize "https://example.com" --language "en+zh-TW bilingual" --plain
```

With the Ollama example above:

- English routes to `openai/gemma3`.
- Traditional Chinese routes to `openai/qwen3:8b`.
- Bilingual output routes to `openai/qwen3:8b`.
- `auto` or unknown language routes to `openai/llama3.2`.

## Gemma/Qwen local router notes

This fork's local development setup can put multiple local model servers behind one OpenAI-compatible router. The
current private default is:

- English: `openai/gemma4-31b`
- Traditional Chinese: `openai/qwen3.6-27b`
- Bilingual: `openai/qwen3.6-27b`
- Fallback: `openai/gemma4-31b`

Keep these values in `~/.summarize/config.json` as model aliases, not absolute model paths:

```json
{
  "model": "auto",
  "openai": {
    "baseUrl": "http://127.0.0.1:8090/v1",
    "useChatCompletions": true
  },
  "env": {
    "OPENAI_API_KEY": "sk-local"
  },
  "localRouting": {
    "enabled": true,
    "englishModel": "gemma4-31b",
    "traditionalChineseModel": "qwen3.6-27b",
    "bilingualModel": "qwen3.6-27b",
    "fallbackModel": "gemma4-31b"
  }
}
```

The router may rewrite aliases such as `openai/qwen3.6-27b` to the backend's real model path before proxying to the
model server. Keep that rewrite in the router config, not in Summarize's repo defaults or browser UI wording. If a
retired alias such as `openai/qwen3.6-35b-a3b` appears in `~/.summarize/config.json`, replace it with
`qwen3.6-27b` and restart the daemon.

For the browser extension, the side-panel UI language is also the summary routing language. When the UI language is
Traditional Chinese, the extension sends `zh-tw` to the daemon and the local runtime status should render:

```text
Local runtime
Route: Traditional Chinese -> openai/qwen3.6-27b
Runtime reachable: OpenAI-compatible local endpoint at 127.0.0.1:8090.
```

With the Traditional Chinese UI selected, the same status is localized:

```text
本機執行環境
路由：繁體中文 -> openai/qwen3.6-27b
執行環境可連線：OpenAI-compatible local endpoint，位於 127.0.0.1:8090。
```

Operational lessons from the Gemma/Qwen setup:

- Start LaunchAgents with the intended Node binary. On this machine that is `~/n/bin/node`; a Homebrew Node path can
  make daemon/router behavior differ from the interactive shell.
- After changing extension routing or UI language behavior, rebuild the extension and restart the daemon:
  `pnpm -C apps/chrome-extension build` then `pnpm -s summarize daemon restart`.
- Check all three layers when stale models appear: repo defaults (`src/config/local-model-routing-defaults.json`),
  user config (`~/.summarize/config.json`), and router aliases/rewrite rules.
- A reachable `/v1/models` endpoint only proves the server is listening. It does not prove inference is fast, streaming
  works, or the model obeys the language prompt.
- Qwen MoE models served through Transformers on Apple Silicon may be slow when fast-path kernels are unavailable. Logs
  such as "fast path is not available, falling back to torch implementation" usually explain long first-token latency.
- Old Qwen 35B A3B attempts on MPS hit `histogram_mps` gaps in the Transformers MoE path. Prefer the current 27B route,
  and keep old 35B aliases retired.
- Traditional Chinese prompts should be explicit. `zh-tw` resolves to a prompt instruction that asks for Traditional
  Chinese (`zh-Hant`) and tells the model not to answer in English except for unavoidable source quotes or proper nouns.

## Local-only mode

`"privacy": { "localOnly": true }` blocks remote providers before a model request is made. Allowed summary requests must
use an `openai/...` model with `openai.baseUrl` or `OPENAI_BASE_URL` set to localhost.

Expected allowed probe:

```bash
summarize local-runtime probe --json
```

```json
{
  "ok": true,
  "warnings": [],
  "results": [
    {
      "ok": true,
      "endpoint": "http://127.0.0.1:11434/v1/models",
      "runtime": {
        "kind": "openai-compatible",
        "baseUrl": "http://127.0.0.1:11434/v1",
        "baseUrlSource": "configured"
      },
      "models": [{ "id": "gemma3" }]
    }
  ]
}
```

Expected blocked run:

```bash
summarize "https://example.com" --model google/gemini-3-flash
```

```text
Local-only mode (privacy.localOnly) blocked google/gemini-3-flash: google/... is a remote provider; local-only mode only allows OpenAI-compatible localhost endpoints. Use an openai/... model with OPENAI_BASE_URL or openai.baseUrl set to a localhost OpenAI-compatible endpoint, or set "privacy.localOnly": false in config.
```

## Daemon and extension

After changing local model config:

```bash
summarize daemon restart
summarize daemon status
summarize local-runtime probe
```

Then open the browser side panel. The compact local status surface should show:

- `Local-only on` when `privacy.localOnly` is enabled.
- The selected route, for example `Route: English -> openai/gemma3`.
- Runtime reachability, for example `Runtime reachable: OpenAI-compatible local endpoint at 127.0.0.1:11434`.

If the panel still shows stale values, restart the daemon again. If the daemon was installed before you exported local
environment variables, rerun the install command from the extension setup screen so the daemon service captures the new
environment snapshot.

## References

- [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [Homebrew llama.cpp formula](https://formulae.brew.sh/formula/llama.cpp)
- [Ollama macOS docs](https://docs.ollama.com/macos)
- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
