---
summary: "Docs index for summarize behaviors and modes."
---

# Docs

- `docs/chrome-extension.md` — Chrome side panel extension + daemon setup/troubleshooting
- `docs/cache.md` — cache design + config (SQLite)
- `docs/cli.md` — CLI models (Claude/Codex/Gemini/Agent/OpenClaw/OpenCode)
- `docs/config.md` — config file location, precedence, and schema
- `docs/extract-only.md` — extract mode (no summary LLM call)
- `docs/firecrawl.md` — Firecrawl mode + API key
- `docs/language.md` — output language (`--language` / config `language`)
- `docs/local-llm-onboarding.md` — Mac-first llama.cpp/Ollama setup, local routing, probes, and local-only mode
- `docs/local-first-roadmap.md` — local-first fork thesis, non-goals, and staged architecture
- `docs/local-model-capabilities-audit.md` — source-grounded local/OpenAI-compatible provider and request-flow audit
- `docs/local-research-memory.md` — optional durable research memory setup, Postgres migration/testing, and privacy
- `docs/local-research-memory-design.md` — durable local research memory backend, entities, and privacy boundaries
- `docs/llm.md` — LLM summarization + model config (Gateway/OpenAI)
- `docs/manual-tests.md` — manual end-to-end test checklist
- `docs/model-auto.md` — automatic model selection (`--model auto`)
- `docs/notebooklm-podcast-workflow.md` — NotebookLM login/source/audio/download and `summarize podcast` workflow
- `docs/openai.md` — OpenAI model usage + flags
- `docs/atomic-commit-refactor-prd.md` — PRD for splitting the local-first fork into atomic commits
- `docs/postgres-notebooklm-summary.zh-TW.md` — Traditional Chinese summary of Postgres and NotebookLM work
- `docs/releasing.md` — release checklist + Homebrew tap update
- `docs/smoketest.md` — 20-case smoke test plan
- `docs/website.md` — normal websites (HTML extraction + Firecrawl fallback)
- `docs/youtube.md` — YouTube transcript extraction (youtubei / captionTracks / Apify)

## Website

- Jekyll site source: `docs/` (Markdown → HTML via GitHub Pages Actions)
