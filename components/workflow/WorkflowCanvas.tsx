"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, GitBranch, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canConnect, getModuleDefinition, moduleRegistry } from "@/lib/modules/registry";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/lib/contracts/workflow";

const labelToId = new Map(moduleRegistry.map((module) => [module.label, module.id]));
const palette = moduleRegistry.filter((module) => module.implemented);

function initialGraph(labels: string[]): WorkflowGraph {
  const nodes: WorkflowNode[] = labels.map((label, index) => {
    const definition = getModuleDefinition(labelToId.get(label) ?? "data.import") ?? palette[0];
    return { id: `node-${index + 1}`, type: definition.id, version: definition.version, label: definition.label, x: 44 + (index % 3) * 235, y: 54 + Math.floor(index / 3) * 132, config: {}, provenance: "ai_suggestion" };
  });
  const edges: WorkflowEdge[] = nodes.slice(1).flatMap((node, index) => {
    const source = nodes[index]; const sourceDef = getModuleDefinition(source.type); const targetDef = getModuleDefinition(node.type);
    const port = sourceDef?.outputs.find((candidate) => targetDef?.inputs.includes(candidate));
    return port ? [{ id: `edge-${index + 1}`, source: source.id, target: node.id, sourcePort: port, targetPort: port }] : [];
  });
  return { version: "workflow.v1", nodes, edges };
}

