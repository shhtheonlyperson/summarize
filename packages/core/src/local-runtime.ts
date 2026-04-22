export type LocalRuntimeKind = "openai-compatible" | "llama-cpp" | "ollama";
export type LocalRuntimeProtocol = "openai-compatible" | "ollama";
export type LocalRuntimeBaseUrlSource = "default" | "configured";

export type LocalRuntimeBaseUrlValidationIssue =
  | "missing"
  | "invalid-url"
  | "unsupported-protocol"
  | "credentials-not-allowed"
  | "query-or-hash-not-allowed"
  | "remote-host-not-allowed";

export type LocalRuntimeBaseUrlValidationOptions = {
  /**
   * Accept non-local hosts. Keep this false for built-in local defaults and
   * enable it only when a caller is intentionally handling an explicit remote endpoint.
   */
  allowRemote?: boolean;
  /**
   * Additional hostnames that a caller treats as local in its own environment.
   */
  allowedHosts?: readonly string[];
};

export type LocalRuntimeBaseUrlValidationResult =
  | {
      ok: true;
      baseUrl: string;
      host: string;
      hostname: string;
      isLocal: boolean;
    }
  | {
      ok: false;
      issue: LocalRuntimeBaseUrlValidationIssue;
      message: string;
      value: string;
    };

type LocalRuntimeDescriptorBase = {
  kind: LocalRuntimeKind;
  label: string;
  protocol: LocalRuntimeProtocol;
  baseUrl: string;
  baseUrlSource: LocalRuntimeBaseUrlSource;
  modelsPath: string;
  openAiCompatibleBaseUrl: string;
};

export type OpenAiCompatibleLocalRuntimeDescriptor = LocalRuntimeDescriptorBase & {
  kind: "openai-compatible";
  protocol: "openai-compatible";
  modelsPath: "/models";
};

export type LlamaCppLocalRuntimeDescriptor = LocalRuntimeDescriptorBase & {
  kind: "llama-cpp";
  protocol: "openai-compatible";
  modelsPath: "/models";
};

export type OllamaLocalRuntimeDescriptor = LocalRuntimeDescriptorBase & {
  kind: "ollama";
  protocol: "ollama";
  modelsPath: "/api/tags";
};

export type LocalRuntimeDescriptor =
  | OpenAiCompatibleLocalRuntimeDescriptor
  | LlamaCppLocalRuntimeDescriptor
  | OllamaLocalRuntimeDescriptor;

type LocalRuntimeRegistryEntry = Omit<
  LocalRuntimeDescriptorBase,
  "baseUrl" | "baseUrlSource" | "openAiCompatibleBaseUrl"
> & {
  defaultBaseUrl: string;
  defaultOpenAiCompatibleBaseUrl?: string;
};

export const LOCAL_RUNTIME_REGISTRY = {
  "openai-compatible": {
    kind: "openai-compatible",
    label: "OpenAI-compatible local endpoint",
    protocol: "openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:8080/v1",
    modelsPath: "/models",
  },
  "llama-cpp": {
    kind: "llama-cpp",
    label: "llama.cpp server",
    protocol: "openai-compatible",
    defaultBaseUrl: "http://127.0.0.1:8080/v1",
    modelsPath: "/models",
  },
  ollama: {
    kind: "ollama",
    label: "Ollama",
    protocol: "ollama",
    defaultBaseUrl: "http://127.0.0.1:11434",
    defaultOpenAiCompatibleBaseUrl: "http://127.0.0.1:11434/v1",
    modelsPath: "/api/tags",
  },
} as const satisfies Record<LocalRuntimeKind, LocalRuntimeRegistryEntry>;

export const LOCAL_RUNTIME_KINDS = Object.keys(LOCAL_RUNTIME_REGISTRY) as LocalRuntimeKind[];

export type LocalRuntimeDescriptorInput =
  | LocalRuntimeKind
  | {
      kind?: unknown;
      type?: unknown;
      runtime?: unknown;
      baseUrl?: unknown;
      openAiCompatibleBaseUrl?: unknown;
    };

export type ParseLocalRuntimeDescriptorOptions = {
  allowRemoteBaseUrls?: boolean;
  allowedHosts?: readonly string[];
};

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)]$/, "$1")
    .replace(/\.$/, "");
}

