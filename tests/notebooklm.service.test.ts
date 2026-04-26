import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createNotebookLmService,
  NotebookLmCliError,
  NotebookLmJsonError,
} from "../src/notebooklm/index.js";
import { MemoryResearchMemoryStore } from "../src/research-memory/index.js";
import type { ResearchMemoryArtifact, ResearchMemoryRun } from "../src/research-memory/store.js";

function makeFakeNotebookLmExecutable(): {
  root: string;
  executable: string;
  logPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "summarize-notebooklm-test-"));
  const executable = join(root, "notebooklm-fake.mjs");
  const logPath = join(root, "calls.jsonl");
  writeFileSync(
    executable,
    `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (process.env.NOTEBOOKLM_FAKE_LOG) {
  appendFileSync(process.env.NOTEBOOKLM_FAKE_LOG, JSON.stringify(args) + "\\n");
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function print(value) {
  process.stdout.write(JSON.stringify(value) + "\\n");
}

if (process.env.NOTEBOOKLM_FAKE_MODE === "bad-json" && args[0] === "create") {
  process.stdout.write("this is not json\\n");
  process.exit(0);
}

if (process.env.NOTEBOOKLM_FAKE_MODE === "fail-generate" && args[0] === "generate") {
  process.stderr.write("generate failed from fake notebooklm\\n");
  process.exit(17);
}

if (args[0] === "create") {
  print({
    notebook: {
      id: "nb-created",
      title: args[args.length - 1],
      url: "https://notebooklm.example/nb-created"
    }
  });
} else if (args[0] === "use") {
  process.stdout.write("Using notebook " + args[1] + "\\n");
} else if (args[0] === "source" && args[1] === "add") {
  print({
    source: {
      id: "source-1",
      title: valueAfter("--title"),
      status: "queued",
      url: "https://notebooklm.example/source-1"
    }
  });
} else if (args[0] === "source" && args[1] === "wait") {
  print({
    source: {
      id: args[args.length - 1],
      title: "Source Ready",
      status: "ready"
    }
  });
} else if (args[0] === "generate" && args[1] === "audio") {
  print({
    artifact: {
      id: "audio-1",
      type: "audio",
      status: "generating"
    }
  });
} else if (args[0] === "artifact" && args[1] === "wait") {
  print({
    artifact: {
      id: args[args.length - 1],
      type: "audio",
      status: "ready",
      url: "https://notebooklm.example/audio-1"
    }
  });
} else if (args[0] === "artifact" && args[1] === "list") {
  print({
    artifacts: [
      {
        id: "audio-1",
        type: "audio",
        status: "ready"
      }
    ]
  });
} else if (args[0] === "download" && args[1] === "audio") {
  const outputPath = args[args.length - 1];
  writeFileSync(outputPath, "audio bytes");
  print({
    artifactId: valueAfter("--artifact"),
    path: outputPath,
    byteSize: 11
  });
} else {
  process.stderr.write("unexpected fake notebooklm args: " + JSON.stringify(args) + "\\n");
  process.exit(64);
}
`,
    "utf8",
  );
  chmodSync(executable, 0o755);
  return { root, executable, logPath };
}