export function WorkflowCanvas({ labels, projectId, onConfirm }: { labels: string[]; projectId: string; onConfirm: (graph: WorkflowGraph, workflowVersionId: string) => void }) {
  const [graph, setGraph] = useState<WorkflowGraph>(() => initialGraph(labels));
  const [selected, setSelected] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const selectedNode = graph.nodes.find((node) => node.id === selected) ?? null;
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  const addNode = (type: string) => {
    const definition = getModuleDefinition(type);
    if (!definition) return;
    const node: WorkflowNode = { id: `node-${crypto.randomUUID().slice(0, 8)}`, type, version: definition.version, label: definition.label, x: 40 + (graph.nodes.length % 3) * 235, y: 62 + Math.floor(graph.nodes.length / 3) * 132, config: {}, provenance: "user_input" };
    setGraph((current) => ({ ...current, nodes: [...current.nodes, node] })); setSelected(node.id);
  };

  const removeNode = () => {
    if (!selected) return;
    setGraph((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selected), edges: current.edges.filter((edge) => edge.source !== selected && edge.target !== selected) }));
    setSelected(null);
  };

  const toggleConnection = (nodeId: string) => {
    if (!connectFrom) { setConnectFrom(nodeId); return; }
    if (connectFrom === nodeId) { setConnectFrom(null); return; }
    const source = nodeMap.get(connectFrom); const target = nodeMap.get(nodeId);
    if (!source || !target || !canConnect(source.type, target.type)) { setConnectFrom(null); return; }
    const sourceDef = getModuleDefinition(source.type); const targetDef = getModuleDefinition(target.type);
    const sourcePort = sourceDef?.outputs.find((port) => targetDef?.inputs.includes(port));
    const targetPort = sourcePort && targetDef?.inputs.includes(sourcePort) ? sourcePort : undefined;
    if (!sourcePort || !targetPort) { setConnectFrom(null); return; }
    setGraph((current) => current.edges.some((edge) => edge.source === source.id && edge.target === target.id) ? current : { ...current, edges: [...current.edges, { id: `edge-${crypto.randomUUID().slice(0, 8)}`, source: source.id, target: target.id, sourcePort, targetPort }] });
    setConnectFrom(null);
  };

  const moveNode = (event: React.MouseEvent, nodeId: string) => {
    event.preventDefault(); const startX = event.clientX; const startY = event.clientY; const node = nodeMap.get(nodeId); if (!node) return;
    const move = (next: MouseEvent) => setGraph((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === nodeId ? { ...item, x: Math.max(8, node.x + next.clientX - startX), y: Math.max(8, node.y + next.clientY - startY) } : item) }));
    const stop = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", stop); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", stop);
  };

  const persist = async (confirm: boolean) => {
    try {
      const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_workflow", projectId, workflow: { ...graph, status: confirm ? "confirmed" : "draft" } }) });
      const payload = await response.json() as { workflowVersionId?: string; error?: string };
      if (!response.ok) return;
      if (confirm && payload.workflowVersionId) onConfirm(graph, payload.workflowVersionId);
    } catch { return; }
  };

  return <section className="flow-editor">
    <aside className="flow-palette panel"><div className="panel-heading"><div><p className="eyebrow">MODULE LIBRARY</p><h2>模块库</h2></div><GitBranch size={18}/></div><div className="flow-palette-list">{palette.map((module) => <button key={module.id} type="button" onClick={() => addNode(module.id)}><Plus size={14}/><span><strong>{module.label}</strong><small>{module.description}</small></span></button>)}</div><div className="flow-palette-note">未注册的自定义执行器会被标记为待实现，不能伪造成功结果。</div></aside>
    <section className="flow-canvas panel"><div className="flow-toolbar"><div><p className="eyebrow">EDITABLE WORKFLOW · {graph.version}</p><h1>确认可执行流程</h1></div><div className="flow-actions"><Button variant="outline" onClick={() => void persist(false)}><Save size={15}/>保存草稿</Button><Button variant="outline" onClick={removeNode} disabled={!selected}><Trash2 size={15}/>删除节点</Button><Button onClick={() => void persist(true)}><Check size={15}/>确认并进入运行</Button></div></div><div className="flow-canvas-stage"><svg className="flow-edges" aria-hidden="true">{graph.edges.map((edge) => { const source = nodeMap.get(edge.source); const target = nodeMap.get(edge.target); if (!source || !target) return null; return <line key={edge.id} x1={source.x + 172} y1={source.y + 40} x2={target.x} y2={target.y + 40} />; })}</svg>{graph.nodes.map((node) => <button key={node.id} type="button" className={`flow-node-card ${selected === node.id ? "selected" : ""} ${connectFrom === node.id ? "connecting" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(node.id)} onDoubleClick={() => toggleConnection(node.id)} onMouseDown={(event) => moveNode(event, node.id)}><span className="flow-node-type">{getModuleDefinition(node.type)?.execution === "ai" ? "AI" : getModuleDefinition(node.type)?.execution === "manual" ? "人工" : "计算"}</span><strong>{node.label}</strong><small>{getModuleDefinition(node.type)?.description}</small><span className="flow-node-footer">{node.provenance === "ai_suggestion" ? "AI 建议" : "用户添加"}<ChevronDown size={13}/></span></button>)}</div><p className="flow-help">点击节点查看配置；双击两个节点按顺序连线。只有注册模块和匹配端口可以连接。</p></section>
    <aside className="flow-inspector panel"><div className="panel-heading"><div><p className="eyebrow">NODE INSPECTOR</p><h2>{selectedNode?.label ?? "未选择节点"}</h2></div>{selectedNode && <button type="button" aria-label="取消选择" onClick={() => setSelected(null)}><X size={16}/></button>}</div>{selectedNode ? <div className="flow-inspector-content"><div className="flow-inspector-status"><span>来源</span><strong>{selectedNode.provenance === "ai_suggestion" ? "AI 建议，可编辑" : "用户输入"}</strong></div><div className="flow-inspector-block"><span>模块类型</span><code>{selectedNode.type}@{selectedNode.version}</code></div><div className="flow-inspector-block"><span>输入端口</span><p>{getModuleDefinition(selectedNode.type)?.inputs.join(" · ") || "无"}</p></div><div className="flow-inspector-block"><span>输出端口</span><p>{getModuleDefinition(selectedNode.type)?.outputs.join(" · ") || "无"}</p></div><Button className="full-button" variant="outline" onClick={() => setConnectFrom(selectedNode.id)}><GitBranch size={15}/>{connectFrom ? "请双击目标节点" : "开始连线"}</Button></div> : <div className="flow-empty">从画布选择一个节点，查看它的端口、版本和来源。</div>}</aside>
  </section>;
}
