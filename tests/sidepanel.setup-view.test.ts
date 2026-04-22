import { beforeEach, describe, expect, it } from "vitest";
import { setSidepanelUiLanguage } from "../apps/chrome-extension/src/entrypoints/sidepanel/i18n";
import { installStepsHtml } from "../apps/chrome-extension/src/entrypoints/sidepanel/setup-view";

describe("sidepanel setup view", () => {
  beforeEach(() => {
    setSidepanelUiLanguage("en");
  });

  it("renders the official Homebrew formula for mac setup", () => {
    const html = installStepsHtml({
      token: "token",
      headline: "Setup",
      platformKind: "mac",
    });

    expect(html).toContain("brew install summarize");
    expect(html).not.toContain("steipete/tap/summarize");
  });

  it("shows npm guidance for non-mac setup instead of the old tap warning", () => {
    const html = installStepsHtml({
      token: "token",
      headline: "Setup",
      platformKind: "linux",
    });

    expect(html).toContain("npm i -g @steipete/summarize");
    expect(html).toContain("NPM installs the CLI (requires Node.js).");
    expect(html).not.toContain("Homebrew tap is macOS-only.");
  });
});
