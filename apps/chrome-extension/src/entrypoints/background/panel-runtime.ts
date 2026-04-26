import { logExtensionEvent } from "../../lib/extension-logs";
import { fetchLocalRuntimeStatus } from "../../lib/local-runtime-status-client";
import type { LocalRuntimeStatus } from "../../lib/panel-contracts";
import { resolvePanelState } from "./panel-state";
import { summarizeActiveTab as runPanelSummarize } from "./panel-summarize";

const LOCAL_RUNTIME_STATUS_CACHE_MS = 15_000;

export function createBackgroundPanelRuntime<
  Session extends {
    windowId: number;
    port: chrome.runtime.Port;
    daemonRecovery: { clearPending: () => void };
  },
>(options: {
  panelSessionStore: {
    isPanelOpen: (session: Session) => boolean;
  } & Record<string, unknown>;
  loadSettings: typeof import("../../lib/settings").loadSettings;
  getActiveTab: typeof import("./panel-utils").getActiveTab;
  daemonHealth: typeof import("./daemon-client").daemonHealth;
  daemonPing: typeof import("./daemon-client").daemonPing;
  canSummarizeUrl: typeof import("./content-script-bridge").canSummarizeUrl;
  urlsMatch: typeof import("./panel-utils").urlsMatch;
  primeMediaHint: typeof import("./extract-cache").primeMediaHint;
  extractFromTab: typeof import("./content-script-bridge").extractFromTab;
  buildSummarizeRequestBody: typeof import("../lib/daemon-payload").buildSummarizeRequestBody;
  friendlyFetchError: typeof import("./daemon-client").friendlyFetchError;
  isDaemonUnreachableError: typeof import("../../lib/daemon-recovery").isDaemonUnreachableError;
  fetchImpl: typeof fetch;
  resolveLogLevel: (event: string) => "verbose" | "warn" | "error";
}) {
  const {
    panelSessionStore,
    loadSettings,
    getActiveTab,
    daemonHealth,
    daemonPing,
    canSummarizeUrl,
    urlsMatch,
    primeMediaHint,
    extractFromTab,
    buildSummarizeRequestBody,
    friendlyFetchError,
    isDaemonUnreachableError,
    fetchImpl,
    resolveLogLevel,
  } = options;

  const send = (session: Session, msg: unknown) => {
    if (!panelSessionStore.isPanelOpen(session)) return;
    try {
      session.port.postMessage(msg);
    } catch {
      // ignore
    }
  };

  const sendStatus = (session: Session, status: string) => {
    send(session, { type: "ui:status", status });
  };

  let localRuntimeStatusCache: { value: LocalRuntimeStatus; fetchedAt: number } | null = null;
  let localRuntimeStatusRefresh: Promise<void> | null = null;

  const getCachedLocalRuntimeStatus = () => {
    if (
      localRuntimeStatusCache &&
      Date.now() - localRuntimeStatusCache.fetchedAt < LOCAL_RUNTIME_STATUS_CACHE_MS
    ) {
      return localRuntimeStatusCache.value;
    }
    return null;
  };

  const refreshLocalRuntimeStatus = (session: Session) => {
    if (localRuntimeStatusRefresh) return;
    localRuntimeStatusRefresh = (async () => {
      let status: LocalRuntimeStatus;
      try {
        const settings = await loadSettings();
        const token = settings.token.trim();
        if (!token) return;
        status = await fetchLocalRuntimeStatus({ token, fetchImpl });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Local runtime status unavailable.";
        status = { ok: false, error: message };
      }
      localRuntimeStatusCache = { value: status, fetchedAt: Date.now() };
      send(session, { type: "ui:local-runtime-status", status });
    })().finally(() => {
      localRuntimeStatusRefresh = null;
    });
  };

  const emitState = async (
    session: Session,
    status: string,
    opts?: { checkRecovery?: boolean },
  ) => {
    const next = await resolvePanelState({
      session,
      status,
      checkRecovery: opts?.checkRecovery,
      loadSettings,
      getActiveTab,
      daemonHealth,
      daemonPing,
      localRuntimeStatus: getCachedLocalRuntimeStatus(),
      panelSessionStore,
      urlsMatch,
      canSummarizeUrl,
    });
    send(session, { type: "ui:state", state: next.state });
    if (
      !next.state.localRuntime &&
      next.state.settings.tokenPresent &&
      next.state.daemon.ok &&
      next.state.daemon.authed
    ) {
      refreshLocalRuntimeStatus(session);
    }

    if (next.shouldRecover) {
      void summarizeActiveTab(session, "daemon-recovered");
      return;
    }

    if (next.shouldClearPending) {
      session.daemonRecovery.clearPending();
    }

    if (next.shouldPrimeMedia) {
      void primeMediaHint({
        session,
        ...next.shouldPrimeMedia,
        panelSessionStore,
        urlsMatch,
        extractFromTab,
        emitState: (currentSession, nextStatus) => {
          void emitState(currentSession, nextStatus);
        },
      });
    }
  };

  const summarizeActiveTab = (
    session: Session,
    reason: string,
    opts?: { refresh?: boolean; inputMode?: "page" | "video" },
  ) =>
    runPanelSummarize({
      session,
      reason,
      opts,
      loadSettings,
      emitState: (currentSession, nextStatus) => emitState(currentSession, nextStatus),
      getActiveTab,
      canSummarizeUrl,
      panelSessionStore,
      sendStatus: (status) => sendStatus(session, status),
      send: (msg) => {
        send(session, msg);
      },
      fetchImpl,
      extractFromTab,
      urlsMatch,
      buildSummarizeRequestBody,
      friendlyFetchError,
      isDaemonUnreachableError,
      logPanel: (event, detail) => {
        void (async () => {
          const settings = await loadSettings();
          if (!settings.extendedLogging) return;
          const payload = detail ? { event, windowId: session.windowId, ...detail } : { event };
          const detailPayload = detail
            ? { windowId: session.windowId, ...detail }
            : { windowId: session.windowId };
          logExtensionEvent({
            event,
            detail: detailPayload,
            scope: "panel:bg",
            level: resolveLogLevel(event),
          });
          console.debug("[summarize][panel:bg]", payload);
        })();
      },
    });

  return { send, sendStatus, emitState, summarizeActiveTab };
}
