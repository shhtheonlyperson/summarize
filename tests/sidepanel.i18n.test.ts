import { beforeEach, describe, expect, it } from "vitest";
import {
  formatCharacters,
  formatModelLabel,
  formatSlideLabel,
  formatWordCount,
  getSidepanelUiLanguage,
  setSidepanelUiLanguage,
  t,
} from "../apps/chrome-extension/src/entrypoints/sidepanel/i18n";

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
    expect(formatWordCount(1200)).toBe("1,200 字");
    expect(formatCharacters(1200)).toBe("1,200 字元");
    expect(formatSlideLabel(2, 5)).toBe("投影片 2/5");

    setSidepanelUiLanguage("en");

    expect(t("summarize")).toBe("Summarize");
    expect(formatModelLabel("auto")).toBe("Model: auto");
    expect(formatWordCount(1200)).toBe("1,200 words");
    expect(formatCharacters(1200)).toBe("1,200 chars");
    expect(formatSlideLabel(2, 5)).toBe("Slide 2/5");
  });
});
