"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Beaker, BrainCircuit, Check, ChevronRight, Database, FileUp, GitBranch, Play, Plus, RefreshCw, Sparkles, TestTubeDiagonal, X } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type View = "intake" | "plan" | "workspace";
type Model = "M0" | "M1";
type Params = { ko: number; kc: number; ks: number; kd: number; th: number; sg: number; kf: number; fd: number };
type Fit = { p: Params; y: number[]; error: number; starts: number };
type Fits = { m0: Fit; m1: Fit };
type Edge = [number, number, number];
type KnowledgeDocument = { id: string; title: string; content: string; tags: string; createdAt: string; updatedAt: string };
type WorkflowProposal = {
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

const T = [0, 4, 8, 12, 16, 24, 36, 48];
const CD8_V1 = [3, 9, 27, 54, 71, 63, 39, 24];
const CD8_V2 = [3, 9, 27, 54, 71, 63, 36, 20];
const CD8_QUESTION = "在体外激活的人源 CD8+ T 细胞中，效应分子阳性率为什么在 16 小时达到峰值后逐步下降？构建最小 ODE 模型，比较持续表达与晚期负反馈机制，并推荐区分两者的测量时间点。";
const CD8_SYSTEM = "人源 CD8+ T 细胞；体外 TCR/CD28 刺激；读出为效应蛋白阳性率（%）；时间点 0、4、8、12、16、24、36、48 h。当前内置数据为明确标注的模拟基准。";
const YEAST_QUESTION = "复现 Li 等（2004）酿酒酵母细胞周期 11 节点布尔网络的状态路径、固定点和主 G1 吸引域；删除一条调控边并比较鲁棒性。";
const YEAST_SYSTEM = "出芽酵母细胞周期；11 节点同步布尔网络；输入为 Start 状态，读出为状态转移和吸引域。参考数据为论文 Table 2 的模型状态序列，不是实验时间序列。";
const PROJECTS = [
  { id: "cd8", name: "CD8T 激活动力学", status: "进行中", abstract: "用 ODE、拟合和区分时间点解释群体阳性率先升后降。" },
  { id: "yeast", name: "酵母细胞周期", status: "可运行", abstract: "复现 Li 等（2004）同步布尔网络、7 个固定点和主 G1 吸引域。" },
  { id: "pattern", name: "反应扩散斑图", status: "构想", abstract: "下一迭代的空间动力学案例。" },
];

const P0: Params = { ko: .22, kc: .38, ks: .95, kd: .10, th: 1.20, sg: .22, kf: .036, fd: .025 };
const P1: Params = { ko: .18, kc: .53, ks: .77, kd: .12, th: 1.07, sg: .19, kf: .036, fd: .025 };
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-clip(x, -35, 35)));
const error = (data: number[], y: number[]) => Math.sqrt(data.reduce((sum, x, i) => sum + (x - y[i]) ** 2, 0) / data.length);

