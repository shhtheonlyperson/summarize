import {
  DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS,
  type LocalRuntimeKind,
  type LocalRuntimeProbeResult,
  normalizeLocalRuntimeKind,
  probeLocalRuntime,
} from "@steipete/summarize-core/local-runtime";
import { loadSummarizeConfig } from "../config.js";
import { parseDurationMs } from "../flags.js";
import { buildLocalRuntimeHelp } from "./help.js";

type LocalRuntimeProbeCliContext = {
  normalizedArgv: string[];
  envForRun: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  stdout: NodeJS.WritableStream;
  setExitCode?: (code: number) => void;
};

type LocalRuntimeProbeCliOptions = {
  runtime: LocalRuntimeKind | null;
  baseUrl: string | null;
  json: boolean;
  allowRemote: boolean;
  timeoutMs: number;
};

type LocalRuntimeProbeCliTarget = {
  input:
    | LocalRuntimeKind
    | {
        kind: LocalRuntimeKind;
        baseUrl?: string;
      };
};

type LocalRuntimeProbeCliPayload = {
  ok: boolean;
  warnings: string[];
  results: LocalRuntimeProbeResult[];
};

function hasArg(argv: string[], name: string): boolean {
  return argv.includes(name) || argv.some((arg) => arg.startsWith(`${name}=`));
}

function wantsHelp(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h") || argv.includes("help");
}

function readArgValue(argv: string[], name: string): string | null {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) {
    const value = eq.slice(`${name}=`.length).trim();
    if (!value) throw new Error(`Missing value for ${name}`);
    return value;
  }
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const next = argv[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`Missing value for ${name}`);
  }
  return next.trim() || null;
}

function parseProbeTimeout(raw: string | null): number {
  if (!raw) return DEFAULT_LOCAL_RUNTIME_PROBE_TIMEOUT_MS;
  try {
    return parseDurationMs(raw);
  } catch {
    throw new Error(`Unsupported --timeout: ${raw}`);
  }
}

