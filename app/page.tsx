"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Beaker, BrainCircuit, Check, ChevronRight, Database, FileUp, GitBranch, Play, Plus, RefreshCw, Sparkles, TestTubeDiagonal, X } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CD8_QUESTION, CD8_SYSTEM, CD8_V1, CD8_V2, T, fitBoth, parseCsv, preview, recommended, type Fits } from "@/lib/science/cd8";
import { N, REF, YEAST_QUESTION, YEAST_SYSTEM, basins, referenceMatchCount, trajectory } from "@/lib/science/yeast";
import type { WorkflowGraph } from "@/lib/contracts/workflow";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";

type View = "intake" | "plan" | "flow" | "workspace";
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

const PROJECTS = [
  { id: "cd8", name: "CD8T 激活动力学", status: "进行中", abstract: "用 ODE、拟合和区分时间点解释群体阳性率先升后降。" },
  { id: "yeast", name: "酵母细胞周期", status: "可运行", abstract: "复现 Li 等（2004）同步布尔网络并计算固定点与吸引域。" },
];


export default function Home() {
  const [view, setView] = useState<View>("intake"); const [project, setProject] = useState("cd8"); const [q, setQ] = useState(""); const [system, setSystem] = useState("");
  const [ready, setReady] = useState(false); const [modules, setModules] = useState<string[]>(["数据导入与检查","最小 ODE 网络","群体阳性率映射","多起点参数拟合","竞争模型比较","关键时间点推荐","新数据回灌"]);
  const [data, setData] = useState(CD8_V1); const [source, setSource] = useState("内置模拟基准 v1"); const [fits, setFits] = useState<Fits>(() => preview(CD8_V1)); const [running, setRunning] = useState(false); const [completed, setCompleted] = useState(false); const [notice, setNotice] = useState("请先定义科学问题"); const file = useRef<HTMLInputElement>(null);
  const [runId, setRunId] = useState<string | null>(null);
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
  const choose = (id: string) => { setReady(false); if (id === "cd8") loadCd8(); else loadYeast(); };
  const beginWorkflowRun = async (graph: WorkflowGraph, workflowVersionId: string) => {
    const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", projectId: project, workflowVersionId, config: { source, nodeCount: graph.nodes.length } }) });
    if (!response.ok) { setNotice("流程已保存，但运行记录暂不可用。"); return; }
    const payload = await response.json() as { runId?: string };
    setRunId(payload.runId ?? null); setReady(true); setView("workspace"); setNotice("流程已确认并建立运行记录；请执行确定性计算。 ");
  };
  const runEvent = (action: Record<string, unknown>) => { if (runId) void fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) }); };
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
  const run = () => {
    setRunning(true); setCompleted(false); setNotice("RK4 数值积分与固定随机种子多起点拟合正在执行…");
    runEvent({ action: "event", runId, nodeId: "fit.multistart", message: "开始执行 RK4 和固定种子多起点搜索。" });
    window.setTimeout(() => {
      try {
        const next = fitBoth(data); setFits(next); setRunning(false); setCompleted(true);
        setNotice("完成：M1 RMSE " + next.m1.error.toFixed(1) + "，建议在 " + recommended(next).t + " h 加测。");
        runEvent({ action: "artifact", runId, artifact: { nodeId: "fit.multistart", kind: "fit_result", label: "CD8T M0/M1 拟合结果", provenance: "computed", content: { source, m0: next.m0, m1: next.m1, recommendation: recommended(next) } } });
        runEvent({ action: "finish", runId, status: "succeeded" });
      } catch (error) {
        setRunning(false); setNotice("确定性计算失败，请重试。"); runEvent({ action: "finish", runId, status: "failed", error: error instanceof Error ? error.message : "计算失败" });
      }
    }, 50);
  };
  const importData = (event: React.ChangeEvent<HTMLInputElement>) => { const f = event.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { const parsed = parseCsv(String(reader.result ?? ""), data); setData(parsed.data); setSource(f.name); setFits(preview(parsed.data)); setCompleted(false); setNotice(parsed.note); }; reader.readAsText(f); event.target.value = ""; };
  const chart = T.map((t, i) => ({ t, data: data[i], M0: +fits.m0.y[i].toFixed(2), M1: +fits.m1.y[i].toFixed(2) }));
  return <main className="app-shell"><aside className="project-sidebar"><div className="side-brand"><div className="brand-mark"><Activity size={19} /></div><div><span>NONLINEAR</span><strong>科研工作站</strong></div></div><Button className="new-project" onClick={() => { setView("intake"); setQ(""); setSystem(""); setReady(false); }}><Plus size={16} />新建研究课题</Button><div className="topic-heading">研究课题</div><nav className="topic-list">{PROJECTS.map((item) => <button className={"topic-item " + (project === item.id ? "active" : "")} onClick={() => choose(item.id)} key={item.id}><span className="topic-icon"><Beaker size={15} /></span><span className="topic-copy"><strong>{item.name}</strong><small>{item.status}</small></span><ChevronRight size={15} /><span className="topic-abstract"><em>ABSTRACT</em>{item.abstract}</span></button>)}</nav><div className="side-note"><Sparkles size={16} /><span>所有模型分支和流程建议均需人工审查。</span></div></aside>
    <section className="main-stage"><header className="stage-header"><div className="stage-path"><button className={view === "intake" ? "active" : "done"} onClick={() => setView("intake")}><span>1</span>定义问题</button><ChevronRight size={14}/><button disabled={!ready} className={view === "plan" || view === "flow" ? "active" : view === "workspace" ? "done" : ""} onClick={() => setView("plan")}><span>2</span>确认流程</button><ChevronRight size={14}/><button disabled={!ready} className={view === "workspace" ? "active" : ""} onClick={() => setView("workspace")}><span>3</span>运行工作站</button></div><div className="header-status">{notice}</div></header>
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
          <div className="plan-footer"><Button variant="outline" onClick={() => setView("intake")}>修改问题</Button><div className="plan-footer-actions"><Button variant="outline" onClick={() => setView("flow")}><GitBranch size={16}/>编辑图形流程</Button><Button onClick={() => setView("flow")}>确认流程并进入画布<ArrowRight size={16}/></Button></div></div>
        </section>
      )}
      {view === "flow" && <WorkflowCanvas labels={modules} projectId={project} onConfirm={beginWorkflowRun} />}
      {view === "workspace" && (yeast ? <Yeast onNotice={setNotice}/> : <Cd8 chart={chart} fits={fits} rec={rec} source={source} running={running} completed={completed} file={file} onRun={run} onImport={importData} onLoop={() => { setData(CD8_V2); setSource("模拟补充观测 v2"); setFits(preview(CD8_V2)); setCompleted(false); setNotice("已回灌 36 h 与 48 h 的模拟补充观测；请重新拟合。"); }} />)}
    </section></main>;
}

