import { expect, test } from "@playwright/test";
import {
  assertNoErrors,
  buildUiState,
  closeExtension,
  getBrowserFromProject,
  launchExtension,
  openExtensionPage,
  seedSettings,
  sendBgMessage,
  waitForPanelPort,
} from "./helpers/extension-harness";
import { allowFirefoxExtensionTests } from "./helpers/extension-test-config";
import { waitForSettingsHydratedHook } from "./helpers/panel-hooks";

test.skip(
  ({ browserName }) => browserName === "firefox" && !allowFirefoxExtensionTests,
  "Firefox extension tests are blocked by Playwright limitations. Set ALLOW_FIREFOX_EXTENSION_TESTS=1 to run.",
);

function buildLocalRuntimeStatus(overrides: Record<string, unknown> = {}) {
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
      routes: [],
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
    ...overrides,
  };
}

test("sidepanel fetches local runtime status through the background client", async ({
  browserName: _browserName,
}, testInfo) => {
  const harness = await launchExtension(getBrowserFromProject(testInfo.project.name));

  try {
    await mockDaemonSummarize(harness);
    await seedSettings(harness, {
      token: "test-token",
      autoSummarize: false,
      model: "auto",
      uiLanguage: "en",
      language: "en",
    });
    const page = await openExtensionPage(harness, "sidepanel.html", "#title");
    await waitForPanelPort(page);
    await waitForSettingsHydratedHook(page);

    const status = page.locator("#localRuntimeStatus");
    await expect(status).toHaveAttribute("data-state", "ok");
    await expect(page.locator("#localRuntimePrivacy")).toHaveText("Local-only on");
    await expect(page.locator("#localRuntimeRoute")).toHaveText(
      "Route: Fallback -> openai/llama-local",
    );
    await expect(page.locator("#localRuntimeDetail")).toContainText(
      "Runtime reachable: OpenAI-compatible at 127.0.0.1:8080.",
    );
    await expect(status).not.toContainText("test-token");
    assertNoErrors(harness);
  } finally {
    await closeExtension(harness.context, harness.userDataDir);
  }
});

test("sidepanel renders local-only runtime and selected route", async ({
  browserName: _browserName,
}, testInfo) => {
  const harness = await launchExtension(getBrowserFromProject(testInfo.project.name));

  try {
    await seedSettings(harness, {
      token: "test-token",
      autoSummarize: false,
      model: "auto",
      uiLanguage: "en",
      language: "en",
    });
    const page = await openExtensionPage(harness, "sidepanel.html", "#title");
    await waitForPanelPort(page);
    await waitForSettingsHydratedHook(page);

    await sendBgMessage(harness, {
      type: "ui:state",
      state: buildUiState({
        settings: { tokenPresent: true, autoSummarize: false, model: "auto", length: "xl" },
        localRuntime: buildLocalRuntimeStatus(),
      }),
    });

    const status = page.locator("#localRuntimeStatus");
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("data-state", "ok");
    await expect(page.locator("#localRuntimePrivacy")).toHaveText("僅限本機");
    await expect(page.locator("#localRuntimeRoute")).toHaveText(
      "路由：繁體中文 -> openai/qwen-local",
    );
    await expect(page.locator("#localRuntimeDetail")).toContainText(
      "執行環境可連線：OpenAI-compatible，位於 127.0.0.1:8080。",
    );
    await expect(status).not.toContainText("sk-");
    assertNoErrors(harness);
  } finally {
    await closeExtension(harness.context, harness.userDataDir);
  }
});

