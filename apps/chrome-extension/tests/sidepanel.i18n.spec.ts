import { expect, test } from "@playwright/test";
import {
  assertNoErrors,
  closeExtension,
  getBrowserFromProject,
  getSettings,
  launchExtension,
  openExtensionPage,
  waitForPanelPort,
} from "./helpers/extension-harness";
import { allowFirefoxExtensionTests } from "./helpers/extension-test-config";

test.skip(
  ({ browserName }) => browserName === "firefox" && !allowFirefoxExtensionTests,
  "Firefox extension tests are blocked by Playwright limitations. Set ALLOW_FIREFOX_EXTENSION_TESTS=1 to run.",
);

test("sidepanel defaults to Traditional Chinese and toggles to English", async ({
  browserName: _browserName,
}, testInfo) => {
  const harness = await launchExtension(getBrowserFromProject(testInfo.project.name));

  try {
    const page = await openExtensionPage(harness, "sidepanel.html", "#title");
    await waitForPanelPort(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
    await expect(page.locator("#title")).toHaveText("摘要");
    await expect(page.locator("#chatInput")).toHaveAttribute("placeholder", "詢問這個頁面…");
    await expect(page.locator(".summarizeButton")).toContainText("摘要");

    await page.click("#drawerToggle");
    await expect(page.locator("#drawer")).toBeVisible();
    await expect(page.locator("label.uiLanguage")).toContainText("介面語言");
    await expect(page.locator("#uiLanguage")).toHaveValue("zh-tw");

    await page.locator("#uiLanguage").selectOption("en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#title")).toHaveText("Summarize");
    await expect(page.locator("#chatInput")).toHaveAttribute(
      "placeholder",
      "Ask about this page...",
    );
    await expect(page.locator("label.uiLanguage")).toContainText("UI language");
    await expect(page.locator(".summarizeButton")).toContainText("Summarize");
    await expect(page.locator("#uiLanguage")).toHaveValue("en");

    const settings = await getSettings(harness);
    expect(settings.uiLanguage).toBe("en");
    assertNoErrors(harness);
  } finally {
    await closeExtension(harness.context, harness.userDataDir);
  }
});
