import type { PortKind } from "../contracts/workflow";

export type ModuleDefinition = {
  id: string;
  version: string;
  label: string;
  description: string;
  inputs: PortKind[];
  outputs: PortKind[];
  execution: "deterministic" | "ai" | "manual";
  implemented: boolean;
};

export const moduleRegistry: ModuleDefinition[] = [
  { id: "question.define", version: "1.0.0", label: "问题定义", description: "确认现象、决策目标和约束。", inputs: [], outputs: ["question"], execution: "ai", implemented: true },
  { id: "data.import", version: "1.0.0", label: "数据导入", description: "读取 CSV/TSV 并生成数据质量报告。", inputs: ["question"], outputs: ["dataset"], execution: "manual", implemented: true },
  { id: "model.ode", version: "1.0.0", label: "最小 ODE 模型", description: "使用 CD8T 的确定性 ODE 候选。", inputs: ["question", "dataset"], outputs: ["model"], execution: "deterministic", implemented: true },
  { id: "observation.logistic", version: "1.0.0", label: "观测映射", description: "将隐状态映射为群体阳性率。", inputs: ["model"], outputs: ["trajectory"], execution: "deterministic", implemented: true },
  { id: "fit.multistart", version: "1.0.0", label: "多起点参数拟合", description: "固定随机种子搜索参数并输出 RMSE。", inputs: ["model", "trajectory", "dataset"], outputs: ["parameters", "diagnostic"], execution: "deterministic", implemented: true },
  { id: "diagnostic.compare", version: "1.0.0", label: "模型比较", description: "比较候选模型误差和预测分离度。", inputs: ["diagnostic"], outputs: ["experiment"], execution: "deterministic", implemented: true },
  { id: "experiment.manual", version: "1.0.0", label: "人工实验任务", description: "记录已确认的实验动作和新数据入口。", inputs: ["experiment"], outputs: ["dataset"], execution: "manual", implemented: true },
  { id: "custom.pending", version: "0.1.0", label: "自定义计算模块", description: "执行器尚未注册，不能运行。", inputs: ["dataset"], outputs: ["diagnostic"], execution: "manual", implemented: false },
];
export function getModuleDefinition(id: string) { return moduleRegistry.find((module) => module.id === id); }
export function canConnect(sourceType: string, targetType: string) {
  const source = getModuleDefinition(sourceType); const target = getModuleDefinition(targetType);
  return Boolean(source && target && source.outputs.some((port) => target.inputs.includes(port)));
}
