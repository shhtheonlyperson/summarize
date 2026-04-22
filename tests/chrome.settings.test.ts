import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultSettings,
  loadSettings,
  normalizeUiLanguage,
  patchSettings,
  saveSettings,
} from "../apps/chrome-extension/src/lib/settings.js";
import { installChromeStorage } from "./helpers/chrome-storage.js";

describe("chrome/settings", () => {
  let storage: Record<string, unknown>;

  beforeEach(() => {
    storage = {};
    installChromeStorage(storage, "local");
  });

  it("loads defaults when storage is empty", async () => {
    const s = await loadSettings();
    expect(s).toEqual(defaultSettings);
    expect(s.uiLanguage).toBe("zh-tw");
  });

  it("normalizes model/length/language/ui language on save", async () => {
    await saveSettings({
      ...defaultSettings,
      token: "t",
      model: "Auto",
      length: "S",
      language: " German ",
      uiLanguage: "English" as never,
    });

    const raw = storage.settings as Record<string, unknown>;
    expect(raw.model).toBe("auto");
    expect(raw.length).toBe("short");
    expect(raw.language).toBe("German");
    expect(raw.uiLanguage).toBe("en");

    const loaded = await loadSettings();
    expect(loaded.model).toBe("auto");
    expect(loaded.length).toBe("short");
    expect(loaded.language).toBe("German");
    expect(loaded.uiLanguage).toBe("en");
  });

  it("patches settings and persists them", async () => {
    await patchSettings({
      token: "x",
      length: "20k",
      language: "en",
      uiLanguage: "zh-hant" as never,
    });
    const loaded = await loadSettings();
    expect(loaded.token).toBe("x");
    expect(loaded.length).toBe("20k");
    expect(loaded.language).toBe("en");
    expect(loaded.uiLanguage).toBe("zh-tw");
  });

  it("normalizes sidepanel UI language aliases", () => {
    expect(normalizeUiLanguage("english")).toBe("en");
    expect(normalizeUiLanguage("zh-Hant")).toBe("zh-tw");
    expect(normalizeUiLanguage("nope")).toBe("zh-tw");
  });

  it("persists slide OCR preference", async () => {
    await patchSettings({ slidesOcrEnabled: true });
    const loaded = await loadSettings();
    expect(loaded.slidesOcrEnabled).toBe(true);
  });

  it("normalizes advanced overrides on save", async () => {
    await saveSettings({
      ...defaultSettings,
      requestMode: "URL",
      firecrawlMode: "Always",
      markdownMode: "LLM",
      preprocessMode: "AUTO",
      youtubeMode: "No-Auto",
      timeout: " 90s ",
      retries: 3.9,
      maxOutputTokens: " 2k ",
    });

    const raw = storage.settings as Record<string, unknown>;
    expect(raw.requestMode).toBe("url");
    expect(raw.firecrawlMode).toBe("always");
    expect(raw.markdownMode).toBe("llm");
    expect(raw.preprocessMode).toBe("auto");
    expect(raw.youtubeMode).toBe("no-auto");
    expect(raw.timeout).toBe("90s");
    expect(raw.retries).toBe(3);
    expect(raw.maxOutputTokens).toBe("2k");

    const loaded = await loadSettings();
    expect(loaded.requestMode).toBe("url");
    expect(loaded.firecrawlMode).toBe("always");
    expect(loaded.markdownMode).toBe("llm");
    expect(loaded.preprocessMode).toBe("auto");
    expect(loaded.youtubeMode).toBe("no-auto");
    expect(loaded.timeout).toBe("90s");
    expect(loaded.retries).toBe(3);
    expect(loaded.maxOutputTokens).toBe("2k");
  });

  it("normalizes auto CLI fallback settings", async () => {
    await saveSettings({
      ...defaultSettings,
      autoCliFallback: false,
      autoCliOrder: " GeMiNi,openclaw,opencode,unknown,CLAUDE,gemini ",
    });

    const raw = storage.settings as Record<string, unknown>;
    expect(raw.autoCliFallback).toBe(false);
    expect(raw.autoCliOrder).toBe("gemini,openclaw,opencode,claude");

    const loaded = await loadSettings();
    expect(loaded.autoCliFallback).toBe(false);
    expect(loaded.autoCliOrder).toBe("gemini,openclaw,opencode,claude");
  });
});
