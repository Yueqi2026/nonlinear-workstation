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
