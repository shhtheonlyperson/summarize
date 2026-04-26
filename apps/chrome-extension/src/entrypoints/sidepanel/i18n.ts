import { normalizeUiLanguage, type UiLanguage } from "../../lib/settings";

export type SidepanelUiLanguage = UiLanguage;

type SidepanelMessageKey =
  | "appTitle"
  | "settings"
  | "controls"
  | "checkingLocalPrivacy"
  | "modelAuto"
  | "waitingDaemonStatus"
  | "tryAgain"
  | "errorTitle"
  | "viewLogs"
  | "size"
  | "textSize"
  | "smallerText"
  | "largerText"
  | "line"
  | "lineHeight"
  | "tighterLineHeight"
  | "looserLineHeight"
  | "advanced"
  | "uiLanguage"
  | "english"
  | "traditionalChinese"
  | "model"
  | "auto"
  | "free"
  | "custom"
  | "customModelPlaceholder"
  | "refreshFreeModels"
  | "scanFree"
  | "slidesView"
  | "summaryStrip"
  | "slidesOnly"
  | "refresh"
  | "refreshTitle"
  | "clear"
  | "clearTitle"
  | "openExtensionDetails"
  | "jumpLatest"
  | "dismissError"
  | "chatPlaceholder"
  | "send"
  | "autoSummarize"
  | "length"
  | "lengthShort"
  | "lengthMedium"
  | "lengthLong"
  | "lengthXl"
  | "lengthXxl"
  | "length20kTooltip"
  | "lengthCustomTooltip"
  | "customLengthPlaceholder"
  | "presets"
  | "scheme"
  | "schemeSlate"
  | "schemeCedar"
  | "schemeMint"
  | "schemeOcean"
  | "schemeEmber"
  | "schemeIris"
  | "mode"
  | "modeSystem"
  | "modeLight"
  | "modeDark"
  | "font"
  | "fontMono"
  | "page"
  | "video"
  | "audio"
  | "slides"
  | "summarize"
  | "slidesTextSource"
  | "transcript"
  | "ocr"
  | "setup"
  | "setupMessage"
  | "installMethod"
  | "installSummarize"
  | "copyInstallCommand"
  | "homebrewHint"
  | "npmHint"
  | "registerDaemon"
  | "copyDaemonCommand"
  | "daemonAutoStart"
  | "unsupportedOs"
  | "troubleshooting"
  | "copyStatusCommand"
  | "daemonHealthHint"
  | "copyRestartCommand"
  | "daemonRestartHint"
  | "regenerateToken"
  | "copied"
  | "copyFailed"
  | "nothingToCopy"
  | "daemonNotReachable"
  | "launchAgentCheck"
  | "setupRequiredMissingToken"
  | "startingScan"
  | "missingStreamBody"
  | "freeModelsUpdated"
  | "topModel"
  | "refreshFreeFailed"
  | "fetchFailedDetail"
  | "setupNeeded"
  | "addDaemonToken"
  | "daemonOffline"
  | "runDaemonStatus"
  | "waitingLocalRuntimeStatus"
  | "localStatusUnavailable"
  | "localRuntimeGeneric"
  | "invalidRuntimeAction"
  | "timeoutRuntimeAction"
  | "runtimeSetupAction"
  | "runtimeUnreachable"
  | "runtimeReachable"
  | "localOnlyOn"
  | "localRuntime"
  | "remoteAllowed"
  | "remoteAllowedDetail"
  | "bucketTraditionalChinese"
  | "bucketBilingual"
  | "bucketEnglish"
  | "bucketFallback"
  | "route"
  | "thisPage"
  | "noPage"
  | "openPageToSummarize"
  | "loading"
  | "preparingSummary"
  | "ready"
  | "clickSummarize"
  | "somethingWentWrong"
  | "copySummary"
  | "slide"
  | "slidesCount"
  | "slidesShowing"
  | "collapse"
  | "expand"
  | "removeQueuedMessage"
  | "queueFull"
  | "context"
  | "messagesAbbrev"
  | "charactersAbbrev"
  | "toolResult"
  | "toolError"
  | "tool"
  | "file"
  | "download"
  | "slideExtractionRequires"
  | "installAndRestartDaemon"
  | "noResponseFromDaemon"
  | "setupRequiredMissingTokenNoPeriod"
  | "connecting"
  | "summarizing"
  | "streamEndedUnexpectedly"
  | "modelReturnedNoOutput"
  | "timedOutSlideUpdates"
  | "slidesSummaryStalled"
  | "slidesSummaryFailed"
  | "slidesStreamFailed"
  | "streamFailed"
  | "automationPermissionRequired"
  | "userScriptsRequired";

