import type {
  LocalRuntimeStatus,
  LocalRuntimeStatusPayload,
  LocalRuntimeStatusProbe,
  UiState,
} from "../../lib/panel-contracts";
import {
  formatModelLabel,
  formatRouteLabel,
  formatRuntimeAt,
  formatRuntimeReachable,
  t,
} from "./i18n";

type LocalRuntimeTone = "ok" | "warn" | "error" | "neutral";

export type LocalRuntimeStatusView = {
  tone: LocalRuntimeTone;
  privacy: string;
  route: string;
  detail: string;
};

type LocalRuntimeStatusSurfaceOptions = {
  rootEl: HTMLElement;
  privacyEl: HTMLElement;
  routeEl: HTMLElement;
  detailEl: HTMLElement;
};

const remoteProviderPattern = /^(anthropic|google|openrouter|xai|zai|nvidia|github-copilot|cli)\//i;

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatBucket(bucket: string): string {
  if (bucket === "traditionalChinese") return t("bucketTraditionalChinese");
  if (bucket === "bilingual") return t("bucketBilingual");
  if (bucket === "english") return t("bucketEnglish");
  return t("bucketFallback");
}

function selectedModelInput(status: LocalRuntimeStatusPayload, state: UiState): string {
  const explicitModel = trimText(state.settings.model);
  if (explicitModel && explicitModel !== "auto") return explicitModel;
  const routed = trimText(status.modelHints.selected?.modelInput);
  if (routed) return routed;
  const configured = trimText(status.modelHints.configuredModel.input);
  return configured || explicitModel || "auto";
}

function routeLabel(status: LocalRuntimeStatusPayload, state: UiState): string {
  if (status.modelHints.selected) {
    return formatRouteLabel(
      formatBucket(status.modelHints.selected.bucket),
      status.modelHints.selected.modelInput,
    );
  }

  const explicitModel = trimText(state.settings.model) || "auto";
  const configured = trimText(status.modelHints.configuredModel.input);
  if (explicitModel === "auto" && configured && configured !== "auto") {
    return formatModelLabel(`auto -> ${configured}`);
  }
  return formatModelLabel(explicitModel);
}

function selectProbe(status: LocalRuntimeStatusPayload): LocalRuntimeStatusProbe | null {
  if (status.runtime.configured) {
    const configured = status.probes.find((probe) => {
      if (status.runtime.endpointHost && probe.endpointHost === status.runtime.endpointHost) {
        return true;
      }
      return status.runtime.type !== null && probe.runtimeType === status.runtime.type;
    });
    if (configured) return configured;
  }
  return status.probes.find((probe) => probe.reachable) ?? status.probes[0] ?? null;
}

function runtimeLabel(probe: LocalRuntimeStatusProbe | null): string {
  if (!probe) return t("localRuntimeGeneric");
  const label =
    trimText(probe.runtimeLabel) || trimText(probe.runtimeType) || t("localRuntimeGeneric");
  const host = trimText(probe.endpointHost);
  return host ? formatRuntimeAt(label, host) : label;
}

function probeAction(errorCode: string | null): string {
  if (errorCode === "invalid-runtime") {
    return t("invalidRuntimeAction");
  }
  if (errorCode === "timeout") {
    return t("timeoutRuntimeAction");
  }
  return t("runtimeSetupAction");
}

function probeFailureDetail(probe: LocalRuntimeStatusProbe | null): string {
  const message = trimText(probe?.error?.message) || t("runtimeUnreachable");
  const action = probeAction(trimText(probe?.error?.code) || null);
  return `${message} ${action}`;
}

function isConfirmedLocalModel(status: LocalRuntimeStatusPayload, modelInput: string): boolean {
  const normalized = modelInput.trim().toLowerCase();
  if (!normalized || normalized === "auto" || normalized === "free") return false;
  if (remoteProviderPattern.test(normalized)) return false;
  if (!normalized.startsWith("openai/")) return false;
  if (!status.runtime.endpointHost) return false;
  return status.probes.some(
    (probe) => probe.reachable && probe.endpointHost === status.runtime.endpointHost,
  );
}

export function buildLocalRuntimeStatusView(
  state: UiState | null,
  localRuntimeOverride?: LocalRuntimeStatus | null,
): LocalRuntimeStatusView {
  if (!state) {
    return {
      tone: "neutral",
      privacy: t("checkingLocalPrivacy"),
      route: t("modelAuto"),
      detail: t("waitingDaemonStatus"),
    };
  }

  const fallbackRoute = formatModelLabel(trimText(state.settings.model) || "auto");
  if (!state.settings.tokenPresent) {
    return {
      tone: "warn",
      privacy: t("setupNeeded"),
      route: fallbackRoute,
      detail: t("addDaemonToken"),
    };
  }

  if (!state.daemon.ok || !state.daemon.authed) {
    return {
      tone: "warn",
      privacy: t("daemonOffline"),
      route: fallbackRoute,
      detail: state.daemon.error || t("runDaemonStatus"),
    };
  }

  const status = localRuntimeOverride ?? state.localRuntime;
  if (!status) {
    return {
      tone: "neutral",
      privacy: t("checkingLocalPrivacy"),
      route: fallbackRoute,
      detail: t("waitingLocalRuntimeStatus"),
    };
  }

  if (!status.ok) {
    return {
      tone: "warn",
      privacy: t("localStatusUnavailable"),
      route: fallbackRoute,
      detail: status.error,
    };
  }

  const probe = selectProbe(status);
  const reachable = Boolean(probe?.reachable);
  const route = routeLabel(status, state);
  const modelInput = selectedModelInput(status, state);
  const runtimeDetail = reachable
    ? formatRuntimeReachable(runtimeLabel(probe))
    : probeFailureDetail(probe);

  if (status.localOnly.enabled) {
    return {
      tone: reachable ? "ok" : "error",
      privacy: t("localOnlyOn"),
      route,
      detail: runtimeDetail,
    };
  }

  if (isConfirmedLocalModel(status, modelInput)) {
    return {
      tone: reachable ? "ok" : "warn",
      privacy: t("localRuntime"),
      route,
      detail: runtimeDetail,
    };
  }

  const warning = status.warnings.find((entry) => entry.trim().length > 0);
  return {
    tone: "warn",
    privacy: t("remoteAllowed"),
    route,
    detail: warning ?? t("remoteAllowedDetail"),
  };
}

export function createLocalRuntimeStatusSurface(options: LocalRuntimeStatusSurfaceOptions) {
  let lastState: UiState | null = null;

  const render = (state: UiState | null) => {
    lastState = state;
    const view = buildLocalRuntimeStatusView(state);
    options.rootEl.dataset.state = view.tone;
    options.privacyEl.textContent = view.privacy;
    options.routeEl.textContent = view.route;
    options.detailEl.textContent = view.detail;
    options.rootEl.title = `${view.privacy}. ${view.route}. ${view.detail}`;
  };

  const renderStatus = (status: LocalRuntimeStatus) => {
    if (!lastState) return;
    render({ ...lastState, localRuntime: status });
  };

  return { render, renderStatus };
}