function parseLocalRuntimeProbeOptions(argv: string[]): LocalRuntimeProbeCliOptions {
  const args = argv.slice(2);
  let runtime: LocalRuntimeKind | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--json" || arg === "--allow-remote" || arg === "--help" || arg === "-h") {
      continue;
    }
    if (arg.startsWith("--timeout=") || arg.startsWith("--base-url=")) {
      continue;
    }
    if (arg === "--timeout" || arg === "--base-url") {
      const next = args[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown local-runtime probe option: ${arg}`);
    }
    if (runtime) {
      throw new Error(`Unexpected local-runtime probe argument: ${arg}`);
    }
    const normalized = normalizeLocalRuntimeKind(arg);
    if (!normalized) {
      throw new Error(`Unsupported local runtime: ${arg}`);
    }
    runtime = normalized;
  }

  return {
    runtime,
    baseUrl: readArgValue(args, "--base-url"),
    json: hasArg(args, "--json"),
    allowRemote: hasArg(args, "--allow-remote"),
    timeoutMs: parseProbeTimeout(readArgValue(args, "--timeout")),
  };
}

function configuredOpenAiBaseUrl({
  envForRun,
}: {
  envForRun: Record<string, string | undefined>;
}): string | null {
  const { config } = loadSummarizeConfig({ env: envForRun });
  const envValue = envForRun.OPENAI_BASE_URL?.trim() ?? "";
  if (envValue) return envValue;
  const configValue = config?.openai?.baseUrl?.trim() ?? "";
  return configValue || null;
}

function resolveProbeTargets({
  options,
  envForRun,
}: {
  options: LocalRuntimeProbeCliOptions;
  envForRun: Record<string, string | undefined>;
}): { targets: LocalRuntimeProbeCliTarget[]; warnings: string[] } {
  const openAiBaseUrl = configuredOpenAiBaseUrl({ envForRun });
  const warnings: string[] = [];

  if (options.runtime) {
    const baseUrl = options.baseUrl ?? (options.runtime === "ollama" ? null : openAiBaseUrl);
    return {
      targets: [
        {
          input: baseUrl ? { kind: options.runtime, baseUrl } : options.runtime,
        },
      ],
      warnings,
    };
  }

  if (options.baseUrl) {
    return {
      targets: [{ input: { kind: "openai-compatible", baseUrl: options.baseUrl } }],
      warnings,
    };
  }

  if (openAiBaseUrl) {
    return {
      targets: [{ input: { kind: "openai-compatible", baseUrl: openAiBaseUrl } }],
      warnings,
    };
  }

  warnings.push(
    "No local OpenAI-compatible endpoint is configured; probing default llama.cpp and Ollama endpoints.",
  );
  return {
    targets: [{ input: "llama-cpp" }, { input: "ollama" }],
    warnings,
  };
}

function formatModelList(result: LocalRuntimeProbeResult): string {
  if (!result.ok) return "";
  if (result.models.length === 0) return "none";
  const ids = result.models.map((model) => model.id).slice(0, 4);
  const suffix =
    result.models.length > ids.length ? `, +${result.models.length - ids.length} more` : "";
  return `${ids.join(", ")}${suffix}`;
}

function formatServerLine(result: LocalRuntimeProbeResult): string | null {
  if (!result.ok) return null;
  const parts = [`status=${result.server.status}`];
  if (result.server.name) parts.push(`server=${result.server.name}`);
  if (result.server.version) parts.push(`version=${result.server.version}`);
  return parts.join(" ");
}

function writeHumanProbeResult(
  stdout: NodeJS.WritableStream,
  result: LocalRuntimeProbeResult,
): void {
  if (!result.ok) {
    const runtimeLabel = result.runtime
      ? `${result.runtime.label} (${result.runtime.kind})`
      : "Local runtime";
    stdout.write(`FAIL ${runtimeLabel}\n`);
    if (result.endpoint) stdout.write(`  Endpoint: ${result.endpoint}\n`);
    stdout.write(`  Error: ${result.error.message} (${result.error.code})\n`);
    return;
  }

  const modelCount = result.models.length;
  const level = modelCount > 0 ? "OK" : "WARN";
  stdout.write(`${level} ${result.runtime.label} (${result.runtime.kind})\n`);
  stdout.write(`  Endpoint: ${result.endpoint}\n`);
  if (modelCount > 0) {
    stdout.write(`  Models: ${formatModelList(result)} (${modelCount})\n`);
  } else {
    stdout.write("  Warning: endpoint is reachable but returned no models.\n");
  }
  const server = formatServerLine(result);
  if (server) stdout.write(`  Server: ${server}\n`);
}

function writeHumanProbePayload(
  stdout: NodeJS.WritableStream,
  payload: LocalRuntimeProbeCliPayload,
): void {
  stdout.write("Local runtime probe\n");
  for (const warning of payload.warnings) {
    stdout.write(`WARN ${warning}\n`);
  }
  for (const result of payload.results) {
    writeHumanProbeResult(stdout, result);
  }
}

export async function handleLocalRuntimeProbeRequest({
  normalizedArgv,
  envForRun,
  fetchImpl,
  stdout,
  setExitCode,
}: LocalRuntimeProbeCliContext): Promise<boolean> {
  const command = normalizedArgv[0]?.toLowerCase();
  if (command !== "local-runtime") return false;

  const subcommand = normalizedArgv[1]?.toLowerCase() ?? null;
  if (!subcommand || wantsHelp(normalizedArgv)) {
    stdout.write(`${buildLocalRuntimeHelp()}\n`);
    return true;
  }

  if (subcommand !== "probe") {
    stdout.write(`${buildLocalRuntimeHelp()}\n`);
    return true;
  }

  const options = parseLocalRuntimeProbeOptions(normalizedArgv);
  const { targets, warnings } = resolveProbeTargets({ options, envForRun });
  const results = await Promise.all(
    targets.map((target) =>
      probeLocalRuntime(target.input, {
        fetch: fetchImpl,
        timeoutMs: options.timeoutMs,
        allowRemoteBaseUrls: options.allowRemote,
      }),
    ),
  );
  const payload: LocalRuntimeProbeCliPayload = {
    ok: results.every((result) => result.ok),
    warnings,
    results,
  };

  if (options.json) {
    stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    writeHumanProbePayload(stdout, payload);
  }

  if (!payload.ok) {
    setExitCode?.(1);
  }
  return true;
}