function normalizeAllowedHosts(hosts: readonly string[] | undefined): Set<string> {
  const normalized = new Set<string>();
  for (const host of hosts ?? []) {
    const value = normalizeHostname(host);
    if (value.length > 0) normalized.add(value);
  }
  return normalized;
}

function isLoopbackIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
  });
  return octets.every((part): part is number => typeof part === "number") && octets[0] === 127;
}

export function isLocalRuntimeHostname(
  hostname: string,
  options: Pick<LocalRuntimeBaseUrlValidationOptions, "allowedHosts"> = {},
): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if (normalizeAllowedHosts(options.allowedHosts).has(normalized)) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  return isLoopbackIpv4(normalized);
}

function normalizeUrl(url: URL): string {
  return url.toString().replace(/\/+$/, "");
}

export function validateLocalRuntimeBaseUrl(
  raw: unknown,
  options: LocalRuntimeBaseUrlValidationOptions = {},
): LocalRuntimeBaseUrlValidationResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return {
      ok: false,
      issue: "missing",
      message: "Local runtime base URL is required.",
      value,
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      issue: "invalid-url",
      message: `Invalid local runtime base URL: ${value}`,
      value,
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      issue: "unsupported-protocol",
      message: `Local runtime base URL must use http or https: ${value}`,
      value,
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      issue: "credentials-not-allowed",
      message: "Local runtime base URL must not include credentials.",
      value,
    };
  }

  if (url.search || url.hash) {
    return {
      ok: false,
      issue: "query-or-hash-not-allowed",
      message: "Local runtime base URL must not include query strings or fragments.",
      value,
    };
  }

  const isLocal = isLocalRuntimeHostname(url.hostname, { allowedHosts: options.allowedHosts });
  if (!isLocal && !options.allowRemote) {
    return {
      ok: false,
      issue: "remote-host-not-allowed",
      message: `Local runtime base URL host must be localhost or explicitly allowed: ${url.host}`,
      value,
    };
  }

  return {
    ok: true,
    baseUrl: normalizeUrl(url),
    host: url.host,
    hostname: url.hostname,
    isLocal,
  };
}

export function normalizeLocalRuntimeKind(raw: unknown): LocalRuntimeKind | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase().replaceAll("_", "-").replace(/\s+/g, "-");
  if (normalized === "openai" || normalized === "openai-compatible") {
    return "openai-compatible";
  }
  if (
    normalized === "llama" ||
    normalized === "llama-cpp" ||
    normalized === "llama.cpp" ||
    normalized === "llamacpp"
  ) {
    return "llama-cpp";
  }
  if (normalized === "ollama") return "ollama";
  return null;
}

function assertValidBaseUrl(raw: unknown, options: LocalRuntimeBaseUrlValidationOptions): string {
  const result = validateLocalRuntimeBaseUrl(raw, options);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.baseUrl;
}

