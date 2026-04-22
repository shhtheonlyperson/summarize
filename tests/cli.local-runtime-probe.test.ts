import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/run.js";

function captureStream() {
  let text = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  return { stream, getText: () => text };
}

function noopStream(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("local runtime probe cli", () => {
  it("prints a clear success message for reachable OpenAI-compatible runtimes", async () => {
    const stdout = captureStream();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(resolveFetchUrl(input)).toBe("http://127.0.0.1:8080/v1/models");
      return new Response(
        JSON.stringify({
          data: [{ id: "llama-3.2-local", object: "model", owned_by: "llama.cpp" }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json", server: "llama.cpp" },
        },
      );
    });

    await runCli(
      [
        "local-runtime",
        "probe",
        "llama-cpp",
        "--base-url",
        "http://127.0.0.1:8080/v1",
        "--timeout",
        "50ms",
      ],
      {
        env: {},
        fetch: fetchMock as unknown as typeof fetch,
        stdout: stdout.stream,
        stderr: noopStream(),
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const output = stdout.getText();
    expect(output).toContain("Local runtime probe");
    expect(output).toContain("OK llama.cpp server (llama-cpp)");
    expect(output).toContain("Endpoint: http://127.0.0.1:8080/v1/models");
    expect(output).toContain("Models: llama-3.2-local (1)");
  });

  it("prints a warning when a reachable runtime returns no models", async () => {
    const stdout = captureStream();
    let exitCode: number | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(resolveFetchUrl(input)).toBe("http://127.0.0.1:11434/api/tags");
      return new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { "content-type": "application/json", "x-ollama-version": "0.12.7" },
      });
    });

    await runCli(["local-runtime", "probe", "ollama", "--timeout", "50ms"], {
      env: {},
      fetch: fetchMock as unknown as typeof fetch,
      stdout: stdout.stream,
      stderr: noopStream(),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    expect(exitCode).toBeNull();
    const output = stdout.getText();
    expect(output).toContain("WARN Ollama (ollama)");
    expect(output).toContain("Warning: endpoint is reachable but returned no models.");
  });

  it("prints a failure message and sets a failing exit code when probes fail", async () => {
    const stdout = captureStream();
    let exitCode: number | null = null;
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await runCli(["local-runtime", "probe", "llama-cpp", "--timeout", "50ms"], {
      env: {},
      fetch: fetchMock as unknown as typeof fetch,
      stdout: stdout.stream,
      stderr: noopStream(),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    expect(exitCode).toBe(1);
    const output = stdout.getText();
    expect(output).toContain("FAIL llama.cpp server (llama-cpp)");
    expect(output).toContain("Endpoint: http://127.0.0.1:8080/v1/models");
    expect(output).toContain("Local runtime probe failed: fetch failed (network-error)");
  });

  it("emits JSON for scripts using configured OpenAI-compatible base URLs", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "summarize-local-runtime-"));
    mkdirSync(join(tempRoot, ".summarize"), { recursive: true });
    writeFileSync(
      join(tempRoot, ".summarize", "config.json"),
      JSON.stringify({ openai: { baseUrl: "http://localhost:9999/v1" } }),
      "utf8",
    );

    const stdout = captureStream();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(resolveFetchUrl(input)).toBe("http://localhost:9999/v1/models");
      return new Response(JSON.stringify({ data: [{ id: "local-model" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await runCli(["local-runtime", "probe", "--json", "--timeout", "50ms"], {
      env: { HOME: tempRoot },
      fetch: fetchMock as unknown as typeof fetch,
      stdout: stdout.stream,
      stderr: noopStream(),
    });

    const payload = JSON.parse(stdout.getText()) as {
      ok: boolean;
      warnings: string[];
      results: Array<{
        ok: boolean;
        endpoint: string;
        runtime: { kind: string; baseUrl: string; baseUrlSource: string };
        models: Array<{ id: string }>;
      }>;
    };
    expect(payload).toMatchObject({
      ok: true,
      warnings: [],
      results: [
        {
          ok: true,
          endpoint: "http://localhost:9999/v1/models",
          runtime: {
            kind: "openai-compatible",
            baseUrl: "http://localhost:9999/v1",
            baseUrlSource: "configured",
          },
          models: [{ id: "local-model" }],
        },
      ],
    });
  });

  it("does not fetch remote OpenAI base URLs unless explicitly allowed", async () => {
    const stdout = captureStream();
    let exitCode: number | null = null;
    const fetchMock = vi.fn();

    await runCli(["local-runtime", "probe", "--json"], {
      env: { OPENAI_BASE_URL: "https://api.openai.com/v1" },
      fetch: fetchMock as unknown as typeof fetch,
      stdout: stdout.stream,
      stderr: noopStream(),
      setExitCode: (code) => {
        exitCode = code;
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(exitCode).toBe(1);
    const payload = JSON.parse(stdout.getText()) as {
      ok: boolean;
      results: Array<{ ok: boolean; error: { code: string } }>;
    };
    expect(payload.ok).toBe(false);
    expect(payload.results[0]).toMatchObject({
      ok: false,
      error: { code: "invalid-runtime" },
    });
  });
});