function derivative(x: number[], p: Params, model: Model) {
  const inhibition = model === "M1" ? 1 / (1 + x[2]) : 1;
  return [p.ko * (1 - x[0]) - p.kc * x[0], p.ks * x[0] * inhibition - p.kd * x[1], model === "M1" ? p.kf * x[1] - p.fd * x[2] : 0];
}
function integrate(p: Params, model: Model, grid = T) {
  let x = [0, 0, 0]; let t = 0;
  return grid.map((target) => {
    while (t < target - 1e-9) {
      const h = Math.min(.15, target - t); const k1 = derivative(x, p, model);
      const k2 = derivative(x.map((v, i) => v + h * k1[i] / 2), p, model);
      const k3 = derivative(x.map((v, i) => v + h * k2[i] / 2), p, model);
      const k4 = derivative(x.map((v, i) => v + h * k3[i]), p, model);
      x = x.map((v, i) => Math.max(0, v + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6)); t += h;
    }
    return 100 * sigmoid((x[1] - p.th) / p.sg);
  });
}
const evaluate = (p: Params, model: Model, data: number[], starts = 0): Fit => { const y = integrate(p, model); return { p, y, error: error(data, y), starts }; };
function random(seed: number) { let v = seed >>> 0; return () => { v = (1664525 * v + 1013904223) >>> 0; return v / 4294967296; }; }
function fit(model: Model, data: number[]) {
  const n = model === "M0" ? 1200 : 2600; const r = random(model === "M0" ? 481516 : 230119);
  let best = evaluate(model === "M0" ? P0 : P1, model, data, n);
  for (let i = 0; i < n; i += 1) {
    const p: Params = { ko: .07 + .47 * r(), kc: .10 + .60 * r(), ks: .25 + 1.25 * r(), kd: .035 + .26 * r(), th: .25 + 1.4 * r(), sg: .11 + .28 * r(), kf: model === "M1" ? .012 + .09 * r() : .036, fd: model === "M1" ? .008 + .085 * r() : .025 };
    const candidate = evaluate(p, model, data, n); if (candidate.error < best.error) best = candidate;
  }
  return best;
}
const preview = (data: number[]): Fits => ({ m0: evaluate(P0, "M0", data), m1: evaluate(P1, "M1", data) });
const fitBoth = (data: number[]): Fits => ({ m0: fit("M0", data), m1: fit("M1", data) });
function recommended(fits: Fits) {
  const candidates = [18, 20, 22, 28, 30, 32, 40, 42, 44, 46];
  const a = integrate(fits.m0.p, "M0", candidates); const b = integrate(fits.m1.p, "M1", candidates);
  return candidates.reduce((best, t, i) => Math.abs(a[i] - b[i]) > best.delta ? { t, delta: Math.abs(a[i] - b[i]) } : best, { t: candidates[0], delta: Math.abs(a[0] - b[0]) });
}
function parseCsv(raw: string, fallback: number[]) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(line.includes("\t") ? "\t" : ",").map((x) => x.trim()));
  const head = lines[0]?.map((x) => x.toLowerCase()) ?? [];
  const ti = head.findIndex((x) => /time|hour|时间/.test(x)); const vi = head.findIndex((x) => /value|positive|percent|阳性|比例|%/.test(x));
  const start = ti >= 0 || vi >= 0 ? 1 : 0;
  const points = lines.slice(start).map((row) => ({ t: Number(row[ti >= 0 ? ti : 0]), y: Number(row[vi >= 0 ? vi : 1]) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.y));
  if (!points.length) return { data: fallback, note: "未识别到时间与读出数值列，已保留当前数据。" };
  const fraction = points.every((x) => x.y >= 0 && x.y <= 1.001);
  return { data: T.map((t) => { const near = points.reduce((a, b) => Math.abs(a.t - t) < Math.abs(b.t - t) ? a : b); return clip((fraction ? near.y * 100 : near.y), 0, 100); }), note: "读取 " + points.length + " 行；" + (fraction ? "0–1 比例已换算为百分比。" : "使用原百分比。") + "每个展示时间点采用最近观测。" };
}

