import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION,
  RESEARCH_MEMORY_POSTGRES_REQUIRED_INDEXES,
  RESEARCH_MEMORY_POSTGRES_REQUIRED_TABLES,
  RESEARCH_MEMORY_POSTGRES_SCHEMA_ENTITIES,
  RESEARCH_MEMORY_POSTGRES_SCHEMA_VERSION,
} from "../src/research-memory/postgres-schema.js";

const migrationUrl = new URL(
  `../src/research-memory/postgres/migrations/${RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION}`,
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

describe("Postgres research memory schema", () => {
  it("tracks the optional Postgres schema version and migration", () => {
    expect(RESEARCH_MEMORY_POSTGRES_SCHEMA_VERSION).toBe(1);
    expect(RESEARCH_MEMORY_POSTGRES_INITIAL_MIGRATION).toBe("001_initial.sql");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS research_memory_schema_migrations");
    expect(migrationSql).toContain("ON CONFLICT (version) DO NOTHING");
  });

  it("declares all Postgres-backed research memory entities", () => {
    expect(RESEARCH_MEMORY_POSTGRES_SCHEMA_ENTITIES.map((entity) => entity.name)).toEqual([
      "settings",
      "runs",
      "sources",
      "artifacts",
      "events",
      "modelRoutes",
      "failures",
      "notebookExports",
    ]);
    expect(RESEARCH_MEMORY_POSTGRES_REQUIRED_TABLES).toEqual([
      "research_memory_settings",
      "research_runs",
      "research_sources",
      "research_artifacts",
      "research_events",
      "research_model_routes",
      "research_failures",
      "research_notebook_exports",
    ]);
  });

  it("creates every required table and column in the Postgres migration", () => {
    for (const entity of RESEARCH_MEMORY_POSTGRES_SCHEMA_ENTITIES) {
      const body = tableBody(entity.table);
      for (const column of entity.requiredColumns) {
        expectColumn(body, column);
      }
    }
  });

  it("uses Postgres JSONB and boolean storage without SQLite-only syntax", () => {
    expect(migrationSql).toContain("metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migrationSql).toContain("visible_to_ui BOOLEAN NOT NULL DEFAULT FALSE");
    expect(migrationSql).toContain("local_only_allowed BOOLEAN NOT NULL");
    expect(migrationSql).not.toContain("PRAGMA ");
    expect(migrationSql).not.toContain("INSERT OR IGNORE");
  });

  it("creates required indexes and deferred circular artifact constraints", () => {
    expect(RESEARCH_MEMORY_POSTGRES_REQUIRED_INDEXES).toHaveLength(24);
    for (const index of RESEARCH_MEMORY_POSTGRES_REQUIRED_INDEXES) {
      expectIndex(index);
    }
    expect(migrationSql).toContain("fk_research_runs_summary_artifact");
    expect(migrationSql).toContain("fk_research_sources_extracted_artifact");
    expect(migrationSql).toContain("DEFERRABLE INITIALLY DEFERRED");
  });
});
