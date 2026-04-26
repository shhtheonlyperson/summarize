// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyStaticSidepanelLocalization,
  setSidepanelUiLanguage,
} from "../apps/chrome-extension/src/entrypoints/sidepanel/i18n";
import { defaultSettings } from "../apps/chrome-extension/src/lib/settings";

const sidepanelHtml = fs.readFileSync(
  path.resolve(process.cwd(), "apps/chrome-extension/src/entrypoints/sidepanel/index.html"),
  "utf8",
);

function loadSidepanelHtml() {
  document.open();
  document.write(sidepanelHtml);
  document.close();
}

describe("chrome sidepanel i18n integration", () => {
  it("localizes static sidepanel markup to the default Traditional Chinese UI", () => {
    loadSidepanelHtml();
    setSidepanelUiLanguage(defaultSettings.uiLanguage);
    applyStaticSidepanelLocalization(document);

    expect(document.documentElement.lang).toBe("zh-Hant");
    expect(document.title).toBe("摘要");
    expect(document.querySelector("#title")?.textContent).toBe("摘要");
    expect(document.querySelector<HTMLTextAreaElement>("#chatInput")?.placeholder).toBe(
      "詢問這個頁面…",
    );
    expect(document.querySelector<HTMLSelectElement>("#uiLanguage")?.value).toBe("zh-tw");
  });

  it("can relocalize static sidepanel markup to English", () => {
    loadSidepanelHtml();
    setSidepanelUiLanguage("en");
    applyStaticSidepanelLocalization(document);

    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Summarize");
    expect(document.querySelector("#title")?.textContent).toBe("Summarize");
    expect(document.querySelector<HTMLTextAreaElement>("#chatInput")?.placeholder).toBe(
      "Ask about this page...",
    );
    expect(document.querySelector<HTMLSelectElement>("#uiLanguage")?.value).toBe("en");
  });
});