const messages: Record<SidepanelUiLanguage, Record<SidepanelMessageKey, string>> = {
  en: {
    appTitle: "Summarize",
    settings: "Settings",
    controls: "Controls",
    checkingLocalPrivacy: "Checking local privacy",
    modelAuto: "Model: auto",
    waitingDaemonStatus: "Waiting for daemon status.",
    tryAgain: "Try again",
    errorTitle: "Something went wrong",
    viewLogs: "View logs",
    size: "Size",
    textSize: "Text size",
    smallerText: "Smaller text",
    largerText: "Larger text",
    line: "Line",
    lineHeight: "Line height",
    tighterLineHeight: "Tighter line height",
    looserLineHeight: "Looser line height",
    advanced: "Advanced",
    uiLanguage: "UI language",
    english: "English",
    traditionalChinese: "繁體中文",
    model: "Model",
    auto: "Auto",
    free: "Free",
    custom: "Custom…",
    customModelPlaceholder: "custom model id",
    refreshFreeModels: "Refresh free models",
    scanFree: "Scan free",
    slidesView: "Slides view",
    summaryStrip: "Summary + strip",
    slidesOnly: "Slides only",
    refresh: "Refresh",
    refreshTitle: "Refresh (Shift+Enter)",
    clear: "Clear",
    clearTitle: "Clear summary + chat",
    openExtensionDetails: "Open extension details",
    jumpLatest: "Jump to latest",
    dismissError: "Dismiss error",
    chatPlaceholder: "Ask about this page...",
    send: "Send",
    autoSummarize: "Auto summarize",
    length: "Length",
    lengthShort: "Short",
    lengthMedium: "Medium",
    lengthLong: "Long",
    lengthXl: "Extra Large (XL)",
    lengthXxl: "Extra Extra Large (XXL)",
    length20kTooltip: "Custom target around 20,000 characters (soft guideline).",
    lengthCustomTooltip: "Set a custom length like 1500, 20k, or 1.5k.",
    customLengthPlaceholder: "Custom (e.g. 20k)",
    presets: "Presets",
    scheme: "Scheme",
    schemeSlate: "Slate",
    schemeCedar: "Cedar",
    schemeMint: "Mint",
    schemeOcean: "Ocean",
    schemeEmber: "Ember",
    schemeIris: "Iris",
    mode: "Mode",
    modeSystem: "System",
    modeLight: "Light",
    modeDark: "Dark",
    font: "Font",
    fontMono: "Mono",
    page: "Page",
    video: "Video",
    audio: "Audio",
    slides: "Slides",
    summarize: "Summarize",
    slidesTextSource: "Slides text source",
    transcript: "Transcript",
    ocr: "OCR",
    setup: "Setup",
    setupMessage:
      "Install summarize, then register the daemon so the side panel can stream summaries.",
    installMethod: "Install method",
    installSummarize: "Install summarize",
    copyInstallCommand: "Copy install command",
    homebrewHint: "Homebrew installs summarize plus the local media dependencies.",
    npmHint: "NPM installs the CLI (requires Node.js).",
    registerDaemon: "Register the daemon",
    copyDaemonCommand: "Copy daemon command",
    daemonAutoStart: "Daemon auto-start",
    unsupportedOs: "Not supported on this OS yet.",
    troubleshooting: "Troubleshooting",
    copyStatusCommand: "Copy status command",
    daemonHealthHint: "Shows daemon health, version, and token auth status.",
    copyRestartCommand: "Copy restart command",
    daemonRestartHint: "Restarts the daemon if it’s stuck or not responding.",
    regenerateToken: "Regenerate Token",
    copied: "Copied",
    copyFailed: "Copy failed",
    nothingToCopy: "Nothing to copy",
    daemonNotReachable: "Daemon not reachable",
    launchAgentCheck: "Check that the LaunchAgent is installed.",
    setupRequiredMissingToken: "Setup required (missing token).",
    startingScan: "Starting scan…",
    missingStreamBody: "Missing stream body",
    freeModelsUpdated: "Free models updated.",
    topModel: "Top",
    refreshFreeFailed: "Refresh free failed",
    fetchFailedDetail:
      "Failed to fetch (daemon unreachable or blocked by Chrome; try `summarize daemon status`, maybe `summarize daemon restart`, and check ~/.summarize/logs/daemon.err.log)",
    setupNeeded: "Setup needed",
    addDaemonToken: "Add the daemon token to check local runtime privacy.",
    daemonOffline: "Daemon offline",
    runDaemonStatus: "Run summarize daemon status, then restart the daemon.",
    waitingLocalRuntimeStatus: "Waiting for local runtime status.",
    localStatusUnavailable: "Local status unavailable",
    localRuntimeGeneric: "local runtime",
    invalidRuntimeAction:
      "Check openai.baseUrl; use a localhost http URL without credentials, query, or fragment.",
    timeoutRuntimeAction: "Start your local model server, then run summarize local-runtime probe.",
    runtimeSetupAction:
      "Start your local model server or set openai.baseUrl to localhost, then restart the daemon.",
    runtimeUnreachable: "Local runtime is not reachable.",
    runtimeReachable: "Runtime reachable",
    localOnlyOn: "Local-only on",
    localRuntime: "Local runtime",
    remoteAllowed: "Remote allowed",
    remoteAllowedDetail:
      "Cloud providers may be used. Enable privacy.localOnly in daemon config to block remote routes.",
    bucketTraditionalChinese: "Traditional Chinese",
    bucketBilingual: "Bilingual",
    bucketEnglish: "English",
    bucketFallback: "Fallback",
    route: "Route",
    thisPage: "this page",
    noPage: "No page",
    openPageToSummarize: "Open a page to summarize.",
    loading: "Loading",
    preparingSummary: "Preparing summary",
    ready: "Ready",
    clickSummarize: "Click Summarize to start.",
    somethingWentWrong: "Something went wrong.",
    copySummary: "Copy summary",
    slide: "Slide",
    slidesCount: "Slides",
    slidesShowing: "showing",
    collapse: "Collapse",
    expand: "Expand",
    removeQueuedMessage: "Remove queued message",
    queueFull: "Queue full",
    context: "Context",
    messagesAbbrev: "msgs",
    charactersAbbrev: "chars",
    toolResult: "Tool result",
    toolError: "error",
    tool: "Tool",
    file: "file",
    download: "download",
    slideExtractionRequires: "Slide extraction requires",
    installAndRestartDaemon: "Install and restart the daemon.",
    noResponseFromDaemon:
      "No response from the daemon for a while. It may have stopped. Click “Try again”.",
    setupRequiredMissingTokenNoPeriod: "Setup required (missing token)",
    connecting: "Connecting…",
    summarizing: "Summarizing…",
    streamEndedUnexpectedly: "Stream ended unexpectedly. The daemon may have stopped.",
    modelReturnedNoOutput: "Model returned no output.",
    timedOutSlideUpdates: "Timed out waiting for slide updates.",
    slidesSummaryStalled: "Slides summary stalled. The daemon may have stopped.",
    slidesSummaryFailed: "Slides summary failed",
    slidesStreamFailed: "Slides stream failed",
    streamFailed: "Stream failed",
    automationPermissionRequired: "Automation permission required",
    userScriptsRequired: "User Scripts required",
  },
  "zh-tw": {
    appTitle: "摘要",
    settings: "設定",
    controls: "控制項",
    checkingLocalPrivacy: "正在檢查本機隱私",
    modelAuto: "模型：auto",
    waitingDaemonStatus: "等待 daemon 狀態。",
    tryAgain: "再試一次",
    errorTitle: "發生錯誤",
    viewLogs: "查看記錄",
    size: "大小",
    textSize: "文字大小",
    smallerText: "縮小文字",
    largerText: "放大文字",
    line: "行距",
    lineHeight: "行高",
    tighterLineHeight: "縮小行距",
    looserLineHeight: "加大行距",
    advanced: "進階",
    uiLanguage: "介面語言",
    english: "English",
    traditionalChinese: "繁體中文",
    model: "模型",
    auto: "自動",
    free: "免費",
    custom: "自訂…",
    customModelPlaceholder: "自訂模型 ID",
    refreshFreeModels: "重新整理免費模型",
    scanFree: "掃描免費模型",
    slidesView: "投影片檢視",
    summaryStrip: "摘要 + 縮圖列",
    slidesOnly: "僅投影片",
    refresh: "重新整理",
    refreshTitle: "重新整理 (Shift+Enter)",
    clear: "清除",
    clearTitle: "清除摘要與聊天",
    openExtensionDetails: "開啟擴充功能詳細資料",
    jumpLatest: "跳到最新",
    dismissError: "關閉錯誤",
    chatPlaceholder: "詢問這個頁面…",
    send: "傳送",
    autoSummarize: "自動摘要",
    length: "長度",
    lengthShort: "短",
    lengthMedium: "中",
    lengthLong: "長",
    lengthXl: "特長 (XL)",
    lengthXxl: "超長 (XXL)",
    length20kTooltip: "自訂目標約 20,000 字元（彈性準則）。",
    lengthCustomTooltip: "設定自訂長度，例如 1500、20k 或 1.5k。",
    customLengthPlaceholder: "自訂（例如 20k）",
    presets: "預設",
    scheme: "配色",
    schemeSlate: "石板",
    schemeCedar: "雪松",
    schemeMint: "薄荷",
    schemeOcean: "海洋",
    schemeEmber: "餘燼",
    schemeIris: "鳶尾",
    mode: "模式",
    modeSystem: "系統",
    modeLight: "淺色",
    modeDark: "深色",
    font: "字體",
    fontMono: "等寬",
    page: "頁面",
    video: "影片",
    audio: "音訊",
    slides: "投影片",
    summarize: "摘要",
    slidesTextSource: "投影片文字來源",
    transcript: "逐字稿",
    ocr: "OCR",
    setup: "設定",
    setupMessage: "安裝 summarize，然後註冊 daemon，讓側邊欄可以串流摘要。",
    installMethod: "安裝方式",
    installSummarize: "安裝 summarize",
    copyInstallCommand: "複製安裝指令",
    homebrewHint: "Homebrew 會安裝 summarize 以及本機媒體相依套件。",
    npmHint: "NPM 會安裝 CLI（需要 Node.js）。",
    registerDaemon: "註冊 daemon",
    copyDaemonCommand: "複製 daemon 指令",
    daemonAutoStart: "Daemon 自動啟動",
    unsupportedOs: "這個作業系統尚未支援。",
    troubleshooting: "疑難排解",
    copyStatusCommand: "複製狀態指令",
    daemonHealthHint: "顯示 daemon 健康狀態、版本與權杖驗證狀態。",
    copyRestartCommand: "複製重啟指令",
    daemonRestartHint: "Daemon 卡住或沒有回應時可重新啟動。",
    regenerateToken: "重新產生權杖",
    copied: "已複製",
    copyFailed: "複製失敗",
    nothingToCopy: "沒有可複製的內容",
    daemonNotReachable: "無法連線到 daemon",
    launchAgentCheck: "請確認 LaunchAgent 已安裝。",
    setupRequiredMissingToken: "需要設定（缺少權杖）。",
    startingScan: "正在開始掃描…",
    missingStreamBody: "缺少串流內容",
    freeModelsUpdated: "免費模型已更新。",
    topModel: "最佳",
    refreshFreeFailed: "重新整理免費模型失敗",
    fetchFailedDetail:
      "擷取失敗（daemon 無法連線或被 Chrome 阻擋；請試 `summarize daemon status`，必要時執行 `summarize daemon restart`，並檢查 ~/.summarize/logs/daemon.err.log）",
    setupNeeded: "需要設定",
    addDaemonToken: "加入 daemon 權杖以檢查本機執行環境隱私。",
    daemonOffline: "Daemon 離線",
    runDaemonStatus: "執行 summarize daemon status，然後重新啟動 daemon。",
    waitingLocalRuntimeStatus: "等待本機執行環境狀態。",
    localStatusUnavailable: "本機狀態無法取得",
    localRuntimeGeneric: "本機執行環境",
    invalidRuntimeAction:
      "請檢查 openai.baseUrl；使用沒有憑證、查詢字串或片段的 localhost http URL。",
    timeoutRuntimeAction: "啟動本機模型伺服器，然後執行 summarize local-runtime probe。",
    runtimeSetupAction:
      "啟動本機模型伺服器，或將 openai.baseUrl 設為 localhost，然後重新啟動 daemon。",
    runtimeUnreachable: "本機執行環境無法連線。",
    runtimeReachable: "執行環境可連線",
    localOnlyOn: "僅限本機",
    localRuntime: "本機執行環境",
    remoteAllowed: "允許遠端",
    remoteAllowedDetail:
      "可能會使用雲端供應商。請在 daemon 設定啟用 privacy.localOnly 以阻擋遠端路由。",
    bucketTraditionalChinese: "繁體中文",
    bucketBilingual: "雙語",
    bucketEnglish: "英文",
    bucketFallback: "備用",
    route: "路由",
    thisPage: "這個頁面",
    noPage: "沒有頁面",
    openPageToSummarize: "開啟頁面以產生摘要。",
    loading: "載入中",
    preparingSummary: "正在準備摘要",
    ready: "就緒",
    clickSummarize: "點按「摘要」開始。",
    somethingWentWrong: "發生錯誤。",
    copySummary: "複製摘要",
    slide: "投影片",
    slidesCount: "投影片",
    slidesShowing: "顯示",
    collapse: "收合",
    expand: "展開",
    removeQueuedMessage: "移除佇列訊息",
    queueFull: "佇列已滿",
    context: "上下文",
    messagesAbbrev: "則訊息",
    charactersAbbrev: "字元",
    toolResult: "工具結果",
    toolError: "錯誤",
    tool: "工具",
    file: "檔案",
    download: "下載",
    slideExtractionRequires: "擷取投影片需要",
    installAndRestartDaemon: "請安裝並重新啟動 daemon。",
    noResponseFromDaemon: "Daemon 已有一段時間沒有回應，可能已停止。請點按「再試一次」。",
    setupRequiredMissingTokenNoPeriod: "需要設定（缺少權杖）",
    connecting: "連線中…",
    summarizing: "摘要中…",
    streamEndedUnexpectedly: "串流意外結束。Daemon 可能已停止。",
    modelReturnedNoOutput: "模型沒有傳回輸出。",
    timedOutSlideUpdates: "等待投影片更新逾時。",
    slidesSummaryStalled: "投影片摘要停滯。Daemon 可能已停止。",
    slidesSummaryFailed: "投影片摘要失敗",
    slidesStreamFailed: "投影片串流失敗",
    streamFailed: "串流失敗",
    automationPermissionRequired: "需要自動化權限",
    userScriptsRequired: "需要 User Scripts",
  },
};