function Cd8({ chart, fits, rec, source, running, completed, file, onRun, onImport, onLoop }: { chart: { t: number; data: number; M0: number; M1: number }[]; fits: Fits; rec: { t: number; delta: number }; source: string; running: boolean; completed: boolean; file: React.RefObject<HTMLInputElement | null>; onRun: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onLoop: () => void }) {
  return <section className="workspace-view"><header className="workspace-topbar"><div><p className="eyebrow">CD8T DYNAMICS · SIMULATED BENCHMARK</p><h1>真实数值积分与拟合</h1></div><div className="workspace-meta"><span>RK4 步长 0.15 h</span><span>M0 {fits.m0.starts || "预览"}</span><span>M1 {fits.m1.starts || "预览"}</span></div><div className="workspace-actions"><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={onImport}/><Button variant="outline" onClick={() => file.current?.click()}><FileUp size={15}/>导入 CSV</Button><Button onClick={onRun} disabled={running}>{running ? <RefreshCw className="spin" size={15}/> : <Play size={15}/>}{running ? "拟合中" : "运行闭环"}</Button></div></header><p className="data-source"><Database size={14}/>数据源：{source}。曲线为实际 ODE 数值积分；拟合为固定随机种子的多起点最小二乘搜索。</p><div className="cd8-grid"><section className="panel results-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h2>群体阳性率动力学</h2></div><div className="metric-pills"><span>M0 RMSE <strong>{fits.m0.error.toFixed(1)}</strong></span><span>M1 RMSE <strong>{fits.m1.error.toFixed(1)}</strong></span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={340}><LineChart data={chart}><CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="t" label={{value:"时间 / h",position:"insideBottomRight",offset:-3}}/><YAxis domain={[0,100]} label={{value:"阳性率 / %",angle:-90,position:"insideLeft"}}/><Tooltip/><Legend/><ReferenceLine x={rec.t} stroke="#d97706" strokeDasharray="4 4" label={"建议 "+rec.t+" h"}/><Line type="monotone" dataKey="data" name="观测数据" stroke="#172b4d" strokeWidth={0} dot={{r:4}}/><Line type="monotone" dataKey="M0" name="M0 持续表达" stroke="#64748b" dot={false}/><Line type="monotone" dataKey="M1" name="M1 晚期负反馈" stroke="#00a6a6" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div></section><aside className="panel ai-panel"><div className="ai-heading"><div className="ai-icon"><BrainCircuit size={19}/></div><div><p className="eyebrow">RULED DIAGNOSTIC</p><h2>方程结构候选</h2></div></div><div className="evidence-line"><span>数值结果，不是机制证明</span><p>M1 在 E 的产生项中加入反馈状态 F。M0 RMSE={fits.m0.error.toFixed(1)}，M1 RMSE={fits.m1.error.toFixed(1)}。</p></div><div className="equation-diff"><div className="diff-row removed"><span>−</span><code>dE/dt = ksyn A − kdeg E</code></div><div className="diff-row added"><span>+</span><code>dE/dt = ksyn A/(1+F) − kdeg E<br/>dF/dt = kfb E − kfdeg F</code></div></div><div className="suggestion-grid"><div><span>下一测量</span><strong>{rec.t} h</strong></div><div><span>预测分离度</span><strong>{rec.delta.toFixed(1)} %</strong></div><div><span>新增状态</span><strong>F</strong></div><div><span>风险</span><strong className="amber">需验证</strong></div></div><button className="experiment-link" onClick={onLoop} disabled={!completed}><TestTubeDiagonal size={16}/><span><strong>模拟新数据并回灌</strong><small>替换 36 h、48 h 观测后重新拟合</small></span></button></aside></div></section>;
}

