// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  renderSummaryEmptyState,
  renderSummaryMarkdownDisplay,
} from "../apps/chrome-extension/src/entrypoints/sidepanel/summary-renderer.js";

describe("sidepanel summary renderer", () => {
  it("renders and clears empty states", () => {
    const hostEl = document.createElement("div");
    renderSummaryEmptyState({
      hostEl,
      state: { label: "Loading", message: "Preparing summary", detail: "Video title" },
    });
    expect(hostEl.textContent).toContain("Loading");
    expect(hostEl.textContent).toContain("Preparing summary");
    expect(hostEl.textContent).toContain("Video title");

    renderSummaryEmptyState({ hostEl, state: null });
    expect(hostEl.innerHTML).toBe("");
  });

  it("renders markdown links and timestamp anchors", () => {
    const hostEl = document.createElement("div");
    const renderInlineSlides = vi.fn();
    renderSummaryMarkdownDisplay({
      activeTabUrl: "https://example.com/watch",
      autoSummarize: false,
      currentSourceTitle: "Video",
      currentSourceUrl: "https://example.com/watch",
      hasSlides: false,
      headerSetStatus: vi.fn(),
      hostEl,
      inputMode: "video",
      markdown: "[00:10] intro\n\n[link](https://example.com)",
      md: {
        render: (value) =>
          value
            .replace("[00:10](timestamp:10)", '<a href="timestamp:10">00:10</a>')
            .replace("[link](https://example.com)", '<a href="https://example.com">link</a>'),
      },
      phase: "done",
      renderInlineSlides,
      slidesEnabled: false,
      slidesLayout: "gallery",
      tabTitle: "Video",
      tabUrl: "https://example.com/watch",
    });

    const links = Array.from(hostEl.querySelectorAll("a"));
    expect(links[0]?.classList.contains("chatTimestamp")).toBe(true);
    expect(links[0]?.getAttribute("target")).toBeNull();
    expect(links[1]?.getAttribute("target")).toBe("_blank");
    expect(renderInlineSlides).toHaveBeenCalledWith(hostEl, { fallback: true });
  });

  it("falls back to the empty state and reports markdown render errors", () => {
    const hostEl = document.createElement("div");
    const setStatus = vi.fn();

    renderSummaryMarkdownDisplay({
      activeTabUrl: "https://example.com/watch",
      autoSummarize: true,
      currentSourceTitle: "Video",
      currentSourceUrl: "https://example.com/watch",
      hasSlides: false,
      headerSetStatus: setStatus,
      hostEl,
      inputMode: "video",
      markdown: "",
      md: { render: (value) => value },
      phase: "connecting",
      renderInlineSlides: vi.fn(),
      slidesEnabled: false,
      slidesLayout: "gallery",
      tabTitle: "Video",
      tabUrl: "https://example.com/watch",
    });
    expect(hostEl.textContent).toContain("Preparing summary");

    renderSummaryMarkdownDisplay({
      activeTabUrl: "https://example.com/watch",
      autoSummarize: false,
      currentSourceTitle: "Video",
      currentSourceUrl: "https://example.com/watch",
      hasSlides: false,
      headerSetStatus: setStatus,
      hostEl,
      inputMode: "video",
      markdown: "body",
      md: {
        render: () => {
          throw new Error("broken markdown");
        },
      },
      phase: "done",
      renderInlineSlides: vi.fn(),
      slidesEnabled: false,
      slidesLayout: "gallery",
      tabTitle: "Video",
      tabUrl: "https://example.com/watch",
    });
    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("broken markdown"));
  });
});