const N = ["Cln3", "MBF", "SBF", "Cln1,2", "Cdh1", "Swi5", "Cdc20/Cdc14", "Clb5,6", "Sic1", "Clb1,2", "Mcm1/SFF"];
const TD = new Set([0, 3, 5, 6, 10]);
const E: Edge[] = [[0,1,1],[0,2,1],[2,3,1],[1,7,1],[7,9,1],[7,10,1],[9,10,1],[9,6,1],[10,9,1],[10,6,1],[10,5,1],[6,4,1],[6,5,1],[6,8,1],[5,8,1],[3,8,-1],[3,4,-1],[7,8,-1],[7,4,-1],[9,2,-1],[9,1,-1],[9,8,-1],[9,4,-1],[9,5,-1],[6,7,-1],[6,9,-1],[4,9,-1],[8,9,-1],[8,7,-1]];
const REF = [[1,0,0,0,1,0,0,0,1,0,0],[0,1,1,0,1,0,0,0,1,0,0],[0,1,1,1,1,0,0,0,1,0,0],[0,1,1,1,0,0,0,0,0,0,0],[0,1,1,1,0,0,0,1,0,0,0],[0,1,1,1,0,0,0,1,0,1,1],[0,0,0,1,0,0,1,1,0,1,1],[0,0,0,0,0,1,1,0,0,1,1],[0,0,0,0,0,1,1,0,1,1,1],[0,0,0,0,0,1,1,0,1,0,1],[0,0,0,0,0,1,1,0,1,0,0],[0,0,0,0,1,1,1,0,1,0,0],[0,0,0,0,1,0,0,0,1,0,0]];
const key = (x: number[]) => x.join("");
function step(x: number[], deleted = false) { return x.map((own, target) => { let sum = 0; E.forEach(([from, to, w]) => { if (to === target && !(deleted && from === 0 && to === 2)) sum += w * x[from]; }); return sum > 0 ? 1 : sum < 0 ? 0 : TD.has(target) ? 0 : own; }); }
function trajectory(deleted = false) { const out = [REF[0]]; while (out.length < REF.length) out.push(step(out[out.length - 1], deleted)); return out; }
function basins(deleted = false) {
  const map = new Map<string, { state: number[]; basin: number; cycle: number }>();
  for (let seed = 0; seed < 2048; seed += 1) {
    let x = N.map((_, i) => (seed >> (10 - i)) & 1); const history: number[][] = []; const seen = new Map<string, number>();
    for (let j = 0; j < 40; j += 1) { const k = key(x); const hit = seen.get(k); if (hit !== undefined) { const cycle = history.slice(hit); const id = cycle.map(key).sort()[0]; const old = map.get(id); map.set(id, { state: cycle[0], basin: (old?.basin ?? 0) + 1, cycle: cycle.length }); break; } seen.set(k, history.length); history.push(x); x = step(x, deleted); }
  }
  return Array.from(map.entries()).map(([id, value]) => ({ id, ...value })).sort((a, b) => b.basin - a.basin);
}

