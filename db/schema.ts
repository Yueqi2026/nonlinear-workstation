import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const knowledgeDocuments = sqliteTable(
  "knowledge_documents",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
    updatedAt: text("updated_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  },
  (table) => [index("idx_knowledge_documents_owner_updated").on(table.ownerId, table.updatedAt)],
);

export const analysisRuns = sqliteTable(
  "analysis_runs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    question: text("question").notNull(),
    systemDescription: text("system_description").notNull(),
    proposalJson: text("proposal_json").notNull(),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  },
  (table) => [index("idx_analysis_runs_owner_created").on(table.ownerId, table.createdAt)],
);

export const workflowVersions = sqliteTable(
  "workflow_versions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    projectId: text("project_id").notNull(),
    version: text("version").notNull(),
    status: text("status").notNull(),
    graphJson: text("graph_json").notNull(),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
    confirmedAt: text("confirmed_at"),
  },
  (table) => [index("idx_workflow_versions_owner_project").on(table.ownerId, table.projectId, table.createdAt)],
);

export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    projectId: text("project_id").notNull(),
    workflowVersionId: text("workflow_version_id").notNull(),
    status: text("status").notNull(),
    configJson: text("config_json").notNull().default("{}"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  },
  (table) => [index("idx_workflow_runs_owner_created").on(table.ownerId, table.createdAt)],
);

export const runEvents = sqliteTable(
  "run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    type: text("type").notNull(),
    nodeId: text("node_id"),
    message: text("message").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  },
  (table) => [index("idx_run_events_run_created").on(table.runId, table.createdAt)],
);

export const runArtifacts = sqliteTable(
  "run_artifacts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    nodeId: text("node_id"),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    provenance: text("provenance").notNull(),
    inputHash: text("input_hash"),
    contentJson: text("content_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  },
  (table) => [index("idx_run_artifacts_run_created").on(table.runId, table.createdAt)],
);
