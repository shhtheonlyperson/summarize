import type { LocalRuntimeStatus, LocalRuntimeStatusPayload } from "./panel-contracts";

const LOCAL_RUNTIME_STATUS_TIMEOUT_MS = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocalRuntimeStatusPayload(
  value: Record<string, unknown>,
): value is LocalRuntimeStatusPayload {
  return (
    value.ok === true &&
    isRecord(value.localOnly) &&
    isRecord(value.runtime) &&
    isRecord(value.modelHints) &&
    Array.isArray(value.probes) &&
    Array.isArray(value.warnings)
  );
}

function statusHttpError(res: Response): string {
  if (res.status === 404) {
    return "Daemon does not support local runtime status. Restart the daemon after updating.";
  }
  const statusText = res.statusText.trim();
  return `Local runtime status failed (${res.status}${statusText ? ` ${statusText}` : ""})`;
}

export async function fetchLocalRuntimeStatus({
  token,
  fetchImpl = fetch,
}: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<LocalRuntimeStatus> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { ok: false, error: "Add the daemon token to check local runtime privacy." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_RUNTIME_STATUS_TIMEOUT_MS);
  try {
    const res = await fetchImpl("http://127.0.0.1:8787/v1/local-runtime/status?timeoutMs=1200", {
      headers: { Authorization: `Bearer ${trimmedToken}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: statusHttpError(res) };
    }
    const json = (await res.json()) as unknown;
    if (!isRecord(json) || !isLocalRuntimeStatusPayload(json)) {
      return { ok: false, error: "Daemon returned an invalid local runtime status." };
    }
    return json;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Local runtime status timed out." };
    }
    const message = err instanceof Error ? err.message : "Local runtime status failed.";
    if (message.toLowerCase() === "failed to fetch") {
      return {
        ok: false,
        error: "Local runtime status unavailable (daemon unreachable or blocked by Chrome).",
      };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
