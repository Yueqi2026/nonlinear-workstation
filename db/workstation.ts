import { env } from "cloudflare:workers";

export type KnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
};

function database() {
  if (!env.DB) throw new Error("知识库暂不可用：D1 数据库绑定缺失。");
  return env.DB;
}

export function ownerFromHeaders(headers: Headers) {
  return headers.get("oai-authenticated-user-id") ?? "local-preview";
}

export async function listKnowledge(ownerId: string, limit = 30) {
  const result = await database()
    .prepare("SELECT id, title, content, tags, created_at AS createdAt, updated_at AS updatedAt FROM knowledge_documents WHERE owner_id = ? ORDER BY updated_at DESC, id DESC LIMIT ?")
    .bind(ownerId, limit)
    .all<KnowledgeDocument>();
  return result.results ?? [];
}

export async function addKnowledge(input: { id: string; ownerId: string; title: string; content: string; tags: string }) {
  await database()
    .prepare("INSERT INTO knowledge_documents (id, owner_id, title, content, tags) VALUES (?, ?, ?, ?, ?)")
    .bind(input.id, input.ownerId, input.title, input.content, input.tags)
    .run();
}

export async function removeKnowledge(ownerId: string, id: string) {
  await database()
    .prepare("DELETE FROM knowledge_documents WHERE id = ? AND owner_id = ?")
    .bind(id, ownerId)
    .run();
}

export async function saveAnalysis(input: { id: string; ownerId: string; question: string; systemDescription: string; proposalJson: string }) {
  await database()
    .prepare("INSERT INTO analysis_runs (id, owner_id, question, system_description, proposal_json) VALUES (?, ?, ?, ?, ?)")
    .bind(input.id, input.ownerId, input.question, input.systemDescription, input.proposalJson)
    .run();
}

export async function saveWorkflowVersion(input: { id: string; ownerId: string; projectId: string; version: string; status: string; graphJson: string; confirmed: boolean }) {
  await database()
    .prepare("INSERT INTO workflow_versions (id, owner_id, project_id, version, status, graph_json, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)")
    .bind(input.id, input.ownerId, input.projectId, input.version, input.status, input.graphJson, input.confirmed ? 1 : 0)
    .run();
}

export async function getWorkflowVersion(ownerId: string, id: string) {
  const result = await database()
    .prepare("SELECT id, project_id AS projectId, status, graph_json AS graphJson FROM workflow_versions WHERE id = ? AND owner_id = ? LIMIT 1")
    .bind(id, ownerId)
    .first<{ id: string; projectId: string; status: string; graphJson: string }>();
  return result ?? null;
}

export async function createWorkflowRun(input: { id: string; ownerId: string; projectId: string; workflowVersionId: string; configJson: string }) {
  await database()
    .prepare("INSERT INTO workflow_runs (id, owner_id, project_id, workflow_version_id, status, config_json, started_at) VALUES (?, ?, ?, ?, 'running', ?, CURRENT_TIMESTAMP)")
    .bind(input.id, input.ownerId, input.projectId, input.workflowVersionId, input.configJson)
    .run();
}

export async function getWorkflowRun(ownerId: string, id: string) {
  return database().prepare("SELECT id, project_id AS projectId, status FROM workflow_runs WHERE id = ? AND owner_id = ? LIMIT 1").bind(id, ownerId).first<{ id: string; projectId: string; status: string }>();
}

export async function addRunEvent(input: { id: string; runId: string; type: string; nodeId?: string; message: string; payloadJson?: string }) {
  await database()
    .prepare("INSERT INTO run_events (id, run_id, type, node_id, message, payload_json) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(input.id, input.runId, input.type, input.nodeId ?? null, input.message, input.payloadJson ?? "{}")
    .run();
}

export async function saveRunArtifact(input: { id: string; runId: string; nodeId?: string; kind: string; label: string; provenance: string; inputHash?: string; contentJson: string }) {
  await database()
    .prepare("INSERT INTO run_artifacts (id, run_id, node_id, kind, label, provenance, input_hash, content_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(input.id, input.runId, input.nodeId ?? null, input.kind, input.label, input.provenance, input.inputHash ?? null, input.contentJson)
    .run();
}

export async function finishWorkflowRun(input: { ownerId: string; runId: string; status: "succeeded" | "failed" | "cancelled"; error?: string }) {
  await database()
    .prepare("UPDATE workflow_runs SET status = ?, finished_at = CURRENT_TIMESTAMP, error = ? WHERE id = ? AND owner_id = ?")
    .bind(input.status, input.error ?? null, input.runId, input.ownerId)
    .run();
}

export async function listWorkflowRuns(ownerId: string, projectId: string, limit = 10) {
  const result = await database()
    .prepare("SELECT id, project_id AS projectId, workflow_version_id AS workflowVersionId, status, started_at AS startedAt, finished_at AS finishedAt, error, created_at AS createdAt FROM workflow_runs WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(ownerId, projectId, limit)
    .all();
  return result.results ?? [];
}
