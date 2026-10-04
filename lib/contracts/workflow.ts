export type ProvenanceKind = "ai_suggestion" | "computed" | "user_input" | "literature" | "demo_data";
export type RunStatus = "queued" | "running" | "waiting_review" | "waiting_data" | "succeeded" | "failed" | "cancelled";
export type PortKind = "question" | "evidence" | "dataset" | "model" | "parameters" | "trajectory" | "diagnostic" | "experiment";

export type WorkflowNode = {
  id: string;
  type: string;
  version: string;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  provenance: ProvenanceKind;
};
export type WorkflowEdge = { id: string; source: string; target: string; sourcePort: PortKind; targetPort: PortKind };
export type WorkflowGraph = { version: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] };
export type ArtifactRef = { id: string; type: string; label: string; provenance: ProvenanceKind; inputHash?: string };
export type RunEvent = { type: string; at: string; message: string; nodeId?: string; artifactIds?: string[] };
export type RunRecord = { id: string; projectId: string; workflowVersionId: string; status: RunStatus; startedAt?: string; finishedAt?: string; events: RunEvent[]; artifacts: ArtifactRef[]; error?: string };
export const EMPTY_WORKFLOW: WorkflowGraph = { version: "workflow.v1", nodes: [], edges: [] };
