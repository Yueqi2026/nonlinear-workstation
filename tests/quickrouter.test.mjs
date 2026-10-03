import assert from "node:assert/strict";
import test from "node:test";
import { ProviderError, requestQuickRouterProposal } from "../lib/quickrouter.ts";

const proposal = {
  title: "CD8T 时间序列分析",
  summary: "先确认读出定义，再比较候选动力学模型。",
  observables: ["效应蛋白阳性率"],
  modules: [{ name: "数据检查", purpose: "检查时间、单位和重复。" }],
  modelCandidates: [{ name: "最小 ODE", equations: "dE/dt = ...", assumptions: "现象学候选。", evidenceLevel: "phenomenological" }],
  diagnosticOrder: ["检查观测定义", "拟合参数"],
  knowledgeUse: [],
  warning: "内置数据是模拟数据。",
  nextAction: "核对实验时间单位。",
};

const options = {
  baseUrl: "https://router.example/v1/",
  apiKey: "test-secret-never-log",
  model: "router-model-full-id",
  instructions: "只返回 JSON。",
  input: "模拟科研问题：CD8T 阳性率先升后降的可能解释是什么？",
};

function okResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

test("sends Chat Completions JSON schema request and parses the constrained proposal", async () => {
  let request;
  const result = await requestQuickRouterProposal({
    ...options,
    fetcher: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return okResponse(JSON.stringify(proposal));
    },
  });

  assert.equal(request.url, "https://router.example/v1/chat/completions");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer test-secret-never-log");
  assert.equal(request.body.model, options.model);
  assert.equal(request.body.response_format.type, "json_schema");
  assert.deepEqual(request.body.response_format.json_schema, {
    name: "workstation_workflow",
    strict: true,
    schema: request.body.response_format.json_schema.schema,
  });
  assert.equal(request.body.response_format.json_schema.schema.additionalProperties, false);
  assert.deepEqual(result, proposal);
});

test("maps provider 401/403 to a sanitized authentication error", async () => {
  await assert.rejects(
    requestQuickRouterProposal({ ...options, fetcher: async () => new Response("private upstream detail", { status: 401 }) }),
    (error) => error instanceof ProviderError && error.code === "ai_authentication_failed" && !error.message.includes("private upstream detail") && !error.message.includes(options.apiKey),
  );
});

test("maps a missing model to a sanitized model-unavailable error", async () => {
  await assert.rejects(
    requestQuickRouterProposal({ ...options, fetcher: async () => Response.json({ error: { code: "model_not_found", message: options.apiKey } }, { status: 404 }) }),
    (error) => error instanceof ProviderError && error.code === "ai_model_unavailable" && !error.message.includes(options.apiKey),
  );
});

test("rejects non-JSON HTTP responses", async () => {
  await assert.rejects(
    requestQuickRouterProposal({ ...options, fetcher: async () => new Response("upstream html error", { status: 200, headers: { "Content-Type": "text/html" } }) }),
    (error) => error instanceof ProviderError && error.code === "ai_invalid_response",
  );
});

test("rejects invalid JSON content and schema violations", async () => {
  await assert.rejects(
    requestQuickRouterProposal({ ...options, fetcher: async () => okResponse("not json") }),
    (error) => error instanceof ProviderError && error.code === "ai_invalid_response",
  );
  await assert.rejects(
    requestQuickRouterProposal({ ...options, fetcher: async () => okResponse(JSON.stringify({ ...proposal, unexpected: "extra" })) }),
    (error) => error instanceof ProviderError && error.code === "ai_invalid_response",
  );
});
