---
summary: "NotebookLM login, source import, audio generation, download, and summarize podcast CLI workflow."
read_when:
  - "When creating NotebookLM audio overviews from persisted summarize runs."
  - "When testing the NotebookLM CLI wrapper or podcast command."
---

# NotebookLM Podcast Workflow

Summarize can export a persisted research-memory run as a NotebookLM-ready markdown bundle and ask the local
`notebooklm` CLI to create an audio overview. The wrapper is optional: default tests use a fake executable and do not
need a real NotebookLM account.

## Prerequisites

Authenticate the local NotebookLM CLI yourself:

```sh
notebooklm login
notebooklm auth check --json
```

Enable research memory before using the `summarize podcast` command. The command needs a persisted run to export:

```sh
summarize memory status
```

See `docs/local-research-memory.md` for Postgres setup and the privacy boundary.

## Manual NotebookLM Flow

Create or select a notebook:

```sh
notebooklm create --json "summarize: Research"
notebooklm use <notebook-id>
```

Export a run and add it as a markdown file source:

```sh
summarize memory export run_123 --output notebooklm.md --language zh-TW
notebooklm source add --notebook <notebook-id> --type file \
  --mime-type text/markdown --title "summarize bundle: Research" --json notebooklm.md
notebooklm source wait --notebook <notebook-id> --json <source-id>
```

Generate an audio overview and wait for the artifact:

```sh
notebooklm generate audio --notebook <notebook-id> --format deep-dive \
  --length long --language zh_Hant --wait --json \
  "Create a NotebookLM audio overview from this summarize research bundle."
notebooklm artifact wait --notebook <notebook-id> --json <artifact-id>
notebooklm artifact list --notebook <notebook-id> --type audio --json
```

Download the audio:

```sh
notebooklm download audio --notebook <notebook-id> \
  --artifact <artifact-id> --json overview.mp3
```

Audio is handled through `generate audio`, `artifact wait/list`, and `download audio`; there is no separate
`notebooklm audio` command in the audited CLI surface.

## Summarize CLI Flow

Create a podcast from an existing run:

```sh
summarize podcast create run_123 --output overview.mp3 --language zh-TW --format deep-dive
```

Create a podcast from a fresh URL. Summarize runs first, persists the new successful run, exports it, and then sends the
bundle to NotebookLM:

```sh
summarize podcast create https://example.com/research --length long --output overview.mp3
```

Start NotebookLM generation without waiting for the audio file:

```sh
summarize podcast create run_123 --no-wait --json
```

`--output` requires waiting because the audio must exist before it can be downloaded. `--format` is the NotebookLM
audio overview style (`deep-dive`, `brief`, `critique`, or `debate`), not the downloaded file extension; downloaded
audio is saved as MP3 unless the output path names another extension. `--language` controls the NotebookLM-ready
markdown bundle language, is mapped to NotebookLM artifact language codes (`zh-TW` -> `zh_Hant`), and is recorded in
research memory. `--length` is passed to NotebookLM audio generation and is also used as the summarize length for
URL-created podcasts.

## Persistence

The podcast command records:

- A markdown `export` artifact under the research-memory artifact root.
- An audio artifact path when `--output` requests a download.
- A NotebookLM export row containing provider, status, notebook id/title/url, source/audio ids, language, output format,
  and sanitized metadata.

NotebookLM credentials, cookies, bearer tokens, raw auth headers, raw environment values, and full markdown/audio
payloads are not stored inside the NotebookLM export metadata.

## Tests

These tests cover the wrapper, podcast CLI, memory export reuse, and CLI dispatch without calling a real NotebookLM
account:

```sh
pnpm -s test tests/notebooklm.service.test.ts \
  tests/cli.podcast.test.ts \
  tests/cli.memory.test.ts \
  tests/run.cli-preflight.test.ts
pnpm -s typecheck
```
