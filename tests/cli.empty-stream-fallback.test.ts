import { Writable } from "node:stream";
import type { Api } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/run.js";
import { makeAssistantMessage, makeTextDeltaStream } from "./helpers/pi-ai-mock.js";

type MockModel = { provider: string; id: string; api: Api };

const htmlResponse = (html: string, status = 200) =>
  new Response(html, {
    status,
    headers: { "Content-Type": "text/html" },
  });

const mocks = vi.hoisted(() => ({
  completeSimple: vi.fn(),
  streamSimple: vi.fn(),
  getModel: vi.fn(() => {
    throw new Error("no model");
  }),
}));

mocks.completeSimple.mockImplementation(async (model: MockModel) =>
  makeAssistantMessage({ text: "OK", provider: model.provider, model: model.id, api: model.api }),
);

vi.mock("@mariozechner/pi-ai", () => ({
  completeSimple: mocks.completeSimple,
  streamSimple: mocks.streamSimple,
  getModel: mocks.getModel,
}));

function noopStderr(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function collectStdout() {
  let text = "";
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  return { stdout, getText: () => text };
}

describe("cli empty stream fallback", () => {
  it("falls back to non-streaming when streaming yields only whitespace", async () => {
    mocks.completeSimple.mockReset().mockImplementation(async (model: MockModel) =>
      makeAssistantMessage({
        text: "RECOVERED SUMMARY",
        provider: model.provider,
        model: model.id,
        api: model.api,
      }),
    );
    mocks.streamSimple.mockReset().mockImplementationOnce(() =>
      makeTextDeltaStream(
        ["\n"],
        makeAssistantMessage({
          text: "\n",
          provider: "openai",
          model: "gpt-5-chat",
        }),
      ),
    );

    const html =
      "<!doctype html><html><head><title>Hello</title></head>" +
      `<body><article><p>${"This is a sentence. ".repeat(60)}</p></article></body></html>`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.url;
      if (url === "https://example.com") return htmlResponse(html);
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const { stdout, getText } = collectStdout();

    await runCli(
      ["--model", "openai/gpt-5-chat", "--stream", "on", "--timeout", "10s", "https://example.com"],
      {
        env: { OPENAI_API_KEY: "test" },
        fetch: fetchMock as unknown as typeof fetch,
        stdout,
        stderr: noopStderr(),
      },
    );

    expect(mocks.streamSimple).toHaveBeenCalledTimes(1);
    expect(mocks.completeSimple).toHaveBeenCalled();
    expect(getText()).toContain("RECOVERED SUMMARY");
  });
});
