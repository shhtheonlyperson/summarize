import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindSettingsStorage } from "../apps/chrome-extension/src/entrypoints/sidepanel/bindings";
import type { Settings } from "../apps/chrome-extension/src/lib/settings";

describe("sidepanel bindings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies persisted UI language changes from chrome storage", () => {
    const listeners: Array<
      (changes: Record<string, { newValue?: unknown }>, areaName: string) => void
    > = [];
    vi.stubGlobal("chrome", {
      storage: {
        onChanged: {
          addListener: vi.fn((listener) => listeners.push(listener)),
        },
      },
    });

    const calls: string[] = [];
    let pending: Partial<Settings> | null = null;

    bindSettingsStorage({
      applyChatEnabled: () => calls.push("apply-chat"),
      hideAutomationNotice: () => calls.push("hide-automation"),
      getSettingsHydrated: () => false,
      setPendingSettingsSnapshot: (value) => {
        pending = value;
      },
      getPendingSettingsSnapshot: () => pending,
      setChatEnabledValue: (value) => calls.push(`chat:${value}`),
      setAutomationEnabledValue: (value) => calls.push(`automation:${value}`),
      applyUiLanguage: (value) => calls.push(`language:${value}`),
    });

    listeners[0]?.(
      {
        settings: {
          newValue: { chatEnabled: false, automationEnabled: false, uiLanguage: "en" },
        },
      },
      "local",
    );

    expect(pending).toMatchObject({
      chatEnabled: false,
      automationEnabled: false,
      uiLanguage: "en",
    });
    expect(calls).toEqual([
      "chat:false",
      "apply-chat",
      "automation:false",
      "hide-automation",
      "language:en",
    ]);
  });
});