function readCalls(logPath: string): string[][] {
  return readFileSync(logPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}

function makeRun(id = "run-notebooklm"): ResearchMemoryRun {
  return {
    id,
    kind: "cli",
    mode: "url",
    status: "succeeded",
    createdAt: 1_000,
    startedAt: 1_000,
    completedAt: 2_000,
    inputRef: "https://example.com/source",
    length: "summary",
    languageRaw: "zh-TW",
    languageBucket: "traditionalChinese",
    requestedFormat: "markdown",
    summaryArtifactId: null,
    metrics: {},
    configFingerprint: null,
    privacyMode: {
      localOnlyEnabled: false,
      localOnlySource: null,
      policyResult: "allowed",
      allowedTransports: ["notebooklm"],
      protectedData: [],
      exportState: "user-exported",
      notes: null,
      metadata: {},
    },
  };
}

function makeArtifact(
  runId: string,
  id: string,
  relativePath: string,
  mimeType: string,
): ResearchMemoryArtifact {
  return {
    id,
    runId,
    sourceId: null,
    artifactKind: "export",
    storageKind: "file",
    relativePath,
    inlineText: null,
    inlineJson: null,
    mimeType,
    byteSize: 11,
    sha256: null,
    privacyClass: "user-private",
    retention: "keep",
    metadata: {},
    createdAt: 2_000,
  };
}

async function makeInitializedStore(runId = "run-notebooklm"): Promise<MemoryResearchMemoryStore> {
  const store = new MemoryResearchMemoryStore();
  await store.initialize();
  await store.createRun(makeRun(runId));
  await store.addArtifact(
    makeArtifact(runId, "artifact-export", "runs/run-notebooklm/notebook.md", "text/markdown"),
  );
  await store.addArtifact(
    makeArtifact(runId, "artifact-audio", "runs/run-notebooklm/overview.mp3", "audio/mpeg"),
  );
  return store;
}

describe("NotebookLmService", () => {
  it("creates a notebook podcast through argument-array CLI calls and persists export metadata", async () => {
    const fake = makeFakeNotebookLmExecutable();
    const markdownPath = join(fake.root, "bundle.md");
    const outputPath = join(fake.root, "overview.mp3");
    writeFileSync(markdownPath, "# Bundle\n\nSource text", "utf8");
    const store = await makeInitializedStore();
    const service = createNotebookLmService({
      executable: fake.executable,
      env: { NOTEBOOKLM_FAKE_LOG: fake.logPath },
      now: () => 3_000,
      createId: () => "notebook-export-1",
    });

    const result = await service.createPodcastFromMarkdownBundle({
      notebook: { title: "Research; touch should-not-run" },
      source: {
        title: "Bundle $(echo should-not-run)",
        markdownPath,
      },
      audio: {
        format: "deep-dive",
        length: "long",
        language: "zh-TW",
        description: "Create a concise overview",
        outputPath,
      },
      store,
      runId: "run-notebooklm",
      exportArtifactId: "artifact-export",
      audioArtifactId: "artifact-audio",
      languageRaw: "zh-TW",
      metadata: { testCase: "argument-array" },
    });

    expect(result.notebook).toMatchObject({
      id: "nb-created",
      title: "Research; touch should-not-run",
    });
    expect(result.source).toMatchObject({ id: "source-1", status: "ready" });
    expect(result.audioArtifact).toMatchObject({ id: "audio-1", status: "ready" });
    expect(result.download).toMatchObject({ artifactId: "audio-1", outputPath, byteSize: 11 });

    expect(readCalls(fake.logPath)).toEqual([
      ["create", "--json", "Research; touch should-not-run"],
      [
        "source",
        "add",
        "--notebook",
        "nb-created",
        "--type",
        "file",
        "--mime-type",
        "text/markdown",
        "--title",
        "Bundle $(echo should-not-run)",
        "--json",
        markdownPath,
      ],
      ["source", "wait", "--notebook", "nb-created", "--json", "source-1"],
      [
        "generate",
        "audio",
        "--notebook",
        "nb-created",
        "--format",
        "deep-dive",
        "--length",
        "long",
        "--language",
        "zh_Hant",
        "--json",
        "Create a concise overview",
      ],
      ["artifact", "wait", "--notebook", "nb-created", "--json", "audio-1"],
      [
        "download",
        "audio",
        "--notebook",
        "nb-created",
        "--artifact",
        "audio-1",
        "--json",
        outputPath,
      ],
    ]);

    const snapshot = await store.getRun("run-notebooklm");
    expect(snapshot?.notebookExports).toHaveLength(1);
    expect(snapshot?.notebookExports[0]).toMatchObject({
      id: "notebook-export-1",
      provider: "notebooklm",
      status: "audio-ready",
      notebookId: "nb-created",
      notebookTitle: "Research; touch should-not-run",
      notebookUrl: "https://notebooklm.example/nb-created",
      exportArtifactId: "artifact-export",
      audioArtifactId: "artifact-audio",
      languageRaw: "zh-TW",
      outputFormat: "deep-dive",
      createdAt: 3_000,
      updatedAt: 3_000,
    });
    expect(snapshot?.notebookExports[0]?.metadata).toMatchObject({
      testCase: "argument-array",
      notebooklm: {
        sourceId: "source-1",
        sourceStatus: "ready",
        audioArtifactNotebookLmId: "audio-1",
        audioArtifactStatus: "ready",
        downloaded: true,
        downloadArtifactNotebookLmId: "audio-1",
        downloadByteSize: 11,
        executable: fake.executable,
      },
    });
  });

  it("reuses an existing notebook and lists audio artifacts without requiring JSON from use", async () => {
    const fake = makeFakeNotebookLmExecutable();
    const service = createNotebookLmService({
      executable: fake.executable,
      env: { NOTEBOOKLM_FAKE_LOG: fake.logPath },
    });

    const notebook = await service.useNotebook({
      notebookId: "nb-existing",
      title: "Existing Notebook",
      url: "https://notebooklm.example/nb-existing",
    });
    const artifacts = await service.listAudioArtifacts({ notebookId: notebook.id });

    expect(notebook).toEqual({
      id: "nb-existing",
      title: "Existing Notebook",
      url: "https://notebooklm.example/nb-existing",
      rawJson: null,
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ id: "audio-1", type: "audio", status: "ready" });
    expect(readCalls(fake.logPath)).toEqual([
      ["use", "nb-existing"],
      ["artifact", "list", "--notebook", "nb-existing", "--type", "audio", "--json"],
    ]);
  });

  it("surfaces malformed NotebookLM JSON as a typed error", async () => {
    const fake = makeFakeNotebookLmExecutable();
    const service = createNotebookLmService({
      executable: fake.executable,
      env: {
        NOTEBOOKLM_FAKE_LOG: fake.logPath,
        NOTEBOOKLM_FAKE_MODE: "bad-json",
      },
    });

    await expect(service.createNotebook({ title: "Bad JSON" })).rejects.toMatchObject({
      name: "NotebookLmJsonError",
      errorCode: "NOTEBOOKLM_JSON_PARSE_FAILED",
      command: fake.executable,
    });
    await expect(service.createNotebook({ title: "Bad JSON" })).rejects.toBeInstanceOf(
      NotebookLmJsonError,
    );
  });

  it("persists failed NotebookLM export metadata without hiding the CLI error", async () => {
    const fake = makeFakeNotebookLmExecutable();
    const markdownPath = join(fake.root, "bundle.md");
    writeFileSync(markdownPath, "# Bundle", "utf8");
    const store = await makeInitializedStore("run-failed-notebooklm");
    const service = createNotebookLmService({
      executable: fake.executable,
      env: {
        NOTEBOOKLM_FAKE_LOG: fake.logPath,
        NOTEBOOKLM_FAKE_MODE: "fail-generate",
      },
      now: () => 4_000,
      createId: () => "notebook-export-failed",
    });

    await expect(
      service.createPodcastFromMarkdownBundle({
        notebook: { id: "nb-existing", title: "Existing" },
        source: { title: "Bundle", markdownPath },
        store,
        runId: "run-failed-notebooklm",
        exportArtifactId: "artifact-export",
      }),
    ).rejects.toMatchObject({
      name: "NotebookLmCliError",
      errorCode: "NOTEBOOKLM_COMMAND_FAILED",
      exitCode: 17,
      stderr: expect.stringContaining("generate failed from fake notebooklm"),
    });
    await expect(
      service.generateAudioOverview({ notebookId: "nb-existing", format: "deep-dive" }),
    ).rejects.toBeInstanceOf(NotebookLmCliError);

    const snapshot = await store.getRun("run-failed-notebooklm");
    expect(snapshot?.notebookExports).toHaveLength(1);
    expect(snapshot?.notebookExports[0]).toMatchObject({
      id: "notebook-export-failed",
      status: "failed",
      notebookId: "nb-existing",
      notebookTitle: "Existing",
      exportArtifactId: "artifact-export",
      createdAt: 4_000,
      updatedAt: 4_000,
    });
    expect(snapshot?.notebookExports[0]?.metadata).toMatchObject({
      failure: {
        message: expect.stringContaining("generate failed from fake notebooklm"),
      },
      notebooklm: {
        sourceId: "source-1",
        sourceStatus: "ready",
      },
    });
  });
});
