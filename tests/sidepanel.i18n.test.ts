import { beforeEach, describe, expect, it } from "vitest";
import {
  formatModelLabel,
  getSidepanelUiLanguage,
  setSidepanelUiLanguage,
  t,
} from "../apps/chrome-extension/src/entrypoints/sidepanel/i18n";
import { buildLocalRuntimeStatusView } from "../apps/chrome-extension/src/entrypoints/sidepanel/local-runtime-status";
import type {
  LocalRuntimeStatusPayload,
  UiState,
} from "../apps/chrome-extension/src/lib/panel-contracts";

function buildStatus(): LocalRuntimeStatusPayload {
  return {
    ok: true,
    localOnly: { enabled: true, source: "privacy.localOnly" },
    runtime: {
      configured: true,
      type: "openai-compatible",
      endpointHost: "127.0.0.1:8080",
      baseUrlSource: "configured",
    },
    modelHints: {
      configuredModel: { input: "auto", source: "default" },
      localRoutingEnabled: true,
      selected: {
        bucket: "traditionalChinese",
        modelInput: "openai/qwen-local",
        language: { kind: "fixed", tag: "zh-TW", label: "Traditional Chinese" },
      },
      routes: [
        {
          bucket: "english",
          modelInput: "openai/gemma4-31b",
          language: { kind: "fixed", tag: "en", label: "English" },
        },
        {
          bucket: "traditionalChinese",
          modelInput: "openai/qwen-local",
          language: { kind: "fixed", tag: "zh-TW", label: "Chinese (Traditional)" },
        },
        {
          bucket: "bilingual",
          modelInput: "openai/qwen3.6-27b",
          language: { kind: "fixed", tag: "en+zh-TW bilingual", label: "en+zh-TW bilingual" },
        },
        {
          bucket: "fallback",
          modelInput: "openai/gemma4-31b",
          language: { kind: "auto" },
        },
      ],
    },
    probes: [
      {
        ok: true,
        reachable: true,
        runtimeType: "openai-compatible",
        runtimeLabel: "OpenAI-compatible",
        endpointHost: "127.0.0.1:8080",
        timeoutMs: 1200,
        models: { count: 1, hints: ["qwen-local"] },
        server: { status: 200, name: "llama.cpp" },
        error: null,
      },
    ],
    warnings: [],
  };
}

function buildState(): UiState {
  return {
    panelOpen: true,
    daemon: { ok: true, authed: true },
    localRuntime: buildStatus(),
    tab: { id: 1, url: "https://example.com", title: "Example" },
    media: null,
    stats: { pageWords: null, videoDurationSeconds: null },
    settings: {
      autoSummarize: false,
      hoverSummaries: false,
      chatEnabled: true,
      automationEnabled: false,
      slidesEnabled: true,
      slidesParallel: true,
      slidesOcrEnabled: false,
      slidesLayout: "gallery",
      fontSize: 14,
      lineHeight: 1.45,
      model: "auto",
      length: "xl",
      language: "zh-tw",
      tokenPresent: true,
    },
    status: "",
  };
}

describe("sidepanel i18n", () => {
  beforeEach(() => {
    setSidepanelUiLanguage("zh-tw");
  });

  it("defaults unknown language values to Traditional Chinese", () => {
    expect(setSidepanelUiLanguage("unknown")).toBe("zh-tw");
    expect(getSidepanelUiLanguage()).toBe("zh-tw");
    expect(t("appTitle")).toBe("摘要");
    expect(formatModelLabel("auto")).toBe("模型：auto");
  });

  it("switches labels between Traditional Chinese and English", () => {
    expect(t("summarize")).toBe("摘要");

    setSidepanelUiLanguage("en");

    expect(t("summarize")).toBe("Summarize");
    expect(formatModelLabel("auto")).toBe("Model: auto");
  });

  it("localizes local runtime status view", () => {
    expect(buildLocalRuntimeStatusView(buildState())).toMatchObject({
      privacy: "僅限本機",
      route: "路由：繁體中文 -> openai/qwen-local",
      detail: "執行環境可連線：OpenAI-compatible，位於 127.0.0.1:8080。",
    });

    setSidepanelUiLanguage("en");

    expect(buildLocalRuntimeStatusView(buildState())).toMatchObject({
      privacy: "Local-only on",
      route: "Route: English -> openai/gemma4-31b",
      detail: "Runtime reachable: OpenAI-compatible at 127.0.0.1:8080.",
    });
  });

  it("does not render retired local routing model inputs from stale daemon status", () => {
    const retiredQwen = ["qwen3.6", "35b", "a3b"].join("-");
    const state = buildState();
    setSidepanelUiLanguage("zh-tw");
    if (state.localRuntime?.ok === true && state.localRuntime.modelHints.selected) {
      state.localRuntime.modelHints.selected.modelInput = `openai/${retiredQwen}`;
      const route = state.localRuntime.modelHints.routes.find(
        (entry) => entry.bucket === "traditionalChinese",
      );
      if (route) route.modelInput = `openai/${retiredQwen}`;
    }

    const view = buildLocalRuntimeStatusView(state);

    expect(view.route).toBe("路由：繁體中文 -> openai/qwen3.6-27b");
    expect(view.route).not.toContain(retiredQwen);
  });

  it("uses Gemma 4 31B for the English local runtime route", () => {
    const state = buildState();
    state.settings.language = "en";
    setSidepanelUiLanguage("en");

    const view = buildLocalRuntimeStatusView(state);

    expect(view.route).toBe("Route: English -> openai/gemma4-31b");
  });

  it("uses the Traditional Chinese route and wording from the current UI language", () => {
    const state = buildState();
    state.settings.language = "en";
    if (state.localRuntime?.ok === true) {
      state.localRuntime.modelHints.selected = {
        bucket: "english",
        modelInput: "openai/gemma4-31b",
        language: { kind: "fixed", tag: "en", label: "English" },
      };
    }

    setSidepanelUiLanguage("zh-tw");

    const view = buildLocalRuntimeStatusView(state);

    expect(view).toMatchObject({
      privacy: "僅限本機",
      route: "路由：繁體中文 -> openai/qwen-local",
      detail: "執行環境可連線：OpenAI-compatible，位於 127.0.0.1:8080。",
    });
  });
});
