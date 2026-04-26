import {
  DEFAULT_LOCAL_RUNTIME_DESCRIPTORS,
  LOCAL_RUNTIME_KINDS,
  isLocalRuntimeHostname,
  parseLocalRuntimeDescriptor,
  probeLocalRuntime,
  probeOllamaLocalRuntime,
  probeOpenAiCompatibleLocalRuntime,
  validateLocalRuntimeBaseUrl,
} from "@steipete/summarize-core/local-runtime";
import { describe, expect, it, vi } from "vitest";

describe("local runtime registry", () => {
  it("ships localhost-first defaults for each supported runtime", () => {
    expect(LOCAL_RUNTIME_KINDS).toEqual(["openai-compatible", "llama-cpp", "ollama"]);

    for (const descriptor of Object.values(DEFAULT_LOCAL_RUNTIME_DESCRIPTORS)) {
      expect(descriptor.baseUrlSource).toBe("default");
      expect(descriptor.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);

      const validation = validateLocalRuntimeBaseUrl(descriptor.baseUrl);
      expect(validation).toMatchObject({ ok: true, isLocal: true });
    }

    expect(DEFAULT_LOCAL_RUNTIME_DESCRIPTORS["openai-compatible"]).toMatchObject({
      kind: "openai-compatible",
      protocol: "openai-compatible",
      baseUrl: "http://127.0.0.1:8080/v1",
      openAiCompatibleBaseUrl: "http://127.0.0.1:8080/v1",
    });
    expect(DEFAULT_LOCAL_RUNTIME_DESCRIPTORS["llama-cpp"]).toMatchObject({
      kind: "llama-cpp",
      protocol: "openai-compatible",
      baseUrl: "http://127.0.0.1:8080/v1",
      openAiCompatibleBaseUrl: "http://127.0.0.1:8080/v1",
    });
    expect(DEFAULT_LOCAL_RUNTIME_DESCRIPTORS.ollama).toMatchObject({
      kind: "ollama",
      protocol: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      openAiCompatibleBaseUrl: "http://127.0.0.1:11434/v1",
    });
  });

  it("parses string aliases and configured descriptor objects", () => {
    expect(parseLocalRuntimeDescriptor("openai")).toMatchObject({
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:8080/v1",
      baseUrlSource: "default",
    });

    expect(
      parseLocalRuntimeDescriptor({
        kind: "llama.cpp",
        baseUrl: " http://localhost:8080/v1/ ",
      }),
    ).toMatchObject({
      kind: "llama-cpp",
      protocol: "openai-compatible",
      baseUrl: "http://localhost:8080/v1",
      baseUrlSource: "configured",
      openAiCompatibleBaseUrl: "http://localhost:8080/v1",
    });

    expect(
      parseLocalRuntimeDescriptor({
        type: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
      }),
    ).toMatchObject({
      kind: "ollama",
      protocol: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      baseUrlSource: "configured",
      openAiCompatibleBaseUrl: "http://127.0.0.1:11434/v1",
    });
  });

  it("rejects remote runtime URLs unless a caller explicitly allows them", () => {
    expect(validateLocalRuntimeBaseUrl("https://api.openai.com/v1")).toMatchObject({
      ok: false,
      issue: "remote-host-not-allowed",
    });

    expect(
      validateLocalRuntimeBaseUrl("https://gateway.example.com/v1", { allowRemote: true }),
    ).toMatchObject({
      ok: true,
      baseUrl: "https://gateway.example.com/v1",
      isLocal: false,
    });

    expect(() =>
      parseLocalRuntimeDescriptor({
        kind: "openai-compatible",
        baseUrl: "https://gateway.example.com/v1",
      }),
    ).toThrow(/localhost or explicitly allowed/i);

    expect(
      parseLocalRuntimeDescriptor(
        {
          kind: "openai-compatible",
          baseUrl: "https://gateway.example.com/v1",
        },
        { allowRemoteBaseUrls: true },
      ),
    ).toMatchObject({
      kind: "openai-compatible",
      baseUrl: "https://gateway.example.com/v1",
      baseUrlSource: "configured",
    });
  });

  it("validates loopback hosts and rejects unsafe base URL shapes", () => {
    expect(isLocalRuntimeHostname("localhost")).toBe(true);
    expect(isLocalRuntimeHostname("models.localhost")).toBe(true);
    expect(isLocalRuntimeHostname("127.12.0.1")).toBe(true);
    expect(isLocalRuntimeHostname("[::1]")).toBe(true);
    expect(isLocalRuntimeHostname("192.168.1.10")).toBe(false);
    expect(
      isLocalRuntimeHostname("host.docker.internal", { allowedHosts: ["host.docker.internal"] }),
    ).toBe(true);

    expect(validateLocalRuntimeBaseUrl("ftp://127.0.0.1:8080/v1")).toMatchObject({
      ok: false,
      issue: "unsupported-protocol",
    });
    expect(validateLocalRuntimeBaseUrl("http://user:pass@127.0.0.1:8080/v1")).toMatchObject({
      ok: false,
      issue: "credentials-not-allowed",
    });
    expect(validateLocalRuntimeBaseUrl("http://127.0.0.1:8080/v1?token=secret")).toMatchObject({
      ok: false,
      issue: "query-or-hash-not-allowed",
    });
  });
});

