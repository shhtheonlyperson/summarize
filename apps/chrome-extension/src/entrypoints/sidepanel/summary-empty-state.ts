import { t } from "./i18n";
import type { PanelPhase } from "./types";

type SummaryEmptyStateInput = {
  tabTitle: string | null;
  tabUrl: string | null;
  autoSummarize: boolean;
  phase: PanelPhase;
  hasSlides: boolean;
};

export type SummaryEmptyState = {
  label: string;
  message: string;
  detail: string | null;
};

export function buildSummaryEmptyState(input: SummaryEmptyStateInput): SummaryEmptyState | null {
  if (input.hasSlides) return null;

  const subject = input.tabTitle?.trim() || input.tabUrl?.trim() || t("thisPage");
  if (!input.tabUrl) {
    return {
      label: t("noPage"),
      message: t("openPageToSummarize"),
      detail: null,
    };
  }

  if (input.phase === "connecting" || input.phase === "streaming" || input.autoSummarize) {
    return {
      label: t("loading"),
      message: t("preparingSummary"),
      detail: subject,
    };
  }

  return {
    label: t("ready"),
    message: t("clickSummarize"),
    detail: subject,
  };
}