let currentLanguage: SidepanelUiLanguage = "zh-tw";

export function normalizeSidepanelUiLanguage(value: unknown): SidepanelUiLanguage {
  return normalizeUiLanguage(value);
}

export function setSidepanelUiLanguage(value: unknown): SidepanelUiLanguage {
  currentLanguage = normalizeSidepanelUiLanguage(value);
  return currentLanguage;
}

export function getSidepanelUiLanguage(): SidepanelUiLanguage {
  return currentLanguage;
}

export function t(key: SidepanelMessageKey): string {
  return messages[currentLanguage][key];
}

export function formatWordCount(value: number): string {
  return currentLanguage === "zh-tw"
    ? `${value.toLocaleString()} 字`
    : `${value.toLocaleString()} words`;
}

export function formatCharacters(value: number): string {
  return currentLanguage === "zh-tw"
    ? `${value.toLocaleString()} 字元`
    : `${value.toLocaleString()} chars`;
}

export function formatModelLabel(value: string): string {
  return currentLanguage === "zh-tw" ? `模型：${value}` : `Model: ${value}`;
}

export function formatRouteLabel(bucket: string, modelInput: string): string {
  return currentLanguage === "zh-tw"
    ? `${t("route")}：${bucket} -> ${modelInput}`
    : `${t("route")}: ${bucket} -> ${modelInput}`;
}