describe("local runtime probes", () => {
  it("probes reachable OpenAI-compatible llama.cpp model endpoints", async () => {
    const descriptor = parseLocalRuntimeDescriptor("llama-cpp");
    if (descriptor.kind === "ollama") {
      throw new Error("expected OpenAI-compatible descriptor");
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:8080/v1/models");
      expect(init).toMatchObject({
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return new Response(
        JSON.stringify({
          object: "list",
          data: [
            {
              id: "llama-3.2-local",
              object: "model",
              owned_by: "llama.cpp",
              created: 1_725_000_000,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            server: "llama.cpp",
          },
        },
      );
    });

    const result = await probeOpenAiCompatibleLocalRuntime(descriptor, {
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 50,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      reachable: true,
      endpoint: "http://127.0.0.1:8080/v1/models",
      timeoutMs: 50,
      models: [
        {
          id: "llama-3.2-local",
          object: "model",
          ownedBy: "llama.cpp",
          created: 1_725_000_000,
        },
      ],
      server: {
        status: 200,
        name: "llama.cpp",
      },
    });
  });

  it("probes reachable Ollama tag endpoints and returns model metadata", async () => {
    const descriptor = parseLocalRuntimeDescriptor("ollama");
    if (descriptor.kind !== "ollama") {
      throw new Error("expected Ollama descriptor");
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("http://127.0.0.1:11434/api/tags");

      return new Response(
        JSON.stringify({
          models: [
            {
              name: "qwen3:8b",
              model: "qwen3:8b",
              modified_at: "2026-04-21T18:24:00Z",
              digest: "sha256:abc123",
              size: 4_900_000_000,
              details: {
                family: "qwen3",
                parameter_size: "8B",
                quantization_level: "Q4_K_M",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-ollama-version": "0.12.7",
          },
        },
      );
    });

    const result = await probeOllamaLocalRuntime(descriptor, {
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 50,
    });

    expect(result).toMatchObject({
      ok: true,
      reachable: true,
      endpoint: "http://127.0.0.1:11434/api/tags",
      models: [
        {
          id: "qwen3:8b",
          name: "qwen3:8b",
          modifiedAt: "2026-04-21T18:24:00Z",
          digest: "sha256:abc123",
          sizeBytes: 4_900_000_000,
          family: "qwen3",
          parameterSize: "8B",
          quantizationLevel: "Q4_K_M",
        },
      ],
      server: {
        status: 200,
        version: "0.12.7",
      },
    });
  });

  it("returns predictable errors for unreachable local runtimes", async () => {
    const descriptor = parseLocalRuntimeDescriptor("llama-cpp");
    if (descriptor.kind === "ollama") {
      throw new Error("expected OpenAI-compatible descriptor");
    }

    const networkFetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      probeOpenAiCompatibleLocalRuntime(descriptor, {
        fetch: networkFetch as unknown as typeof fetch,
        timeoutMs: 50,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reachable: false,
      endpoint: "http://127.0.0.1:8080/v1/models",
      error: {
        code: "network-error",
        message: "Local runtime probe failed: fetch failed",
        cause: "fetch failed",
      },
    });

    const httpFetch = vi.fn(
      async () => new Response("offline", { status: 503, statusText: "Service Unavailable" }),
    );

    await expect(
      probeOpenAiCompatibleLocalRuntime(descriptor, {
        fetch: httpFetch as unknown as typeof fetch,
        timeoutMs: 50,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reachable: false,
      error: {
        code: "http-error",
        status: 503,
        message: "Local runtime probe failed with HTTP 503 Service Unavailable.",
      },
    });
  });

  it("returns predictable errors for malformed probe responses and invalid descriptors", async () => {
    const descriptor = parseLocalRuntimeDescriptor("llama-cpp");
    if (descriptor.kind === "ollama") {
      throw new Error("expected OpenAI-compatible descriptor");
    }

    const malformedFetch = vi.fn(
      async () =>
        new Response("{", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
    );

    await expect(
      probeOpenAiCompatibleLocalRuntime(descriptor, {
        fetch: malformedFetch as unknown as typeof fetch,
        timeoutMs: 50,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reachable: false,
      error: {
        code: "malformed-response",
        message: "Local runtime probe response was not valid JSON.",
      },
    });

    const fetchMock = vi.fn();
    await expect(
      probeLocalRuntime(
        {
          kind: "ollama",
          baseUrl: "https://api.openai.com/v1",
        },
        {
          fetch: fetchMock as unknown as typeof fetch,
          timeoutMs: 50,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      reachable: false,
      error: {
        code: "invalid-runtime",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns predictable timeout errors and aborts the fetch signal", async () => {
    const descriptor = parseLocalRuntimeDescriptor("llama-cpp");
    if (descriptor.kind === "ollama") {
      throw new Error("expected OpenAI-compatible descriptor");
    }

    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    });

    const result = await probeOpenAiCompatibleLocalRuntime(descriptor, {
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      reachable: false,
      timeoutMs: 1,
      error: {
        code: "timeout",
        message: "Local runtime probe timed out after 1ms.",
      },
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal?.aborted).toBe(true);
  });
});
