import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createResearchMemoryStoreFromConfig,
  MemoryResearchMemoryStore,
  resolveResearchMemoryPath,
} from "../src/research-memory/index.js";
import type { ResearchMemoryStore } from "../src/research-memory/store.js";

describe("research memory store factory", () => {
  it("resolves disabled config without constructing a store", () => {
    expect(createResearchMemoryStoreFromConfig({ config: null, env: {} })).toMatchObject({
      kind: "disabled",
      store: null,
      reason: "not-configured",
    });

    expect(
      createResearchMemoryStoreFromConfig({
        config: { researchMemory: { enabled: false, backend: "postgres" } },
        env: { HOME: "/tmp/home" },
      }),
    ).toMatchObject({
      kind: "disabled",
      store: null,
      reason: "config-disabled",
    });
  });

  it("resolves memory, sqlite placeholder, and injected Postgres stores", () => {
    const root = mkdtempSync(join(tmpdir(), "summarize-memory-factory-"));
    const fakeMemory = new MemoryResearchMemoryStore();
    const fakePostgres = { initialize: vi.fn() } as unknown as ResearchMemoryStore;
    const createPostgresStore = vi.fn(() => fakePostgres);

    const memory = createResearchMemoryStoreFromConfig({
      config: { researchMemory: { enabled: true, backend: "memory", artifactRoot: "artifacts" } },
      env: { HOME: root },
      deps: { createMemoryStore: () => fakeMemory },
    });
    expect(memory).toMatchObject({ kind: "memory", backend: "memory", store: fakeMemory });
    expect(memory.artifactRoot).toBe(join(root, "artifacts"));

    expect(
      createResearchMemoryStoreFromConfig({
        config: { researchMemory: { enabled: true, backend: "sqlite" } },
        env: { HOME: root },
      }),
    ).toMatchObject({
      kind: "sqlite-placeholder",
      backend: "sqlite",
      store: null,
      reason: "sqlite-backend-not-implemented",
    });

    const postgres = createResearchMemoryStoreFromConfig({
      config: {
        researchMemory: {
          enabled: true,
          backend: "postgres",
          postgresUrl: "postgresql://localhost/summarize",
        },
      },
      env: { HOME: root },
      deps: { createPostgresStore },
    });
    expect(postgres).toMatchObject({ kind: "postgres", backend: "postgres", store: fakePostgres });
    expect(createPostgresStore).toHaveBeenCalledWith({
      postgresUrl: "postgresql://localhost/summarize",
    });
  });

  it("expands artifact roots without exposing Postgres credentials", () => {
    const root = mkdtempSync(join(tmpdir(), "summarize-memory-path-"));
    expect(resolveResearchMemoryPath({ env: { HOME: root }, value: "~/memory" })).toBe(
      join(root, "memory"),
    );
    expect(resolveResearchMemoryPath({ env: {}, value: "/tmp/absolute-memory" })).toBe(
      "/tmp/absolute-memory",
    );
    expect(() =>
      createResearchMemoryStoreFromConfig({
        config: { researchMemory: { enabled: true, backend: "postgres" } },
        env: { HOME: root },
      }),
    ).toThrow(/postgresUrl|SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL/);
  });
});