function Yeast({ onNotice }: { onNotice: (text: string) => void }) {
  const [deleted, setDeleted] = useState(false);
  const [enumerated, setEnumerated] = useState(false);
  const path = useMemo(() => trajectory(deleted), [deleted]);
  const rows = useMemo(() => basins(deleted), [deleted]);
  const matches = useMemo(() => referenceMatchCount(deleted), [deleted]);
  const fixedPoints = rows.filter((row) => row.cycle === 1).length;
  const g1 = rows.find((row) => row.id === "00001000100")?.basin ?? 0;
  const runOriginal = () => { setDeleted(false); setEnumerated(false); onNotice(`原网络已运行：计算路径与论文 Table 2 逐步比较，匹配 ${matches} / 13。`); };
  const enumerate = () => { setDeleted(false); setEnumerated(true); onNotice(`原网络已完整穷举：${fixedPoints} 个固定点，主 G1 吸引域 ${g1} / 2,048。`); };
  const perturb = () => { setDeleted(true); setEnumerated(true); onNotice("候选分支已删除 Cln3 → SBF，并重新计算状态轨迹和所有吸引域。"); };
  return <section className="workspace-view yeast-workspace"><header className="workspace-topbar"><div><p className="eyebrow">YEAST CELL-CYCLE · BOOLEAN NETWORK</p><h1>Li 等（2004）网络复现</h1></div><div className="workspace-meta"><span>11 节点</span><span>同步更新</span><span>{deleted ? "扰动分支" : "原网络"}</span></div><div className="workspace-actions"><Button variant="outline" onClick={runOriginal}><RefreshCw size={15}/>运行参考轨迹</Button><Button variant="outline" onClick={enumerate}><Play size={15}/>穷举 2,048 初态</Button><Button onClick={perturb}><GitBranch size={15}/>删除 Cln3 → SBF</Button></div></header><p className="data-source"><Database size={14}/>载入论文 Table 2 的模型参考序列与其更新规则；“时间步”是同步逻辑更新步，不对应实验小时。</p><div className="yeast-summary-grid"><section className="panel yeast-metric"><span>参考路径匹配</span><strong>{matches} / 13</strong><small>{deleted ? "边删除后的比较" : "原网络与参考序列比较"}</small></section><section className="panel yeast-metric"><span>固定点数</span><strong>{fixedPoints}</strong><small>全初态穷举</small></section><section className="panel yeast-metric"><span>主 G1 吸引域</span><strong>{g1} / 2048</strong><small>计算值 · {((g1 / 2048) * 100).toFixed(1)}% 初始状态</small></section></div><div className="yeast-grid"><section className="panel yeast-trajectory"><div className="panel-heading"><div><p className="eyebrow">STATE TRAJECTORY</p><h2>同步状态序列</h2></div><Badge>{deleted ? "扰动结果" : "Table 2 比较"}</Badge></div><div className="state-table-wrap"><table className="state-table"><thead><tr><th>节点 / 步</th>{path.map((_, index) => <th key={index}>t{index}</th>)}</tr></thead><tbody>{N.map((name, row) => <tr key={name}><th>{name}</th>{path.map((state, col) => <td key={col} className={(state[row] ? "state-on" : "state-off") + (state[row] !== REF[col][row] ? " state-diff" : "")}>{state[row]}</td>)}</tr>)}</tbody></table></div><div className="yeast-note"><Check size={15}/><span>{deleted ? "橙色单元表示相对论文参考轨迹的偏离。" : `橙色单元表示计算路径与论文参考序列的差异；当前逐步匹配 ${matches} / 13。`}</span></div></section><aside className="panel yeast-method"><div className="panel-heading"><div><p className="eyebrow">UPDATE RULE</p><h2>同步阈值逻辑</h2></div></div><div className="logic-box"><code>ΣaijSj &gt; 0 → 1<br/>ΣaijSj &lt; 0 → 0<br/>ΣaijSj = 0 → 保持<br/>自降解节点 → 0</code></div><p>自降解：Cln3、Cln1,2、Swi5、Cdc20/Cdc14、Mcm1/SFF。</p><p>扰动只是可逆候选分支，不会改写原网络。</p><a className="paper-link" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC387325/" target="_blank" rel="noreferrer">打开原始论文 <ArrowRight size={14}/></a></aside></div><section className="panel attractor-panel"><div className="panel-heading"><div><p className="eyebrow">BASIN ENUMERATION</p><h2>{deleted ? "扰动网络吸引子" : "原网络固定点与吸引域"}</h2></div><Badge>{enumerated ? "已计算" : "点击上方运行"}</Badge></div>{enumerated ? <div className="attractor-list">{rows.map((row, index) => <div className="attractor-row" key={row.id}><span className="attractor-rank">{index + 1}</span><code>{row.id}</code><span>{row.cycle === 1 ? "固定点" : row.cycle + " 步循环"}</span><strong>{row.basin} / 2048</strong><div className="basin-bar"><span style={{ width: row.basin / 2048 * 100 + "%" }}/></div></div>)}</div> : <div className="empty-enumeration">点击“穷举 2,048 初态”来计算每个初始状态的最终吸引子。</div>}</section></section>;
}
