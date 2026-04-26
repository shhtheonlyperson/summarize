import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseLocalRuntimeDescriptor,
  type LocalRuntimeProbeResult,
} from "@steipete/summarize-core/local-runtime";
import { describe, expect, it, vi } from "vitest";
import { buildLocalRuntimeStatus } from "../src/daemon/local-runtime-status.js";
import { runDaemonServer } from "../src/daemon/server.js";

type ProbeLocalRuntimeFn = NonNullable<Parameters<typeof buildLocalRuntimeStatus>[0]["probe"]>;
type ProbeLocalRuntimeInput = Parameters<ProbeLocalRuntimeFn>[0];
type ProbeLocalRuntimeOptions = NonNullable<Parameters<ProbeLocalRuntimeFn>[1]>;

const findFreePort = async (): Promise<number> =>
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve port")));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });

describe("daemon local runtime status", () => {
  it("summarizes local-only, runtime host, routed model hints, and mocked probe status", async () => {
    const runtime = parseLocalRuntimeDescriptor({
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:8080/v1",
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const probe = vi.fn(
      async (_input: ProbeLocalRuntimeInput, options: ProbeLocalRuntimeOptions) => {
        expect(options.fetch).toBe(fetchImpl);
        expect(options.allowRemoteBaseUrls).toBe(false);
        return {
          ok: true,
          reachable: true,
          runtime,
          endpoint: "http://127.0.0.1:8080/v1/models",
          timeoutMs: options.timeoutMs ?? 0,
          models: [{ id: "gemma-local" }, { id: "qwen-local" }, { id: "llama-local" }],
          server: { status: 200, name: "llama.cpp" },
        } satisfies LocalRuntimeProbeResult;
      },
    ) as ProbeLocalRuntimeFn;

    const payload = await buildLocalRuntimeStatus({
      env: {
        OPENAI_BASE_URL: "http://127.0.0.1:8080/v1",
        OPENAI_API_KEY: "sk-should-not-leak",
        SUMMARIZE_MODEL: "auto",
      },
      config: {
        privacy: { localOnly: true },
        output: { language: "Traditional Chinese" },
        localRouting: {
          enabled: true,
          englishModel: "gemma-local",
          traditionalChineseModel: "qwen-local",
          bilingualModel: "qwen-bilingual-local",
          fallbackModel: "llama-local",
        },
      },
      fetchImpl,
      timeoutMs: 25,
      probe,
    });

    expect(payload.localOnly).toEqual({ enabled: true, source: "privacy.localOnly" });
    expect(payload.runtime).toEqual({
      configured: true,
      type: "openai-compatible",
      endpointHost: "127.0.0.1:8080",
      baseUrlSource: "configured",
    });
    expect(payload.modelHints.configuredModel).toEqual({ input: "auto", source: "env" });
    expect(payload.modelHints.localRoutingEnabled).toBe(true);
    expect(payload.modelHints.selected).toMatchObject({
      bucket: "traditionalChinese",
      modelInput: "openai/qwen-local",
    });
    expect(payload.modelHints.routes.map((route) => [route.bucket, route.modelInput])).toEqual([
      ["english", "openai/gemma-local"],
      ["traditionalChinese", "openai/qwen-local"],
      ["bilingual", "openai/qwen-bilingual-local"],
      ["fallback", "openai/llama-local"],
    ]);
    expect(payload.probes).toEqual([
      {
        ok: true,
        reachable: true,
        runtimeType: "openai-compatible",
        runtimeLabel: "OpenAI-compatible local endpoint",
        endpointHost: "127.0.0.1:8080",
        timeoutMs: 25,
        models: { count: 3, hints: ["gemma-local", "qwen-local", "llama-local"] },
        server: { status: 200, name: "llama.cpp" },
        error: null,
      },
    ]);
    expect(JSON.stringify(payload)).not.toContain("sk-should-not-leak");
    expect(JSON.stringify(payload)).not.toContain("OPENAI_API_KEY");
  });

  it("sanitizes invalid runtime probe errors before returning status", async () => {
    const probe = vi.fn(async () => {
      return {
        ok: false,
        reachable: false,
        timeoutMs: 10,
        error: {
          code: "invalid-runtime",
          message: "Invalid local runtime configuration: sk-sensitive-value",
          cause: "sk-sensitive-value",
        },
      } satisfies LocalRuntimeProbeResult;
    }) as ProbeLocalRuntimeFn;

    const payload = await buildLocalRuntimeStatus({
      env: {
        OPENAI_BASE_URL: "not a url with sk-sensitive-value",
        OPENAI_API_KEY: "sk-other-secret",
      },
      config: null,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      timeoutMs: 10,
      probe,
    });

    expect(payload.runtime).toEqual({
      configured: true,
      type: "openai-compatible",
      endpointHost: null,
      baseUrlSource: "configured",
    });
    expect(payload.probes[0]?.error).toEqual({
      code: "invalid-runtime",
      message: "Invalid local runtime configuration.",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("sk-sensitive-value");
    expect(serialized).not.toContain("sk-other-secret");
    expect(serialized).not.toContain("not a url");
  });

  it("does not surface retired local routing model inputs in status hints", async () => {
    const retiredQwen = ["qwen3.6", "35b", "a3b"].join("-");
    const runtime = parseLocalRuntimeDescriptor({
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:8080/v1",
    });
    const payload = await buildLocalRuntimeStatus({
      env: {
        OPENAI_BASE_URL: "http://127.0.0.1:8080/v1",
      },
      config: {
        output: { language: "Traditional Chinese" },
        localRouting: {
          enabled: true,
          traditionalChineseModel: retiredQwen,
          bilingualModel: `openai/${retiredQwen}`,
          fallbackModel: "gemma-local",
        },
      },
      fetchImpl: vi.fn() as unknown as typeof fetch,
      timeoutMs: 10,
      probe: vi.fn(async () => {
        return {
          ok: true,
          reachable: true,
          runtime,
          endpoint: "http://127.0.0.1:8080/v1/models",
          timeoutMs: 10,
          models: [{ id: "qwen3.6-27b" }],
          server: { status: 200 },
        } satisfies LocalRuntimeProbeResult;
      }) as ProbeLocalRuntimeFn,
    });

    expect(payload.modelHints.selected).toMatchObject({
      bucket: "traditionalChinese",
      modelInput: "openai/qwen3.6-27b",
    });
    expect(payload.modelHints.routes.map((route) => [route.bucket, route.modelInput])).toEqual([
      ["english", "openai/gemma-local"],
      ["traditionalChinese", "openai/qwen3.6-27b"],
      ["bilingual", "openai/qwen3.6-27b"],
      ["fallback", "openai/gemma-local"],
    ]);
    expect(JSON.stringify(payload)).not.toContain(retiredQwen);
  });

  it("serves the daemon endpoint behind bearer auth with mocked probe fetches", async () => {
    const home = mkdtempSync(join(tmpdir(), "summarize-daemon-local-runtime-status-"));
    const port = await findFreePort();
    const token = "test-token-local-runtime-status";
    const abortController = new AbortController();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "http://127.0.0.1:8080/v1/models") {
        return new Response(JSON.stringify({ data: [{ id: "llama-cpp-local" }] }), {
          status: 200,
          headers: { "content-type": "application/json", server: "llama.cpp" },
        });
      }
      if (url === "http://127.0.0.1:11434/api/tags") {
        return new Response(JSON.stringify({ models: [{ name: "ollama-local" }] }), {
          status: 200,
          headers: { "content-type": "application/json", "x-ollama-version": "0.12.7" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;

    let resolveReady: (() => void) | null = null;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const serverPromise = runDaemonServer({
      env: { HOME: home },
      fetchImpl,
      config: { token, port, version: 1, installedAt: new Date().toISOString() },
      port,
      signal: abortController.signal,
      onListening: () => resolveReady?.(),
    });

    await ready;

    try {
      const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/local-runtime/status`);
      expect(unauthorized.status).toBe(401);

      const response = await fetch(`http://127.0.0.1:${port}/v1/local-runtime/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        ok: boolean;
        runtime: { configured: boolean; type: string | null };
        probes: Array<{ ok: boolean; runtimeType: string; endpointHost: string; models: unknown }>;
        warnings: string[];
      };

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.runtime).toEqual({
        configured: false,
        type: null,
        endpointHost: null,
        baseUrlSource: null,
      });
      expect(payload.warnings).toHaveLength(1);
      expect(payload.probes.map((probe) => [probe.runtimeType, probe.endpointHost])).toEqual([
        ["llama-cpp", "127.0.0.1:8080"],
        ["ollama", "127.0.0.1:11434"],
      ]);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      abortController.abort();
      await serverPromise;
    }
  });
});