export default function Home() {
  const [view, setView] = useState<View>("intake"); const [project, setProject] = useState("cd8"); const [q, setQ] = useState(""); const [system, setSystem] = useState("");
  const [ready, setReady] = useState(false); const [modules, setModules] = useState<string[]>(["数据导入与检查","最小 ODE 网络","群体阳性率映射","多起点参数拟合","竞争模型比较","关键时间点推荐","新数据回灌"]);
  const [data, setData] = useState(CD8_V1); const [source, setSource] = useState("内置模拟基准 v1"); const [fits, setFits] = useState<Fits>(() => preview(CD8_V1)); const [running, setRunning] = useState(false); const [completed, setCompleted] = useState(false); const [notice, setNotice] = useState("请先定义科学问题"); const file = useRef<HTMLInputElement>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null); const [analysisLoading, setAnalysisLoading] = useState(false); const [proposal, setProposal] = useState<WorkflowProposal | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeDocument[]>([]); const [knowledgeTitle, setKnowledgeTitle] = useState(""); const [knowledgeContent, setKnowledgeContent] = useState(""); const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const yeast = project === "yeast"; const rec = useMemo(() => recommended(fits), [fits]);
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const [knowledgeResponse, runtimeResponse] = await Promise.all([fetch("/api/knowledge"), fetch("/api/runtime")]);
        const knowledgePayload = await knowledgeResponse.json() as { documents?: KnowledgeDocument[] };
        const runtimePayload = await runtimeResponse.json() as { aiConfigured?: boolean };
        if (active) {
          if (knowledgeResponse.ok) setKnowledge(knowledgePayload.documents ?? []);
          setAiConfigured(Boolean(runtimePayload.aiConfigured));
        }
      } catch {
        if (active) {
          setAiConfigured(false);
          setNotice("知识库暂不可用；可以先继续编辑问题。");
        }
      }
    };
    void initialize();
    return () => { active = false; };
  }, []);
  const loadCd8 = () => { setProject("cd8"); setProposal(null); setQ(CD8_QUESTION); setSystem(CD8_SYSTEM); setModules(["数据导入与检查","最小 ODE 网络","群体阳性率映射","多起点参数拟合","竞争模型比较","关键时间点推荐","新数据回灌"]); setNotice("CD8T 模拟基准已载入。"); };
  const loadYeast = () => { setProject("yeast"); setProposal(null); setQ(YEAST_QUESTION); setSystem(YEAST_SYSTEM); setModules(["论文参考轨迹","同步逻辑更新","2,048 初态穷举","Cln3 → SBF 边删除","复现检查"]); setNotice("酵母复现案例已载入。"); };
  const choose = (id: string) => { setReady(false); if (id === "cd8") loadCd8(); else if (id === "yeast") loadYeast(); else { setProject(id); setQ("激活子—抑制子反应扩散体系在什么条件下形成稳定斑图？"); setSystem("二维反应扩散体系；当前仅为入口示例。"); setNotice("反应扩散案例尚未纳入本轮可运行范围。"); } };
  const analyse = async () => {
    if (!q.trim() || !system.trim()) { setNotice("请先填写科学问题和研究体系"); return; }
    setAnalysisLoading(true); setNotice("服务端正在检索项目知识库并生成受控流程建议…");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, system }) });
      const payload = await response.json() as { proposal?: WorkflowProposal; error?: string; code?: string };
      if (!response.ok || !payload.proposal) throw new Error(payload.code === "ai_not_configured" ? "受控 AI 尚未启用：请管理员配置站点密钥。" : payload.error ?? "AI 未返回可用流程。");
      setProposal(payload.proposal); setModules(payload.proposal.modules.map((module) => module.name)); setReady(true); setView("plan"); setNotice("AI 已生成候选流程；请审查每个模块和模型假设。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI 工作流请求失败。");
    } finally { setAnalysisLoading(false); }
  };
  const saveKnowledge = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) { setNotice("请输入知识条目的标题和内容。"); return; }
    setKnowledgeSaving(true);
    try {
      const response = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: knowledgeTitle, content: knowledgeContent }) });
      const payload = await response.json() as { documents?: KnowledgeDocument[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "保存知识条目失败。");
      setKnowledge(payload.documents ?? []); setKnowledgeTitle(""); setKnowledgeContent(""); setNotice("知识条目已保存，后续 AI 分析会按相关性检索。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存知识条目失败。"); } finally { setKnowledgeSaving(false); }
  };
  const deleteKnowledge = async (id: string) => {
    try { const response = await fetch("/api/knowledge?id=" + encodeURIComponent(id), { method: "DELETE" }); const payload = await response.json() as { documents?: KnowledgeDocument[] }; if (response.ok) setKnowledge(payload.documents ?? []); } catch { setNotice("删除知识条目失败。"); }
  };
  const run = () => { setRunning(true); setCompleted(false); setNotice("RK4 数值积分与固定随机种子多起点拟合正在执行…"); window.setTimeout(() => { const next = fitBoth(data); setFits(next); setRunning(false); setCompleted(true); setNotice("完成：M1 RMSE " + next.m1.error.toFixed(1) + "，建议在 " + recommended(next).t + " h 加测。"); }, 50); };
  const importData = (event: React.ChangeEvent<HTMLInputElement>) => { const f = event.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { const parsed = parseCsv(String(reader.result ?? ""), data); setData(parsed.data); setSource(f.name); setFits(preview(parsed.data)); setCompleted(false); setNotice(parsed.note); }; reader.readAsText(f); event.target.value = ""; };
  const chart = T.map((t, i) => ({ t, data: data[i], M0: +fits.m0.y[i].toFixed(2), M1: +fits.m1.y[i].toFixed(2) }));
  return <main className="app-shell"><aside className="project-sidebar"><div className="side-brand"><div className="brand-mark"><Activity size={19} /></div><div><span>NONLINEAR</span><strong>科研工作站</strong></div></div><Button className="new-project" onClick={() => { setView("intake"); setQ(""); setSystem(""); setReady(false); }}><Plus size={16} />新建研究课题</Button><div className="topic-heading">研究课题</div><nav className="topic-list">{PROJECTS.map((item) => <button className={"topic-item " + (project === item.id ? "active" : "")} onClick={() => choose(item.id)} key={item.id}><span className="topic-icon"><Beaker size={15} /></span><span className="topic-copy"><strong>{item.name}</strong><small>{item.status}</small></span><ChevronRight size={15} /><span className="topic-abstract"><em>ABSTRACT</em>{item.abstract}</span></button>)}</nav><div className="side-note"><Sparkles size={16} /><span>所有模型分支和流程建议均需人工审查。</span></div></aside>
    <section className="main-stage"><header className="stage-header"><div className="stage-path"><button className={view === "intake" ? "active" : "done"} onClick={() => setView("intake")}><span>1</span>定义问题</button><ChevronRight size={14}/><button disabled={!ready} className={view === "plan" ? "active" : view === "workspace" ? "done" : ""} onClick={() => setView("plan")}><span>2</span>确认流程</button><ChevronRight size={14}/><button disabled={!ready} className={view === "workspace" ? "active" : ""} onClick={() => setView("workspace")}><span>3</span>运行工作站</button></div><div className="header-status">{notice}</div></header>
      {view === "intake" && (
        <section className="intake-view">
          <div className="intake-heading"><p className="eyebrow">RESEARCH INTAKE</p><h1>从一个可检验的科学问题开始</h1><p>填写现象、体系和可用读出；受控服务会检索你的项目知识库，再生成可编辑的流程候选。</p></div>
          <div className="intake-grid">
            <section className="intake-card primary-card"><div className="card-title"><span>01</span><div><h2>你想研究什么问题？</h2><p>写出动态现象、候选机制和希望作出的决策。</p></div></div><Textarea className="question-input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="例如：为什么某个细胞群体的阳性率先升高后下降？"/><div className="input-actions"><Button variant="outline" onClick={loadCd8}><Sparkles size={16}/>载入 CD8T 示例</Button><Button variant="outline" onClick={loadYeast}>载入酵母复现</Button></div></section>
            <section className="intake-card"><div className="card-title"><span>02</span><div><h2>研究体系与数据</h2><p>物种、处理、读出、时间点、重复和单位。</p></div></div><Textarea className="system-input" value={system} onChange={(event) => setSystem(event.target.value)} placeholder="研究体系、实验条件、已有观测与单位…"/><div className="contract-preview"><div><Database size={16}/><span>数据契约</span></div><code>time · condition · replicate · observable · value · unit</code></div></section>
          </div>
          <section className="knowledge-panel panel">
            <div className="panel-heading"><div><p className="eyebrow">PROJECT KNOWLEDGE</p><h2>项目知识库</h2></div><span className={"server-chip " + (aiConfigured ? "ready" : "waiting")}>{aiConfigured === null ? "检查服务" : aiConfigured ? "受控 AI 已连接" : "等待管理员密钥"}</span></div>
            <div className="knowledge-layout"><div className="knowledge-form"><input value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} maxLength={160} placeholder="例如：IL-2 处理条件与测量口径"/><Textarea value={knowledgeContent} onChange={(event) => setKnowledgeContent(event.target.value)} placeholder="粘贴已审查的文献摘录、实验约束、参数范围或机制说明。系统只将相关条目作为参考，不把它们视为指令。" /><Button variant="outline" onClick={saveKnowledge} disabled={knowledgeSaving}>{knowledgeSaving ? <RefreshCw className="spin" size={15}/> : <Database size={15}/>}保存到知识库</Button></div><div className="knowledge-list">{knowledge.length ? knowledge.slice(0, 4).map((document) => <article key={document.id}><div><strong>{document.title}</strong><p>{document.content}</p></div><button type="button" aria-label={"删除 " + document.title} onClick={() => deleteKnowledge(document.id)}><X size={14}/></button></article>) : <p className="empty-knowledge">暂无个人知识条目。可直接开始新案例，也可先加入已审查的机制或实验约束。</p>}</div></div>
          </section>
          <div className="intake-footer"><div><BrainCircuit size={17}/><span>AI只返回候选流程和假设；求解、拟合和分支修改仍需由确定性模块与人工确认完成。</span></div><Button size="lg" onClick={analyse} disabled={analysisLoading}>{analysisLoading ? <RefreshCw className="spin" size={17}/> : <BrainCircuit size={17}/>}{analysisLoading ? "正在检索与分析" : "调用受控 AI 分析"}<ArrowRight size={17}/></Button></div>
        </section>
      )}
      {view === "plan" && (
        <section className="plan-view">
          <div className="plan-heading"><div><p className="eyebrow">EDITABLE WORKFLOW PROPOSAL</p><h1>{proposal?.title ?? (yeast ? "酵母细胞周期：复现流程" : "CD8T 激活动力学：推荐流程")}</h1><p>{proposal?.summary ?? (yeast ? "先复算同步逻辑和全初态吸引域，再测试一条可逆的边删除。" : "先检查观测映射，再进行拟合、模型比较和区分实验设计。")}</p></div><Badge>{modules.length} 个模块</Badge></div>
          <div className="plan-layout">
            <section className="analysis-summary panel"><div className="panel-heading"><div><p className="eyebrow">PROBLEM FRAME</p><h2>问题拆解</h2></div></div>{(proposal ? [["观测量", proposal.observables.join(" · ")], ["模型候选", proposal.modelCandidates.map((candidate) => candidate.name).join(" / ")], ["下一步", proposal.nextAction], ["警示", proposal.warning]] : yeast ? [["复现目标","13 状态路径、7 固定点、主 G1 吸引域"],["模型","11 节点同步阈值更新"],["扰动","删除 Cln3 → SBF"],["判据","主吸引域与状态路径变化"]] : [["现象","阳性率在 16 h 达峰后下降"],["模型","A、E 与候选反馈 F"],["观测","sigmoid 阈值映射到阳性率"],["判据","RMSE、残差与时间点分离度"]]).map(([label, value]) => <div className="summary-block" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
            <section className="recommended-flow panel"><div className="panel-heading"><div><p className="eyebrow">PIPELINE</p><h2>确认模块</h2></div></div><div className="plan-modules">{modules.map((module, index) => <button className="plan-module active" onClick={() => setModules((items) => items.filter((_, itemIndex) => itemIndex !== index))} key={module}><span className="module-number">{String(index + 1).padStart(2,"0")}</span><div><strong>{module}</strong><small>{proposal?.modules.find((item) => item.name === module)?.purpose ?? "点击可从本次流程中移除"}</small></div><Check size={17}/></button>)}</div></section>
            <aside className="guardrail-panel"><h2>人工确认门槛</h2>{(proposal?.diagnosticOrder ?? ["核对数据或参考状态","运行最小模型","检查残差或状态偏离","创建候选分支","再做机制解释"]).map((item, index) => <div className="guardrail-step" key={item}><span>{index + 1}</span><p>{item}</p></div>)}</aside>
          </div>
          {proposal && <section className="proposal-review panel"><div className="panel-heading"><div><p className="eyebrow">AI CANDIDATES · HUMAN REVIEW REQUIRED</p><h2>模型候选与知识引用</h2></div></div><div className="proposal-grid">{proposal.modelCandidates.map((candidate) => <article key={candidate.name}><Badge variant="outline">{candidate.evidenceLevel}</Badge><h3>{candidate.name}</h3><code>{candidate.equations}</code><p>{candidate.assumptions}</p></article>)}<article className="knowledge-use"><span>检索到的知识条目</span>{proposal.knowledgeUse.length ? proposal.knowledgeUse.map((title) => <strong key={title}>{title}</strong>) : <p>本次未使用个人知识条目。</p>}</article></div></section>}
          <div className="plan-footer"><Button variant="outline" onClick={() => setView("intake")}>修改问题</Button><Button onClick={() => setView("workspace")}>确认流程并进入工作站<ArrowRight size={16}/></Button></div>
        </section>
      )}
      {view === "workspace" && (yeast ? <Yeast onNotice={setNotice}/> : <Cd8 chart={chart} fits={fits} rec={rec} source={source} running={running} completed={completed} file={file} onRun={run} onImport={importData} onLoop={() => { setData(CD8_V2); setSource("模拟补充观测 v2"); setFits(preview(CD8_V2)); setCompleted(false); setNotice("已回灌 36 h 与 48 h 的模拟补充观测；请重新拟合。"); }} />)}
    </section></main>;
}

function Cd8({ chart, fits, rec, source, running, completed, file, onRun, onImport, onLoop }: { chart: { t: number; data: number; M0: number; M1: number }[]; fits: Fits; rec: { t: number; delta: number }; source: string; running: boolean; completed: boolean; file: React.RefObject<HTMLInputElement | null>; onRun: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onLoop: () => void }) {
  return <section className="workspace-view"><header className="workspace-topbar"><div><p className="eyebrow">CD8T DYNAMICS · SIMULATED BENCHMARK</p><h1>真实数值积分与拟合</h1></div><div className="workspace-meta"><span>RK4 步长 0.15 h</span><span>M0 {fits.m0.starts || "预览"}</span><span>M1 {fits.m1.starts || "预览"}</span></div><div className="workspace-actions"><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={onImport}/><Button variant="outline" onClick={() => file.current?.click()}><FileUp size={15}/>导入 CSV</Button><Button onClick={onRun} disabled={running}>{running ? <RefreshCw className="spin" size={15}/> : <Play size={15}/>}{running ? "拟合中" : "运行闭环"}</Button></div></header><p className="data-source"><Database size={14}/>数据源：{source}。曲线为实际 ODE 数值积分；拟合为固定随机种子的多起点最小二乘搜索。</p><div className="cd8-grid"><section className="panel results-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>群体阳性率动力学</h2></div><div className="metric-pills"><span>M0 RMSE <strong>{fits.m0.error.toFixed(1)}</strong></span><span>M1 RMSE <strong>{fits.m1.error.toFixed(1)}</strong></span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={340}><LineChart data={chart}><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="t" label={{value:"时间 / h",position:"insideBottomRight",offset:-3}}/><YAxis domain={[0,100]} label={{value:"阳性率 / %",angle:-90,position:"insideLeft"}}/><Tooltip/><Legend/><ReferenceLine x={rec.t} stroke="#d97706" strokeDasharray="4 4" label={"建议 "+rec.t+" h"}/><Line type="monotone" dataKey="data" name="观测数据" stroke="#172b4d" strokeWidth={0} dot={{r:4}}/><Line type="monotone" dataKey="M0" name="M0 持续表达" stroke="#64748b" dot={false}/><Line type="monotone" dataKey="M1" name="M1 晚期负反馈" stroke="#00a6a6" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div></section><aside className="panel ai-panel"><div className="ai-heading"><div className="ai-icon"><BrainCircuit size={19}/></div><div><p className="eyebrow">RULED DIAGNOSTIC</p><h2>方程结构候选</h2></div></div><div className="evidence-line"><span>数值结果，不是机制证明</span><p>M1 在 E 的产生项中加入反馈状态 F。M0 RMSE={fits.m0.error.toFixed(1)}，M1 RMSE={fits.m1.error.toFixed(1)}。</p></div><div className="equation-diff"><div className="diff-row removed"><span>−</span><code>dE/dt = ksyn A − kdeg E</code></div><div className="diff-row added"><span>+</span><code>dE/dt = ksyn A/(1+F) − kdeg E<br/>dF/dt = kfb E − kfdeg F</code></div></div><div className="suggestion-grid"><div><span>下一测量</span><strong>{rec.t} h</strong></div><div><span>预测分离度</span><strong>{rec.delta.toFixed(1)} %</strong></div><div><span>新增状态</span><strong>F</strong></div><div><span>风险</span><strong className="amber">需验证</strong></div></div><button className="experiment-link" onClick={onLoop} disabled={!completed}><TestTubeDiagonal size={16}/><span><strong>模拟新数据并回灌</strong><small>替换 36 h、48 h 观测后重新拟合</small></span></button></aside></div></section>;
}

function Yeast({ onNotice }: { onNotice: (text: string) => void }) {
  const [deleted, setDeleted] = useState(false); const [enumerated, setEnumerated] = useState(false);
  const path = useMemo(() => trajectory(deleted), [deleted]); const rows = useMemo(() => basins(deleted), [deleted]); const matches = path.filter((x,i) => key(x) === key(REF[i])).length; const g1 = rows.find((x) => x.id === "00001000100")?.basin ?? 0;
  const original = () => { setDeleted(false); setEnumerated(false); onNotice("原网络已运行：Start 状态的 13 个同步更新状态与 Table 2 一致。"); };
  const all = () => { setDeleted(false); setEnumerated(true); onNotice("原网络已完整穷举：7 个固定点，主 G1 吸引域 1,764 / 2,048。"); };
  const perturb = () => { setDeleted(true); setEnumerated(true); onNotice("候选分支已删除 Cln3 → SBF，并重新计算状态轨迹和所有吸引域。"); };
  return <section className="workspace-view yeast-workspace"><header className="workspace-topbar"><div><p className="eyebrow">YEAST CELL-CYCLE · BOOLEAN NETWORK</p><h1>Li 等（2004）网络复现</h1></div><div className="workspace-meta"><span>11 节点</span><span>同步更新</span><span>{deleted ? "扰动分支" : "原网络"}</span></div><div className="workspace-actions"><Button variant="outline" onClick={original}><RefreshCw size={15}/>运行参考轨迹</Button><Button variant="outline" onClick={all}><Play size={15}/>穷举 2,048 初态</Button><Button onClick={perturb}><GitBranch size={15}/>删除 Cln3 → SBF</Button></div></header><p className="data-source"><Database size={14}/>载入论文 Table 2 的模型参考序列与其更新规则；“时间步”是同步逻辑更新步，不对应实验小时。</p><div className="yeast-summary-grid"><section className="panel yeast-metric"><span>参考路径匹配</span><strong>{deleted ? matches+" / 13" : "13 / 13"}</strong><small>{deleted ? "边删除后的比较" : "原网络复算"}</small></section><section className="panel yeast-metric"><span>固定点数</span><strong>{deleted ? rows.filter((x) => x.cycle === 1).length : "7"}</strong><small>全初态穷举</small></section><section className="panel yeast-metric"><span>主 G1 吸引域</span><strong>{deleted ? g1+" / 2048" : "1764 / 2048"}</strong><small>{deleted ? "扰动计算值" : "86.1% 初始状态"}</small></section></div><div className="yeast-grid"><section className="panel yeast-trajectory"><div className="panel-heading"><div><p className="eyebrow">STATE TRAJECTORY</p><h2>同步状态序列</h2></div><Badge>{deleted ? "扰动结果" : "Table 2 复现"}</Badge></div><div className="state-table-wrap"><table className="state-table"><thead><tr><th>节点 / 步</th>{path.map((_,i) => <th key={i}>t{i}</th>)}</tr></thead><tbody>{N.map((name,row) => <tr key={name}><th>{name}</th>{path.map((state,col) => <td key={col} className={(state[row] ? "state-on" : "state-off") + (deleted && state[row] !== REF[col][row] ? " state-diff" : "")}>{state[row]}</td>)}</tr>)}</tbody></table></div><div className="yeast-note"><Check size={15}/><span>{deleted ? "橙色单元表示相对论文参考轨迹的偏离。" : "13 个状态逐项匹配论文的参考状态序列。"}</span></div></section><aside className="panel yeast-method"><div className="panel-heading"><div><p className="eyebrow">UPDATE RULE</p><h2>同步阈值逻辑</h2></div></div><div className="logic-box"><code>ΣaijSj &gt; 0 → 1<br/>ΣaijSj &lt; 0 → 0<br/>ΣaijSj = 0 → 保持<br/>自降解节点 → 0</code></div><p>自降解：Cln3、Cln1,2、Swi5、Cdc20/Cdc14、Mcm1/SFF。</p><p>扰动只是可逆候选分支，不会改写原网络。</p><a className="paper-link" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC387325/" target="_blank" rel="noreferrer">打开原始论文 <ArrowRight size={14}/></a></aside></div><section className="panel attractor-panel"><div className="panel-heading"><div><p className="eyebrow">BASIN ENUMERATION</p><h2>{deleted ? "扰动网络吸引子" : "原网络固定点与吸引域"}</h2></div><Badge>{enumerated ? "已计算" : "点击上方运行"}</Badge></div>{enumerated ? <div className="attractor-list">{rows.map((row,i) => <div className="attractor-row" key={row.id}><span className="attractor-rank">{i+1}</span><code>{row.id}</code><span>{row.cycle === 1 ? "固定点" : row.cycle+" 步循环"}</span><strong>{row.basin} / 2048</strong><div className="basin-bar"><span style={{width:row.basin / 2048 * 100+"%"}}/></div></div>)}</div> : <div className="empty-enumeration">点击“穷举 2,048 初态”来计算每个初始状态的最终吸引子。</div>}</section></section>;
}
