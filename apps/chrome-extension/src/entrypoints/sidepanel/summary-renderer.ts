import { selectMarkdownForLayout } from "./slides-state";
import { buildSummaryEmptyState } from "./summary-empty-state";
import { linkifyTimestamps } from "./timestamp-links";

export function renderSummaryEmptyState({
  hostEl,
  state,
}: {
  hostEl: HTMLElement;
  state: ReturnType<typeof buildSummaryEmptyState>;
}) {
  if (!state) {
    hostEl.innerHTML = "";
    return;
  }
  const wrapper = document.createElement("section");
  wrapper.className = "renderEmpty";
  wrapper.dataset.emptyState = "true";
  const label = document.createElement("div");
  label.className = "renderEmpty__label";
  label.textContent = state.label;
  const message = document.createElement("p");
  message.className = "renderEmpty__message";
  message.textContent = state.message;
  wrapper.append(label, message);
  if (state.detail) {
    const detail = document.createElement("p");
    detail.className = "renderEmpty__detail";
    detail.textContent = state.detail;
    wrapper.append(detail);
  }
  hostEl.replaceChildren(wrapper);
}

export function renderSummaryMarkdownDisplay({
  activeTabUrl,
  autoSummarize,
  currentSourceTitle,
  currentSourceUrl,
  hasSlides,
  headerSetStatus,
  hostEl,
  inputMode,
  markdown,
  md,
  phase,
  renderInlineSlides,
  slidesEnabled,
  slidesLayout,
  tabTitle,
  tabUrl,
}: {
  activeTabUrl: string | null;
  autoSummarize: boolean;
  currentSourceTitle: string | null;
  currentSourceUrl: string | null;
  hasSlides: boolean;
  headerSetStatus: (text: string) => void;
  hostEl: HTMLElement;
  inputMode: "page" | "video";
  markdown: string;
  md: { render: (value: string) => string };
  phase: string;
  renderInlineSlides: (container: HTMLElement, opts?: { fallback?: boolean }) => void;
  slidesEnabled: boolean;
  slidesLayout: string;
  tabTitle: string | null;
  tabUrl: string | null;
}) {
  const displayMarkdown = selectMarkdownForLayout({
    markdown,
    slidesEnabled,
    inputMode,
    hasSlides,
    slidesLayout,
  });
  if (!displayMarkdown.trim()) {
    renderSummaryEmptyState({
      hostEl,
      state: buildSummaryEmptyState({
        tabTitle: currentSourceTitle ?? tabTitle ?? null,
        tabUrl: currentSourceUrl ?? tabUrl ?? activeTabUrl ?? null,
        autoSummarize,
        phase,
        hasSlides,
      }),
    });
    return;
  }
  try {
    hostEl.innerHTML = md.render(linkifyTimestamps(displayMarkdown));
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    headerSetStatus(`Error: ${message}`);
    return;
  }
  for (const a of Array.from(hostEl.querySelectorAll("a"))) {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("timestamp:")) {
      a.classList.add("chatTimestamp");
      a.removeAttribute("target");
      a.removeAttribute("rel");
      continue;
    }
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  }
  renderInlineSlides(hostEl, { fallback: true });
}
