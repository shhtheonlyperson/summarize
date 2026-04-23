---
summary: "Postgres 研究記憶與 NotebookLM Podcast 工作的繁體中文摘要。"
read_when:
  - "When a concise Traditional Chinese summary of the Postgres and NotebookLM work is needed."
---

# Postgres 與 NotebookLM 成果摘要

本輪工作把 Summarize 的研究記憶流程串成可驗證的本機工作流，同時維持上游友善的預設行為：沒有設定時不需要
Postgres，也不會呼叫真實的 NotebookLM 帳號。

## 測試覆蓋

- 新增研究記憶儲存合約、記憶體實作、Postgres schema/store/factory/lifecycle 測試。
- NotebookLM wrapper 與 `summarize podcast create` 使用 fake executable 和 fake store 測試，不依賴真實帳號。
- `SUMMARIZE_POSTGRES_TEST_URL` 未設定時，Postgres live integration test 會跳過，保留預設測試的穩定性。
- 完成故事時應執行 `pnpm -s typecheck`、文件安全測試，以及相關 CLI/NotebookLM/研究記憶測試。

## 本機 Postgres 持久化

- `researchMemory.enabled=true` 且 `backend=postgres` 時，Summarize 會把 run、source、artifact、event、
  model route、failure、NotebookLM export metadata 寫入本機 Postgres。
- `SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL` 可放連線字串；`artifactRoot` 預設為
  `~/.summarize/research-memory/artifacts`，用來保存 markdown 匯出包與音訊等大型檔案。
- API key、bearer token、cookie、raw auth header、NotebookLM 憑證與完整環境快照不應寫入研究記憶。

## NotebookLM Podcast 產生

- 先用 `notebooklm login` 和 `notebooklm auth check --json` 完成本機 CLI 登入。
- 可用 `summarize memory export <run-id> --language zh-TW` 產生 NotebookLM-ready markdown。
- 可直接用 NotebookLM CLI 執行 `source add --type file`、`generate audio --format deep-dive --language zh_Hant`、
  `artifact wait/list`、`download audio`。
- 也可用 `summarize podcast create <run-id-or-url> --output overview.mp3 --language zh-TW` 自動完成匯出、加入來源、
  產生音訊、下載音訊，並把 NotebookLM export metadata 寫回研究記憶；Summarize 的 `zh-TW` 會映射到 NotebookLM
  的 `zh_Hant`。

文件細節請見 `docs/local-research-memory.md` 與 `docs/notebooklm-podcast-workflow.md`。
