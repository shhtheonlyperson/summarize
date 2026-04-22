import type { AssistantMessage, Message } from "@mariozechner/pi-ai";
import type { SseSlidesData } from "./runtime-contracts";

export type LocalRuntimeKind = "openai-compatible" | "llama-cpp" | "ollama";

export type LocalRuntimeStatusProbe = {
  ok: boolean;
  reachable: boolean;
  runtimeType: LocalRuntimeKind | null;
  runtimeLabel: string | null;
  endpointHost: string | null;
  timeoutMs: number;
  models: {
    count: number;
    hints: string[];
  };
  server: {
    status: number;
    name?: string;
    version?: string;
  } | null;
  error: {
    code: string;
    message: string;
    status?: number;
  } | null;
};

export type LocalRuntimeStatusPayload = {
  ok: true;
  localOnly: {
    enabled: boolean;
    source: string | null;
  };
  runtime: {
    configured: boolean;
    type: LocalRuntimeKind | null;
    endpointHost: string | null;
    baseUrlSource: "configured" | "default" | null;
  };
  modelHints: {
    configuredModel: {
      input: string;
      source: "env" | "config" | "default";
    };
    localRoutingEnabled: boolean;
    selected: {
      bucket: "english" | "traditionalChinese" | "bilingual" | "fallback";
      modelInput: string;
      language: {
        kind: string;
        tag?: string;
        label?: string;
      };
    } | null;
    routes: Array<{
      bucket: "english" | "traditionalChinese" | "bilingual" | "fallback";
      modelInput: string;
      language: {
        kind: string;
        tag?: string;
        label?: string;
      };
    }>;
  };
  probes: LocalRuntimeStatusProbe[];
  warnings: string[];
};

export type LocalRuntimeStatus =
  | LocalRuntimeStatusPayload
  | {
      ok: false;
      error: string;
    };

export type UiState = {
  panelOpen: boolean;
  daemon: { ok: boolean; authed: boolean; error?: string };
  localRuntime: LocalRuntimeStatus | null;
  tab: { id: number | null; url: string | null; title: string | null };
  media: { hasVideo: boolean; hasAudio: boolean; hasCaptions: boolean } | null;
  stats: { pageWords: number | null; videoDurationSeconds: number | null };
  settings: {
    autoSummarize: boolean;
    hoverSummaries: boolean;
    chatEnabled: boolean;
    automationEnabled: boolean;
    slidesEnabled: boolean;
    slidesParallel: boolean;
    slidesOcrEnabled: boolean;
    slidesLayout: "strip" | "gallery";
    fontSize: number;
    lineHeight: number;
    model: string;
    length: string;
    tokenPresent: boolean;
  };
  status: string;
};

export type RunStart = {
  id: string;
  url: string;
  title: string | null;
  model: string;
  reason: string;
};

type PanelCacheMeta = {
  inputSummary: string | null;
  model: string | null;
  modelLabel: string | null;
};

export type PanelCachePayload = {
  tabId: number;
  url: string;
  title: string | null;
  runId: string | null;
  slidesRunId: string | null;
  summaryMarkdown: string | null;
  summaryFromCache: boolean | null;
  slidesSummaryMarkdown: string | null;
  slidesSummaryComplete: boolean | null;
  slidesSummaryModel: string | null;
  lastMeta: PanelCacheMeta;
  slides: SseSlidesData | null;
  transcriptTimedText: string | null;
};

export type PanelToBg =
  | { type: "panel:ready" }
  | { type: "panel:summarize"; refresh?: boolean; inputMode?: "page" | "video" }
  | {
      type: "panel:agent";
      requestId: string;
      messages: Message[];
      tools: string[];
      summary?: string | null;
    }
  | {
      type: "panel:chat-history";
      requestId: string;
      summary?: string | null;
    }
  | { type: "panel:seek"; seconds: number }
  | { type: "panel:ping" }
  | { type: "panel:closed" }
  | { type: "panel:rememberUrl"; url: string }
  | { type: "panel:setAuto"; value: boolean }
  | { type: "panel:setLength"; value: string }
  | { type: "panel:slides-context"; requestId: string; url?: string }
  | { type: "panel:cache"; cache: PanelCachePayload }
  | { type: "panel:get-cache"; requestId: string; tabId: number; url: string }
  | { type: "panel:openOptions" };

export type BgToPanel =
  | { type: "ui:state"; state: UiState }
  | { type: "ui:status"; status: string }
  | { type: "ui:local-runtime-status"; status: LocalRuntimeStatus }
  | { type: "run:start"; run: RunStart }
  | { type: "run:error"; message: string }
  | { type: "slides:run"; ok: boolean; runId?: string; url?: string; error?: string }
  | { type: "chat:history"; requestId: string; ok: boolean; messages?: Message[]; error?: string }
  | { type: "agent:chunk"; requestId: string; text: string }
  | {
      type: "agent:response";
      requestId: string;
      ok: boolean;
      assistant?: AssistantMessage;
      error?: string;
    }
  | {
      type: "slides:context";
      requestId: string;
      ok: boolean;
      transcriptTimedText?: string | null;
      error?: string;
    }
  | { type: "ui:cache"; requestId: string; ok: boolean; cache?: PanelCachePayload };
