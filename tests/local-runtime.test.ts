import {
  DEFAULT_LOCAL_RUNTIME_DESCRIPTORS,
  LOCAL_RUNTIME_KINDS,
  isLocalRuntimeHostname,
  parseLocalRuntimeDescriptor,
  validateLocalRuntimeBaseUrl,
} from "@steipete/summarize-core/local-runtime";
import { describe, expect, it } from "vitest";

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
