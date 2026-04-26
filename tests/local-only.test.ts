import { describe, expect, it, vi } from "vitest";
import { assertLocalOnlyModelAllowed, resolveLocalOnlyMode } from "../src/run/local-only.js";
import { runModelAttempts } from "../src/run/model-attempts.js";
import type { ModelAttempt } from "../src/run/types.js";

const remotePolicy = resolveLocalOnlyMode({
  config: { privacy: { localOnly: true } },
});

function attempt(userModelId: string, overrides: Partial<ModelAttempt> = {}): ModelAttempt {
  const transport = userModelId.startsWith("openrouter/")
    ? "openrouter"
    : userModelId.startsWith("cli/")
      ? "cli"
      : "native";
  return {
    transport,
    userModelId,
    llmModelId:
      transport === "cli"
        ? null
        : transport === "openrouter"
          ? `openai/${userModelId.slice("openrouter/".length)}`
          : userModelId,
    openrouterProviders: null,
    forceOpenRouter: transport === "openrouter",
    requiredEnv:
      transport === "cli"
        ? "CLI_CODEX"
        : transport === "openrouter"
          ? "OPENROUTER_API_KEY"
          : userModelId.startsWith("google/")
            ? "GEMINI_API_KEY"
            : userModelId.startsWith("anthropic/")
              ? "ANTHROPIC_API_KEY"
              : userModelId.startsWith("xai/")
                ? "XAI_API_KEY"
                : userModelId.startsWith("zai/")
                  ? "Z_AI_API_KEY"
                  : userModelId.startsWith("nvidia/")
                    ? "NVIDIA_API_KEY"
                    : userModelId.startsWith("github-copilot/")
                      ? "GITHUB_TOKEN"
                      : "OPENAI_API_KEY",
    ...overrides,
  };
}

describe("local-only privacy guard", () => {
  it("resolves request localOnly as an explicit override of config", () => {
    expect(
      resolveLocalOnlyMode({
        config: { privacy: { localOnly: true } },
        requestLocalOnly: false,
      }),
    ).toEqual({ enabled: false, source: "request localOnly" });

    expect(
      resolveLocalOnlyMode({
        config: { privacy: { localOnly: false } },
        requestLocalOnly: true,
      }),
    ).toEqual({ enabled: true, source: "request localOnly" });
  });

  it("blocks known remote providers with a clear setting-specific error", () => {
    const remoteAttempts = [
      "google/gemini-3-flash",
      "anthropic/claude-sonnet-4-5",
      "xai/grok-4-fast-non-reasoning",
      "zai/glm-4.7",
      "nvidia/stepfun-ai/step-3.5-flash",
      "github-copilot/gpt-5.4",
      "openrouter/openai/gpt-5-mini",
      "cli/codex/gpt-5.2",
    ];

    for (const modelId of remoteAttempts) {
      expect(() =>
        assertLocalOnlyModelAllowed({
          policy: remotePolicy,
          candidate: attempt(modelId),
          providerBaseUrls: { openai: "http://127.0.0.1:8080/v1" },
        }),
      ).toThrow(/Local-only mode \(privacy\.localOnly\) blocked/);
    }
  });

  it("blocks default OpenAI because api.openai.com is remote", () => {
    expect(() =>
      assertLocalOnlyModelAllowed({
        policy: remotePolicy,
        candidate: attempt("openai/gpt-5-mini"),
        providerBaseUrls: { openai: null },
      }),
    ).toThrow(/api\.openai\.com/);
  });

  it("allows OpenAI-compatible localhost endpoints", () => {
    expect(() =>
      assertLocalOnlyModelAllowed({
        policy: remotePolicy,
        candidate: attempt("openai/qwen3-local"),
        providerBaseUrls: { openai: "http://localhost:8080/v1" },
      }),
    ).not.toThrow();

    expect(() =>
      assertLocalOnlyModelAllowed({
        policy: remotePolicy,
        candidate: attempt("openai/gemma-local", {
          openaiBaseUrlOverride: "http://127.0.0.1:1234/v1",
        }),
        providerBaseUrls: { openai: null },
      }),
    ).not.toThrow();
  });

  it("checks the guard before invoking a model attempt", async () => {
    const runAttempt = vi.fn(async () => "should not run");

    await expect(
      runModelAttempts({
        attempts: [attempt("google/gemini-3-flash")],
        isFallbackModel: false,
        isNamedModelSelection: false,
        envHasKeyFor: () => true,
        formatMissingModelError: () => "missing",
        assertAttemptAllowed: (candidate) =>
          assertLocalOnlyModelAllowed({
            policy: remotePolicy,
            candidate,
            providerBaseUrls: { openai: null },
          }),
        runAttempt,
      }),
    ).rejects.toThrow(/privacy\.localOnly/);

    expect(runAttempt).not.toHaveBeenCalled();
  });
});
