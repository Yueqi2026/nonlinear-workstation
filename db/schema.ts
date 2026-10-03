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
