export type Proposal = {
  title: string;
  summary: string;
  observables: string[];
  modules: Array<{ name: string; purpose: string }>;
  modelCandidates: Array<{ name: string; equations: string; assumptions: string; evidenceLevel: "established" | "hypothesis" | "phenomenological" }>;
  diagnosticOrder: string[];
  knowledgeUse: string[];
  warning: string;
  nextAction: string;
};

export const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "observables", "modules", "modelCandidates", "diagnosticOrder", "knowledgeUse", "warning", "nextAction"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    observables: { type: "array", items: { type: "string" } },
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "purpose"],
        properties: { name: { type: "string" }, purpose: { type: "string" } },
      },
    },
    modelCandidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "equations", "assumptions", "evidenceLevel"],
        properties: {
          name: { type: "string" },
          equations: { type: "string" },
          assumptions: { type: "string" },
          evidenceLevel: { type: "string", enum: ["established", "hypothesis", "phenomenological"] },
        },
      },
    },
    diagnosticOrder: { type: "array", items: { type: "string" } },
    knowledgeUse: { type: "array", items: { type: "string" } },
    warning: { type: "string" },
    nextAction: { type: "string" },
  },
} as const;

export type ProviderErrorCode = "ai_authentication_failed" | "ai_model_unavailable" | "ai_request_rejected" | "ai_invalid_response" | "ai_unavailable";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;

  constructor(code: ProviderErrorCode, status: number, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isProposal(value: unknown): value is Proposal {
  if (!isRecord(value) || !hasOnlyKeys(value, ["title", "summary", "observables", "modules", "modelCandidates", "diagnosticOrder", "knowledgeUse", "warning", "nextAction"])) return false;
  if (![value.title, value.summary, value.warning, value.nextAction].every((item) => typeof item === "string")) return false;
  if (![value.observables, value.diagnosticOrder, value.knowledgeUse].every(isStringArray)) return false;
  if (!Array.isArray(value.modules) || !value.modules.every((module) => isRecord(module) && hasOnlyKeys(module, ["name", "purpose"]) && typeof module.name === "string" && typeof module.purpose === "string")) return false;
  return Array.isArray(value.modelCandidates) && value.modelCandidates.every((candidate) =>
    isRecord(candidate) &&
    hasOnlyKeys(candidate, ["name", "equations", "assumptions", "evidenceLevel"]) &&
    typeof candidate.name === "string" &&
    typeof candidate.equations === "string" &&
    typeof candidate.assumptions === "string" &&
    ["established", "hypothesis", "phenomenological"].includes(String(candidate.evidenceLevel))
  );
}

function contentText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const parts = value.map((part) => {
    if (!isRecord(part)) return "";
    return typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "";
  }).filter(Boolean);
  return parts.length ? parts.join("") : undefined;
}

function parseStructuredContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function classifyUpstreamError(status: number, payload: unknown): ProviderError {
  if (status === 401 || status === 403) return new ProviderError("ai_authentication_failed", 502, "AI 服务认证失败；请检查服务端密钥权限。");
  const payloadText = isRecord(payload) ? JSON.stringify(payload).toLowerCase() : "";
  if (status === 404 || /model[^\n]*(not found|unavailable|does not exist)|model_not_found/.test(payloadText)) {
    return new ProviderError("ai_model_unavailable", 502, "配置的 AI 模型不可用；请检查完整模型 ID 和账户权限。");
  }
  return new ProviderError("ai_request_rejected", 502, "AI 服务拒绝了请求；请检查模型能力和结构化输出配置。");
}

export async function requestQuickRouterProposal(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  fetcher?: typeof fetch;
}): Promise<Proposal> {
  let endpoint: string;
  try {
    const base = new URL(options.baseUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error("Unsupported protocol");
    endpoint = base.toString().replace(/\/+$/, "") + "/chat/completions";
  } catch {
    throw new ProviderError("ai_request_rejected", 500, "AI_BASE_URL 配置无效。");
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + options.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: "system", content: options.instructions },
          { role: "user", content: options.input },
        ],
        temperature: 0.2,
        max_tokens: 1400,
        response_format: { type: "json_schema", json_schema: { name: "workstation_workflow", strict: true, schema: proposalSchema } },
      }),
    });
  } catch {
    throw new ProviderError("ai_unavailable", 502, "无法连接 AI 服务；请检查服务地址和网络状态。");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw classifyUpstreamError(response.status, undefined);
    throw new ProviderError("ai_invalid_response", 502, "AI 服务返回了非 JSON 响应。");
  }
  if (!response.ok) throw classifyUpstreamError(response.status, payload);

  const content = isRecord(payload) && Array.isArray(payload.choices) && isRecord(payload.choices[0]) && isRecord(payload.choices[0].message)
    ? contentText(payload.choices[0].message.content)
    : undefined;
  if (!content) throw new ProviderError("ai_invalid_response", 502, "AI 服务未返回文本格式的结构化结果。");

  let result: unknown;
  try {
    result = parseStructuredContent(content);
  } catch {
    throw new ProviderError("ai_invalid_response", 502, "AI 服务返回内容不是有效 JSON。");
  }
  if (!isProposal(result)) throw new ProviderError("ai_invalid_response", 502, "AI 服务返回内容不符合工作流字段约束。");
  return result;
}
