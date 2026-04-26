import { isAbsolute, join, resolve as resolvePath } from "node:path";
import type { ResearchMemoryConfig, SummarizeConfig } from "../config.js";
import { createMemoryResearchMemoryStore } from "./memory-store.js";
import { createPostgresResearchMemoryStore } from "./postgres-store.js";
import { DEFAULT_RESEARCH_MEMORY_ARTIFACT_ROOT } from "./schema.js";
import type { ResearchMemoryStore } from "./store.js";

export type ResearchMemoryStoreFactoryResult =
  | {
      kind: "disabled";
      backend: null;
      store: null;
      artifactRoot: string | null;
      reason: "not-configured" | "config-disabled";
    }
  | {
      kind: "sqlite-placeholder";
      backend: "sqlite";
      store: null;
      artifactRoot: string | null;
      reason: "sqlite-backend-not-implemented";
    }
  | {
      kind: "memory" | "postgres";
      backend: "memory" | "postgres";
      store: ResearchMemoryStore;
      artifactRoot: string;
      reason: null;
    };

export type ResearchMemoryStoreFactoryDeps = {
  createMemoryStore?: () => ResearchMemoryStore;
  createPostgresStore?: (options: { postgresUrl: string }) => ResearchMemoryStore;
};

function resolveHomeDir(env: Record<string, string | undefined>): string | null {
  const home = env.HOME?.trim() || env.USERPROFILE?.trim();
  return home || null;
}

export function resolveResearchMemoryPath({
  env,
  value,
}: {
  env: Record<string, string | undefined>;
  value: string | null | undefined;
}): string | null {
  const home = resolveHomeDir(env);
  const raw = value?.trim() || DEFAULT_RESEARCH_MEMORY_ARTIFACT_ROOT;
  if (raw.startsWith("~")) {
    if (!home) return null;
    const expanded = raw === "~" ? home : join(home, raw.slice(2));
    return resolvePath(expanded);
  }
  if (isAbsolute(raw)) return raw;
  return home ? resolvePath(join(home, raw)) : null;
}

function resolveResearchMemoryBackend(
  config: ResearchMemoryConfig,
): "memory" | "sqlite" | "postgres" {
  if (config.backend) return config.backend;
  if (config.postgresUrl?.trim()) return "postgres";
  return "sqlite";
}

function resolvePostgresUrl({
  config,
  env,
}: {
  config: ResearchMemoryConfig;
  env: Record<string, string | undefined>;
}): string | null {
  return (
    config.postgresUrl?.trim() ||
    env.SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL?.trim() ||
    env.RESEARCH_MEMORY_POSTGRES_URL?.trim() ||
    null
  );
}

export function createResearchMemoryStoreFromConfig({
  config,
  env,
  deps = {},
}: {
  config: SummarizeConfig | null | undefined;
  env: Record<string, string | undefined>;
  deps?: ResearchMemoryStoreFactoryDeps;
}): ResearchMemoryStoreFactoryResult {
  const researchMemory = config?.researchMemory;
  if (!researchMemory) {
    return {
      kind: "disabled",
      backend: null,
      store: null,
      artifactRoot: null,
      reason: "not-configured",
    };
  }

  const artifactRoot = resolveResearchMemoryPath({
    env,
    value: researchMemory.artifactRoot ?? null,
  });
  if (researchMemory.enabled !== true) {
    return {
      kind: "disabled",
      backend: null,
      store: null,
      artifactRoot,
      reason: "config-disabled",
    };
  }

  const backend = resolveResearchMemoryBackend(researchMemory);
  if (backend === "sqlite") {
    return {
      kind: "sqlite-placeholder",
      backend,
      store: null,
      artifactRoot,
      reason: "sqlite-backend-not-implemented",
    };
  }

  if (!artifactRoot) {
    throw new Error("Research memory artifactRoot requires HOME/USERPROFILE or an absolute path.");
  }

  if (backend === "memory") {
    return {
      kind: "memory",
      backend,
      store: deps.createMemoryStore?.() ?? createMemoryResearchMemoryStore(),
      artifactRoot,
      reason: null,
    };
  }

  const postgresUrl = resolvePostgresUrl({ config: researchMemory, env });
  if (!postgresUrl) {
    throw new Error(
      "Postgres research memory requires researchMemory.postgresUrl or SUMMARIZE_RESEARCH_MEMORY_POSTGRES_URL.",
    );
  }

  return {
    kind: "postgres",
    backend,
    store:
      deps.createPostgresStore?.({ postgresUrl }) ??
      createPostgresResearchMemoryStore({ postgresUrl }),
    artifactRoot,
    reason: null,
  };
}
