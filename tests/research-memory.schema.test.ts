import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESEARCH_MEMORY_ARTIFACT_ROOT,
  DEFAULT_RESEARCH_MEMORY_DB_PATH,
  RESEARCH_MEMORY_INITIAL_MIGRATION,
  RESEARCH_MEMORY_REQUIRED_INDEXES,
  RESEARCH_MEMORY_REQUIRED_TABLES,
  RESEARCH_MEMORY_SCHEMA_ENTITIES,
  RESEARCH_MEMORY_SCHEMA_VERSION,
} from "../src/research-memory/schema.js";

const migrationUrl = new URL(
  `../src/research-memory/migrations/${RESEARCH_MEMORY_INITIAL_MIGRATION}`,
  import.meta.url,
);
const migrationSql = readFileSync(migrationUrl, "utf8");

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tableBody(table: string): string {
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${escapeRegex(table)}\\s*\\(([\\s\\S]*?)\\);`,
    "i",
  );
  const match = migrationSql.match(pattern);
  expect(match, `missing CREATE TABLE for ${table}`).not.toBeNull();
  return match?.[1] ?? "";
}

function expectColumn(body: string, column: string): void {
  expect(body).toMatch(new RegExp(`(^|\\n)\\s*${escapeRegex(column)}\\s+`, "i"));
}

function expectIndex(index: string): void {
  expect(migrationSql).toMatch(
    new RegExp(
      `CREATE\\s+(UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${escapeRegex(index)}\\s`,
      "i",
    ),
  );
}

describe("local research memory schema", () => {
  it("tracks the initial SQLite schema version and default local paths", () => {
    expect(RESEARCH_MEMORY_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_RESEARCH_MEMORY_DB_PATH).toBe("~/.summarize/research-memory.sqlite");
    expect(DEFAULT_RESEARCH_MEMORY_ARTIFACT_ROOT).toBe("~/.summarize/research-memory/artifacts");
  });

  it("declares all required LLR-012 entities", () => {
    expect(RESEARCH_MEMORY_SCHEMA_ENTITIES.map((entity) => entity.name)).toEqual([
      "settings",
      "runs",
      "sources",
      "artifacts",
      "events",
      "modelRoutes",
    ]);
    expect(RESEARCH_MEMORY_REQUIRED_TABLES).toEqual([
      "research_memory_settings",
      "research_runs",
      "research_sources",
      "research_artifacts",
      "research_events",
      "research_model_routes",
    ]);
  });

  it("creates every required table and required column in the initial migration", () => {
    for (const entity of RESEARCH_MEMORY_SCHEMA_ENTITIES) {
      const body = tableBody(entity.table);
      for (const column of entity.requiredColumns) {
        expectColumn(body, column);
      }
    }
  });

  it("creates required indexes for run history, source lookup, artifacts, events, and routes", () => {
    expect(RESEARCH_MEMORY_REQUIRED_INDEXES).toHaveLength(17);
    for (const index of RESEARCH_MEMORY_REQUIRED_INDEXES) {
      expectIndex(index);
    }
  });

  it("keeps route and event ordering deterministic without opening a live database", () => {
    expect(migrationSql).toContain("ON research_events(run_id, sequence)");
    expect(migrationSql).toContain("ON research_model_routes(run_id, attempt_index)");
  });
});
