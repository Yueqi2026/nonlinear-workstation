import { addRunEvent, createWorkflowRun, finishWorkflowRun, getWorkflowRun, getWorkflowVersion, listWorkflowRuns, ownerFromHeaders, saveRunArtifact, saveWorkflowVersion } from "../../../db/workstation";
import { canConnect, getModuleDefinition } from "../../../lib/modules/registry";
import type { WorkflowGraph } from "../../../lib/contracts/workflow";

function isWorkflowGraph(value: unknown): value is WorkflowGraph {
  if (!value || typeof value !== "object") return false;
  const graph = value as Partial<WorkflowGraph>;
  if (graph.version !== "workflow.v1" || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.nodes.length === 0 || graph.nodes.length > 100) return false;
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node || typeof node !== "object" || typeof node.id !== "string" || ids.has(node.id) || !getModuleDefinition(String(node.type))) return false;
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || typeof node.config !== "object") return false;
    ids.add(node.id);
  }
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!edge || typeof edge !== "object" || edge.source === edge.target || !ids.has(edge.source) || !ids.has(edge.target)) return false;
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    const sourceDef = source && getModuleDefinition(source.type); const targetDef = target && getModuleDefinition(target.type);
    if (!source || !target || !sourceDef || !targetDef || !canConnect(source.type, target.type) || !sourceDef.outputs.includes(edge.sourcePort) || !targetDef.inputs.includes(edge.targetPort) || edge.sourcePort !== edge.targetPort) return false;
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string): boolean => { if (visiting.has(id)) return false; if (visited.has(id)) return true; visiting.add(id); for (const next of adjacency.get(id) ?? []) if (!visit(next)) return false; visiting.delete(id); visited.add(id); return true; };
  return graph.nodes.every((node) => visit(node.id));
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "default";
  try { return Response.json({ runs: await listWorkflowRuns(ownerFromHeaders(request.headers), projectId) }); }
  catch { return Response.json({ code: "runs_unavailable", error: "运行记录暂不可用。" }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { action?: string; projectId?: string; workflow?: unknown; runId?: string; workflowVersionId?: string; config?: unknown; nodeId?: string; message?: string; status?: "succeeded" | "failed" | "cancelled"; error?: string; artifact?: { nodeId?: string; kind?: string; label?: string; provenance?: string; inputHash?: string; content?: unknown } };
    const ownerId = ownerFromHeaders(request.headers);
    if (payload.action === "save_workflow") {
      if (!payload.projectId?.trim() || !isWorkflowGraph(payload.workflow)) return Response.json({ code: "invalid_workflow", error: "流程图无效：请检查节点、端口连接和循环依赖。" }, { status: 400 });
      const workflow = payload.workflow as WorkflowGraph & { status?: string };
      const confirmed = workflow.status === "confirmed";
      const id = crypto.randomUUID();
      await saveWorkflowVersion({ id, ownerId, projectId: payload.projectId, version: workflow.version, status: confirmed ? "confirmed" : "draft", graphJson: JSON.stringify(workflow), confirmed });
      return Response.json({ workflowVersionId: id }, { status: 201 });
    }
    if (payload.action === "start") {
      if (!payload.workflowVersionId) return Response.json({ code: "workflow_required", error: "运行必须引用已保存流程版本。" }, { status: 400 });
      const workflow = await getWorkflowVersion(ownerId, payload.workflowVersionId);
      if (!workflow || workflow.status !== "confirmed" || (payload.projectId && workflow.projectId !== payload.projectId)) return Response.json({ code: "workflow_not_confirmed", error: "只能运行已确认且属于当前项目的流程版本。" }, { status: 409 });
      const id = crypto.randomUUID();
      await createWorkflowRun({ id, ownerId, projectId: payload.projectId ?? "default", workflowVersionId: payload.workflowVersionId, configJson: JSON.stringify(payload.config ?? {}) });
      await addRunEvent({ id: crypto.randomUUID(), runId: id, type: "run_started", message: "确定性流程运行已开始。" });
      return Response.json({ runId: id, status: "running" }, { status: 201 });
    }
    if (payload.action === "event" && payload.runId) {
      if (!(await getWorkflowRun(ownerId, payload.runId))) return Response.json({ code: "run_not_found", error: "运行记录不存在或无权访问。" }, { status: 404 });
      await addRunEvent({ id: crypto.randomUUID(), runId: payload.runId, type: "node_event", nodeId: payload.nodeId, message: payload.message ?? "节点事件" });
      return Response.json({ ok: true });
    }
    if (payload.action === "artifact" && payload.runId && payload.artifact?.kind && payload.artifact.label && payload.artifact.provenance) {
      if (!(await getWorkflowRun(ownerId, payload.runId))) return Response.json({ code: "run_not_found", error: "运行记录不存在或无权访问。" }, { status: 404 });
      const contentJson = JSON.stringify(payload.artifact.content ?? {});
      if (contentJson.length > 100_000) return Response.json({ code: "artifact_too_large", error: "运行产物超过 D1 单条记录限制，请使用文件存储适配器。" }, { status: 413 });
      await saveRunArtifact({ id: crypto.randomUUID(), runId: payload.runId, nodeId: payload.artifact.nodeId, kind: payload.artifact.kind, label: payload.artifact.label, provenance: payload.artifact.provenance, inputHash: payload.artifact.inputHash, contentJson });
      return Response.json({ ok: true }, { status: 201 });
    }
    if (payload.action === "finish" && payload.runId && payload.status) {
      if (!(await getWorkflowRun(ownerId, payload.runId))) return Response.json({ code: "run_not_found", error: "运行记录不存在或无权访问。" }, { status: 404 });
      await finishWorkflowRun({ ownerId, runId: payload.runId, status: payload.status, error: payload.error });
      await addRunEvent({ id: crypto.randomUUID(), runId: payload.runId, type: `run_${payload.status}`, message: payload.error ?? `运行${payload.status === "succeeded" ? "完成" : "结束"}。` });
      return Response.json({ ok: true });
    }
    return Response.json({ code: "unsupported_run_action", error: "不支持的运行操作。" }, { status: 400 });
  } catch { return Response.json({ code: "run_write_failed", error: "运行记录写入失败。" }, { status: 503 }); }
}