export function formatRuntimeAt(label: string, host: string): string {
  return currentLanguage === "zh-tw" ? `${label}，位於 ${host}` : `${label} at ${host}`;
}

export function formatRuntimeReachable(runtime: string): string {
  return currentLanguage === "zh-tw"
    ? `${t("runtimeReachable")}：${runtime}。`
    : `${t("runtimeReachable")}: ${runtime}.`;
}

export function formatSlideLabel(index: number, total?: number | null): string {
  const label = t("slide");
  return total && total > 0 ? `${label} ${index}/${total}` : `${label} ${index}`;
}

export function applyStaticSidepanelLocalization(root: ParentNode = document) {
  const doc =
    "getElementById" in root ? (root as Document) : ((root as Node).ownerDocument ?? document);
  doc.documentElement.lang = currentLanguage === "zh-tw" ? "zh-Hant" : "en";
  doc.title = t("appTitle");

  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-i18n]"))) {
    const key = el.dataset.i18n as SidepanelMessageKey | undefined;
    if (key) el.textContent = t(key);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-i18n-aria]"))) {
    const key = el.dataset.i18nAria as SidepanelMessageKey | undefined;
    if (key) el.setAttribute("aria-label", t(key));
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-i18n-title]"))) {
    const key = el.dataset.i18nTitle as SidepanelMessageKey | undefined;
    if (key) el.setAttribute("title", t(key));
  }
  for (const el of Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]"),
  )) {
    const key = el.dataset.i18nPlaceholder as SidepanelMessageKey | undefined;
    if (key) el.placeholder = t(key);
  }

  const languageSelect = doc.getElementById("uiLanguage") as HTMLSelectElement | null;
  if (languageSelect) languageSelect.value = currentLanguage;
}
