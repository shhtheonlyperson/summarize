# Summarize Guardrails

- Hard rule: single source of truth = `~/Projects/summarize`; never commit in `vendor/summarize` (treat it as a read-only checkout).
- Note: multiple agents often work in this folder. If you see files/changes you do not recognize, ignore them and list them at the end.

## Workspace layout (note)

- Monorepo (pnpm workspace).
- Packages:
  - `@steipete/summarize` = CLI + UX (TTY/progress/streaming). Depends on core.
  - `@steipete/summarize-core` (`packages/core`) = library surface for programmatic use (Sweetistics etc). No CLI entrypoints.
- Versioning: lockstep versions; publish order: core first, then CLI (`scripts/release.sh` / `RELEASING.md`).
- Dev:
  - Build: `pnpm -s build` (builds core first)
  - Gate: `pnpm -s check`
  - Import from apps: prefer `@steipete/summarize-core` to avoid pulling CLI-only deps.
- Daemon: restart with `pnpm -s summarize daemon restart`; verify via `pnpm -s summarize daemon status`.
- Rebuild (extension + daemon): run **both** in order:
  1. `pnpm -C apps/chrome-extension build`
  2. `pnpm summarize daemon restart`
- Extension tests:
  - `pnpm -C apps/chrome-extension test:chrome` = supported automated path.
  - Firefox Playwright extension tests are not reliable (`moz-extension://` limitation); default `test:firefox` skips.
  - Use `pnpm -C apps/chrome-extension test:firefox:force` only for explicit diagnostics.
- Commits: use `committer "type: message" <files...>` (Conventional Commits).

## Fork positioning and upstream workflow

- Local fork goal: keep upstream generic summarization working while adding private local LLM setup, language-aware
  routing for English/Traditional Chinese/bilingual outputs, and durable local research memory.
- Do not rename npm package IDs (`@steipete/summarize`, `@steipete/summarize-core`) or binaries (`summarize`,
  `summarizer`) unless a story explicitly calls for a release-facing rename plan.
- Remotes: `origin` is this fork; `upstream` should point at `https://github.com/steipete/summarize.git`.
- Before upstream sync work, run `git fetch upstream` and inspect divergence from repo root, for example
  `git log --oneline --left-right main...upstream/main`.
- Keep long-form product/design intent in docs such as `docs/local-first-roadmap.md`; keep AGENTS operational and put
  run-specific notes in `.ralph/progress.md`.