test("sidepanel localizes local runtime route and detail from Traditional Chinese UI", async ({
  browserName: _browserName,
}, testInfo) => {
  const harness = await launchExtension(getBrowserFromProject(testInfo.project.name));

  try {
    await seedSettings(harness, {
      token: "test-token",
      autoSummarize: false,
      model: "auto",
      uiLanguage: "zh-tw",
      language: "zh-tw",
    });
    const page = await openExtensionPage(harness, "sidepanel.html", "#title");
    await waitForPanelPort(page);
    await waitForSettingsHydratedHook(page);

    await sendBgMessage(harness, {
      type: "ui:state",
      state: buildUiState({
        settings: {
          tokenPresent: true,
          autoSummarize: false,
          model: "auto",
          length: "xl",
          language: "en",
        },
        localRuntime: buildLocalRuntimeStatus({
          localOnly: { enabled: false, source: null },
          runtime: {
            configured: true,
            type: "openai-compatible",
            endpointHost: "127.0.0.1:8090",
            baseUrlSource: "configured",
          },
          modelHints: {
            configuredModel: { input: "auto", source: "default" },
            localRoutingEnabled: true,
            selected: {
              bucket: "english",
              modelInput: "openai/gemma4-31b",
              language: { kind: "fixed", tag: "en", label: "English" },
            },
            routes: [
              {
                bucket: "traditionalChinese",
                modelInput: "openai/qwen3.6-27b",
                language: { kind: "fixed", tag: "zh-TW", label: "Traditional Chinese" },
              },
            ],
          },
          probes: [
            {
              ok: true,
              reachable: true,
              runtimeType: "openai-compatible",
              runtimeLabel: "OpenAI-compatible local endpoint",
              endpointHost: "127.0.0.1:8090",
              timeoutMs: 1200,
              models: { count: 1, hints: ["qwen3.6-27b"] },
              server: { status: 200, name: "transformers" },
              error: null,
            },
          ],
        }),
      }),
    });

    await expect(page.locator("#localRuntimeStatus")).toHaveAttribute("data-state", "ok");
    await expect(page.locator("#localRuntimePrivacy")).toHaveText("本機執行環境");
    await expect(page.locator("#localRuntimeRoute")).toHaveText(
      "路由：繁體中文 -> openai/qwen3.6-27b",
    );
    await expect(page.locator("#localRuntimeDetail")).toHaveText(
      "執行環境可連線：OpenAI-compatible local endpoint，位於 127.0.0.1:8090。",
    );
    assertNoErrors(harness);
  } finally {
    await closeExtension(harness.context, harness.userDataDir);
  }
});

test("sidepanel warns when remote providers are allowed", async ({
  browserName: _browserName,
}, testInfo) => {
  const harness = await launchExtension(getBrowserFromProject(testInfo.project.name));

  try {
    await seedSettings(harness, {
      token: "test-token",
      autoSummarize: false,
      model: "free",
      uiLanguage: "en",
      language: "en",
    });
    const page = await openExtensionPage(harness, "sidepanel.html", "#title");
    await waitForPanelPort(page);
    await waitForSettingsHydratedHook(page);

    await sendBgMessage(harness, {
      type: "ui:state",
      state: buildUiState({
        settings: { tokenPresent: true, autoSummarize: false, model: "free", length: "xl" },
        localRuntime: buildLocalRuntimeStatus({
          localOnly: { enabled: false, source: null },
          modelHints: {
            configuredModel: { input: "auto", source: "default" },
            localRoutingEnabled: false,
            selected: null,
            routes: [],
          },
        }),
      }),
    });

    await expect(page.locator("#localRuntimeStatus")).toHaveAttribute("data-state", "warn");
    await expect(page.locator("#localRuntimePrivacy")).toHaveText("允許遠端");
    await expect(page.locator("#localRuntimeRoute")).toHaveText("模型：free");
    await expect(page.locator("#localRuntimeDetail")).toContainText(
      "啟用 privacy.localOnly 以阻擋遠端路由",
    );
    assertNoErrors(harness);
  } finally {
    await closeExtension(harness.context, harness.userDataDir);
  }
});

test("sidepanel shows actionable local runtime setup errors", async ({
  browserName: _browserName,
}, testInfo) => {
  const harness = await launchExtension(getBrowserFromProject(testInfo.project.name));

  try {
    await seedSettings(harness, {
      token: "test-token",
      autoSummarize: false,
      model: "auto",
      uiLanguage: "en",
      language: "en",
    });
    const page = await openExtensionPage(harness, "sidepanel.html", "#title");
    await waitForPanelPort(page);
    await waitForSettingsHydratedHook(page);

    await sendBgMessage(harness, {
      type: "ui:state",
      state: buildUiState({
        settings: { tokenPresent: true, autoSummarize: false, model: "auto", length: "xl" },
        localRuntime: buildLocalRuntimeStatus({
          probes: [
            {
              ok: false,
              reachable: false,
              runtimeType: "openai-compatible",
              runtimeLabel: "OpenAI-compatible",
              endpointHost: "127.0.0.1:8080",
              timeoutMs: 1200,
              models: { count: 0, hints: [] },
              server: null,
              error: { code: "connection-error", message: "Local runtime probe failed." },
            },
          ],
        }),
      }),
    });

    await expect(page.locator("#localRuntimeStatus")).toHaveAttribute("data-state", "error");
    await expect(page.locator("#localRuntimePrivacy")).toHaveText("僅限本機");
    await expect(page.locator("#localRuntimeDetail")).toContainText(
      "啟動本機模型伺服器，或將 openai.baseUrl 設為 localhost",
    );
    assertNoErrors(harness);
  } finally {
    await closeExtension(harness.context, harness.userDataDir);
  }
});