function appendPath(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  const currentPath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${currentPath}/${path.replace(/^\/+/, "")}`;
  return normalizeUrl(url);
}

function removeTrailingPathSegment(baseUrl: string, segment: string): string | null {
  const url = new URL(baseUrl);
  const suffix = `/${segment.replace(/^\/+/, "")}`;
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== suffix && !path.endsWith(suffix)) return null;
  url.pathname = path.slice(0, -suffix.length) || "/";
  return normalizeUrl(url);
}

function resolveOllamaBaseUrls({
  baseUrl,
  openAiCompatibleBaseUrl,
}: {
  baseUrl: string;
  openAiCompatibleBaseUrl?: string;
}): { baseUrl: string; openAiCompatibleBaseUrl: string } {
  const rootBaseUrl = removeTrailingPathSegment(baseUrl, "v1") ?? baseUrl;
  return {
    baseUrl: rootBaseUrl,
    openAiCompatibleBaseUrl: openAiCompatibleBaseUrl ?? appendPath(rootBaseUrl, "v1"),
  };
}

export function getDefaultLocalRuntimeDescriptor(kind: LocalRuntimeKind): LocalRuntimeDescriptor {
  return parseLocalRuntimeDescriptor(kind);
}

export function parseLocalRuntimeDescriptor(
  input: unknown,
  options: ParseLocalRuntimeDescriptorOptions = {},
): LocalRuntimeDescriptor {
  const inputRecord =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  const kind = normalizeLocalRuntimeKind(
    typeof input === "string"
      ? input
      : (inputRecord?.kind ?? inputRecord?.type ?? inputRecord?.runtime),
  );
  if (!kind) {
    throw new Error(`Unknown local runtime kind: ${String(input)}`);
  }

  const registryEntry = LOCAL_RUNTIME_REGISTRY[kind];
  const validationOptions = {
    allowRemote: options.allowRemoteBaseUrls,
    allowedHosts: options.allowedHosts,
  };
  const rawBaseUrl = inputRecord?.baseUrl;
  const hasConfiguredBaseUrl = typeof rawBaseUrl === "string" && rawBaseUrl.trim().length > 0;
  const baseUrl = assertValidBaseUrl(
    hasConfiguredBaseUrl ? rawBaseUrl : registryEntry.defaultBaseUrl,
    validationOptions,
  );

  const rawOpenAiCompatibleBaseUrl = inputRecord?.openAiCompatibleBaseUrl;
  const configuredOpenAiCompatibleBaseUrl =
    typeof rawOpenAiCompatibleBaseUrl === "string" && rawOpenAiCompatibleBaseUrl.trim().length > 0
      ? assertValidBaseUrl(rawOpenAiCompatibleBaseUrl, validationOptions)
      : undefined;

  const common = {
    ...registryEntry,
    baseUrl,
    baseUrlSource: hasConfiguredBaseUrl ? "configured" : "default",
    openAiCompatibleBaseUrl: configuredOpenAiCompatibleBaseUrl ?? baseUrl,
  };

  if (kind === "ollama") {
    const resolved = resolveOllamaBaseUrls({
      baseUrl,
      openAiCompatibleBaseUrl: configuredOpenAiCompatibleBaseUrl,
    });
    return {
      ...common,
      baseUrl: resolved.baseUrl,
      openAiCompatibleBaseUrl: resolved.openAiCompatibleBaseUrl,
    } as OllamaLocalRuntimeDescriptor;
  }

  return common as LocalRuntimeDescriptor;
}

export const DEFAULT_LOCAL_RUNTIME_DESCRIPTORS = Object.fromEntries(
  LOCAL_RUNTIME_KINDS.map((kind) => [kind, getDefaultLocalRuntimeDescriptor(kind)]),
) as Readonly<Record<LocalRuntimeKind, LocalRuntimeDescriptor>>;

export const DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS = 3_000;

export type LocalRuntimeProbeErrorCode =
  | "invalid-runtime"
  | "http-error"
  | "malformed-response"
  | "network-error"
  | "timeout";

export type LocalRuntimeProbeError = {
  code: LocalRuntimeProbeErrorCode;
  message: string;
  status?: number;
  cause?: string;
};

export type LocalRuntimeProbeModel = {
  id: string;
  name?: string;
  object?: string;
  ownedBy?: string;
  created?: number;
  modifiedAt?: string;
  digest?: string;
  sizeBytes?: number;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
};

export type LocalRuntimeProbeServerMetadata = {
  status: number;
  name?: string;
  version?: string;
};

export type LocalRuntimeProbeSuccess = {
  ok: true;
  reachable: true;
  runtime: LocalRuntimeDescriptor;
  endpoint: string;
  timeoutMs: number;
  models: LocalRuntimeProbeModel[];
  server: LocalRuntimeProbeServerMetadata;
};

export type LocalRuntimeProbeFailure = {
  ok: false;
  reachable: false;
  runtime?: LocalRuntimeDescriptor;
  endpoint?: string;
  timeoutMs: number;
  error: LocalRuntimeProbeError;
};

export type LocalRuntimeProbeResult = LocalRuntimeProbeSuccess | LocalRuntimeProbeFailure;

export type LocalRuntimeProbeOptions = ParseLocalRuntimeDescriptorOptions & {
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type FetchProbeJsonResult =
  | {
      ok: true;
      response: Response;
      body: unknown;
    }
  | {
      ok: false;
      error: LocalRuntimeProbeError;
    };

type ParseProbeModelsResult =
  | {
      ok: true;
      models: LocalRuntimeProbeModel[];
    }
  | {
      ok: false;
      error: LocalRuntimeProbeError;
    };

function normalizeProbeTimeoutMs(timeoutMs: number | undefined): number {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS;
  return Math.max(0, timeoutMs ?? DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS);
}

function resolveProbeFetch(fetchImpl: typeof fetch | undefined): typeof fetch {
  return fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
}

function createTimeoutProbeError(timeoutMs: number): LocalRuntimeProbeError {
  return {
    code: "timeout",
    message: `Local runtime probe timed out after ${timeoutMs}ms.`,
  };
}

function describeUnknownError(error: unknown): string | undefined {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string" && error.length > 0) return error;
  return undefined;
}

function createNetworkProbeError(error: unknown, timeoutMs: number): LocalRuntimeProbeError {
  if (error instanceof Error && error.name === "AbortError") {
    return createTimeoutProbeError(timeoutMs);
  }

  const cause = describeUnknownError(error);
  return {
    code: "network-error",
    message: cause ? `Local runtime probe failed: ${cause}` : "Local runtime probe failed.",
    ...(cause ? { cause } : {}),
  };
}

function createMalformedResponseProbeError(
  message: string,
  cause?: unknown,
): LocalRuntimeProbeError {
  const describedCause = describeUnknownError(cause);
  return {
    code: "malformed-response",
    message,
    ...(describedCause ? { cause: describedCause } : {}),
  };
}

function createHttpProbeError(response: Response): LocalRuntimeProbeError {
  const suffix = response.statusText ? ` ${response.statusText}` : "";
  return {
    code: "http-error",
    message: `Local runtime probe failed with HTTP ${response.status}${suffix}.`,
    status: response.status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readProbeServerMetadata(response: Response): LocalRuntimeProbeServerMetadata {
  const server = response.headers.get("server") ?? undefined;
  const version =
    response.headers.get("x-ollama-version") ??
    response.headers.get("x-llama-cpp-version") ??
    response.headers.get("x-server-version") ??
    undefined;

  return {
    status: response.status,
    ...(server ? { name: server } : {}),
    ...(version ? { version } : {}),
  };
}

async function fetchProbeJson(
  endpoint: string,
  options: Pick<LocalRuntimeProbeOptions, "fetch" | "timeoutMs">,
): Promise<FetchProbeJsonResult> {
  const timeoutMs = normalizeProbeTimeoutMs(options.timeoutMs);
  const fetchImpl = resolveProbeFetch(options.fetch);
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const operation = (async (): Promise<FetchProbeJsonResult> => {
    try {
      const response = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: createHttpProbeError(response),
        };
      }

      try {
        return {
          ok: true,
          response,
          body: await response.json(),
        };
      } catch (error) {
        if (timedOut || (error instanceof Error && error.name === "AbortError")) {
          return {
            ok: false,
            error: createTimeoutProbeError(timeoutMs),
          };
        }

        return {
          ok: false,
          error: createMalformedResponseProbeError(
            "Local runtime probe response was not valid JSON.",
            error,
          ),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: timedOut
          ? createTimeoutProbeError(timeoutMs)
          : createNetworkProbeError(error, timeoutMs),
      };
    }
  })();

  const timeout = new Promise<FetchProbeJsonResult>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({
        ok: false,
        error: createTimeoutProbeError(timeoutMs),
      });
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseOpenAiCompatibleProbeModels(body: unknown): ParseProbeModelsResult {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return {
      ok: false,
      error: createMalformedResponseProbeError(
        "OpenAI-compatible models response must include a data array.",
      ),
    };
  }

  const models: LocalRuntimeProbeModel[] = [];
  for (const item of body.data) {
    if (!isRecord(item)) {
      return {
        ok: false,
        error: createMalformedResponseProbeError(
          "OpenAI-compatible models response included a non-object model.",
        ),
      };
    }

    const id = getStringField(item, "id");
    if (!id) {
      return {
        ok: false,
        error: createMalformedResponseProbeError(
          "OpenAI-compatible models response included a model without an id.",
        ),
      };
    }

    models.push({
      id,
      object: getStringField(item, "object"),
      ownedBy: getStringField(item, "owned_by"),
      created: getNumberField(item, "created"),
    });
  }

  return {
    ok: true,
    models,
  };
}

function parseOllamaProbeModels(body: unknown): ParseProbeModelsResult {
  if (!isRecord(body) || !Array.isArray(body.models)) {
    return {
      ok: false,
      error: createMalformedResponseProbeError("Ollama tags response must include a models array."),
    };
  }

  const models: LocalRuntimeProbeModel[] = [];
  for (const item of body.models) {
    if (!isRecord(item)) {
      return {
        ok: false,
        error: createMalformedResponseProbeError(
          "Ollama tags response included a non-object model.",
        ),
      };
    }

    const id = getStringField(item, "model") ?? getStringField(item, "name");
    if (!id) {
      return {
        ok: false,
        error: createMalformedResponseProbeError(
          "Ollama tags response included a model without a name.",
        ),
      };
    }

    const details = isRecord(item.details) ? item.details : {};
    models.push({
      id,
      name: getStringField(item, "name"),
      modifiedAt: getStringField(item, "modified_at"),
      digest: getStringField(item, "digest"),
      sizeBytes: getNumberField(item, "size"),
      family: getStringField(details, "family"),
      parameterSize: getStringField(details, "parameter_size"),
      quantizationLevel: getStringField(details, "quantization_level"),
    });
  }

  return {
    ok: true,
    models,
  };
}

function createProbeEndpoint(runtime: LocalRuntimeDescriptor): string {
  return appendPath(runtime.baseUrl, runtime.modelsPath);
}

async function probeRuntimeModelsEndpoint(
  runtime: LocalRuntimeDescriptor,
  options: LocalRuntimeProbeOptions,
  parseModels: (body: unknown) => ParseProbeModelsResult,
): Promise<LocalRuntimeProbeResult> {
  const timeoutMs = normalizeProbeTimeoutMs(options.timeoutMs);
  const endpoint = createProbeEndpoint(runtime);
  const response = await fetchProbeJson(endpoint, options);

  if (!response.ok) {
    return {
      ok: false,
      reachable: false,
      runtime,
      endpoint,
      timeoutMs,
      error: response.error,
    };
  }

  const parsedModels = parseModels(response.body);
  if (!parsedModels.ok) {
    return {
      ok: false,
      reachable: false,
      runtime,
      endpoint,
      timeoutMs,
      error: parsedModels.error,
    };
  }

  return {
    ok: true,
    reachable: true,
    runtime,
    endpoint,
    timeoutMs,
    models: parsedModels.models,
    server: readProbeServerMetadata(response.response),
  };
}

export async function probeOpenAiCompatibleLocalRuntime(
  runtime: OpenAiCompatibleLocalRuntimeDescriptor | LlamaCppLocalRuntimeDescriptor,
  options: LocalRuntimeProbeOptions = {},
): Promise<LocalRuntimeProbeResult> {
  return probeRuntimeModelsEndpoint(runtime, options, parseOpenAiCompatibleProbeModels);
}

export async function probeLlamaCppLocalRuntime(
  runtime: LlamaCppLocalRuntimeDescriptor,
  options: LocalRuntimeProbeOptions = {},
): Promise<LocalRuntimeProbeResult> {
  return probeOpenAiCompatibleLocalRuntime(runtime, options);
}

export async function probeOllamaLocalRuntime(
  runtime: OllamaLocalRuntimeDescriptor,
  options: LocalRuntimeProbeOptions = {},
): Promise<LocalRuntimeProbeResult> {
  return probeRuntimeModelsEndpoint(runtime, options, parseOllamaProbeModels);
}

export async function probeLocalRuntime(
  input: unknown,
  options: LocalRuntimeProbeOptions = {},
): Promise<LocalRuntimeProbeResult> {
  const timeoutMs = normalizeProbeTimeoutMs(options.timeoutMs);
  let runtime: LocalRuntimeDescriptor;
  try {
    runtime = parseLocalRuntimeDescriptor(input, {
      allowedHosts: options.allowedHosts,
      allowRemoteBaseUrls: options.allowRemoteBaseUrls,
    });
  } catch (error) {
    const cause = describeUnknownError(error);
    return {
      ok: false,
      reachable: false,
      timeoutMs,
      error: {
        code: "invalid-runtime",
        message: cause
          ? `Invalid local runtime configuration: ${cause}`
          : "Invalid local runtime configuration.",
        ...(cause ? { cause } : {}),
      },
    };
  }

  if (runtime.kind === "ollama") {
    return probeOllamaLocalRuntime(runtime, options);
  }

  return probeOpenAiCompatibleLocalRuntime(runtime, options);
}
