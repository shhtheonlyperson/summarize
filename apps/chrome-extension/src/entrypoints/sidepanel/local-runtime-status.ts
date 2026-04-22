import type {
  LocalRuntimeStatus,
  LocalRuntimeStatusPayload,
  LocalRuntimeStatusProbe,
  UiState,
} from "../../lib/panel-contracts";

type LocalRuntimeTone = "ok" | "warn" | "error" | "neutral";

type LocalRuntimeStatusView = {
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
  if (bucket === "traditionalChinese") return "Traditional Chinese";
  if (bucket === "bilingual") return "Bilingual";
  if (bucket === "english") return "English";
  return "Fallback";
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
    return `Route: ${formatBucket(status.modelHints.selected.bucket)} -> ${
      status.modelHints.selected.modelInput
    }`;
  }

  const explicitModel = trimText(state.settings.model) || "auto";
  const configured = trimText(status.modelHints.configuredModel.input);
  if (explicitModel === "auto" && configured && configured !== "auto") {
    return `Model: auto -> ${configured}`;
  }
  return `Model: ${explicitModel}`;
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
  if (!probe) return "local runtime";
  const label = trimText(probe.runtimeLabel) || trimText(probe.runtimeType) || "local runtime";
  const host = trimText(probe.endpointHost);
  return host ? `${label} at ${host}` : label;
}

function probeAction(errorCode: string | null): string {
  if (errorCode === "invalid-runtime") {
    return "Check openai.baseUrl; use a localhost http URL without credentials, query, or fragment.";
  }
  if (errorCode === "timeout") {
    return "Start your local model server, then run summarize local-runtime probe.";
  }
  return "Start your local model server or set openai.baseUrl to localhost, then restart the daemon.";
}

function probeFailureDetail(probe: LocalRuntimeStatusProbe | null): string {
  const message = trimText(probe?.error?.message) || "Local runtime is not reachable.";
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

function buildView(
  state: UiState | null,
  localRuntimeOverride?: LocalRuntimeStatus | null,
): LocalRuntimeStatusView {
  if (!state) {
    return {
      tone: "neutral",
      privacy: "Checking local privacy",
      route: "Model: auto",
      detail: "Waiting for daemon status.",
    };
  }

  const fallbackRoute = `Model: ${trimText(state.settings.model) || "auto"}`;
  if (!state.settings.tokenPresent) {
    return {
      tone: "warn",
      privacy: "Setup needed",
      route: fallbackRoute,
      detail: "Add the daemon token to check local runtime privacy.",
    };
  }

  if (!state.daemon.ok || !state.daemon.authed) {
    return {
      tone: "warn",
      privacy: "Daemon offline",
      route: fallbackRoute,
      detail: state.daemon.error || "Run summarize daemon status, then restart the daemon.",
    };
  }

  const status = localRuntimeOverride ?? state.localRuntime;
  if (!status) {
    return {
      tone: "neutral",
      privacy: "Checking local privacy",
      route: fallbackRoute,
      detail: "Waiting for local runtime status.",
    };
  }

  if (!status.ok) {
    return {
      tone: "warn",
      privacy: "Local status unavailable",
      route: fallbackRoute,
      detail: status.error,
    };
  }

  const probe = selectProbe(status);
  const reachable = Boolean(probe?.reachable);
  const route = routeLabel(status, state);
  const modelInput = selectedModelInput(status, state);
  const runtimeDetail = reachable
    ? `Runtime reachable: ${runtimeLabel(probe)}.`
    : probeFailureDetail(probe);

  if (status.localOnly.enabled) {
    return {
      tone: reachable ? "ok" : "error",
      privacy: "Local-only on",
      route,
      detail: runtimeDetail,
    };
  }

  if (isConfirmedLocalModel(status, modelInput)) {
    return {
      tone: reachable ? "ok" : "warn",
      privacy: "Local runtime",
      route,
      detail: runtimeDetail,
    };
  }

  const warning = status.warnings.find((entry) => entry.trim().length > 0);
  return {
    tone: "warn",
    privacy: "Remote allowed",
    route,
    detail:
      warning ??
      "Cloud providers may be used. Enable privacy.localOnly in daemon config to block remote routes.",
  };
}

export function createLocalRuntimeStatusSurface(options: LocalRuntimeStatusSurfaceOptions) {
  let lastState: UiState | null = null;

  const render = (state: UiState | null) => {
    lastState = state;
    const view = buildView(state);
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
