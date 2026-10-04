export type Model = "M0" | "M1";
export type Params = { ko: number; kc: number; ks: number; kd: number; th: number; sg: number; kf: number; fd: number };
export type Fit = { p: Params; y: number[]; error: number; starts: number };
export type Fits = { m0: Fit; m1: Fit };

export const T = [0, 4, 8, 12, 16, 24, 36, 48];
export const CD8_V1 = [3, 9, 27, 54, 71, 63, 39, 24];
export const CD8_V2 = [3, 9, 27, 54, 71, 63, 36, 20];
export const CD8_QUESTION = "在体外激活的人源 CD8+ T 细胞中，效应分子阳性率为什么在 16 小时达到峰值后逐步下降？构建最小 ODE 模型，比较持续表达与晚期负反馈机制，并推荐区分两者的测量时间点。";
export const CD8_SYSTEM = "人源 CD8+ T 细胞；体外 TCR/CD28 刺激；读出为效应蛋白阳性率（%）；时间点 0、4、8、12、16、24、36、48 h。当前内置数据为明确标注的模拟基准。";

const P0: Params = { ko: .22, kc: .38, ks: .95, kd: .10, th: 1.20, sg: .22, kf: .036, fd: .025 };
const P1: Params = { ko: .18, kc: .53, ks: .77, kd: .12, th: 1.07, sg: .19, kf: .036, fd: .025 };
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-clip(x, -35, 35)));
const rmse = (data: number[], y: number[]) => Math.sqrt(data.reduce((sum, x, i) => sum + (x - y[i]) ** 2, 0) / data.length);

function derivative(x: number[], p: Params, model: Model) {
  const inhibition = model === "M1" ? 1 / (1 + x[2]) : 1;
  return [p.ko * (1 - x[0]) - p.kc * x[0], p.ks * x[0] * inhibition - p.kd * x[1], model === "M1" ? p.kf * x[1] - p.fd * x[2] : 0];
}

export function integrate(p: Params, model: Model, grid = T) {
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

const evaluate = (p: Params, model: Model, data: number[], starts = 0): Fit => { const y = integrate(p, model); return { p, y, error: rmse(data, y), starts }; };
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

export const preview = (data: number[]): Fits => ({ m0: evaluate(P0, "M0", data), m1: evaluate(P1, "M1", data) });
export const fitBoth = (data: number[]): Fits => ({ m0: fit("M0", data), m1: fit("M1", data) });
export function recommended(fits: Fits) {
  const candidates = [18, 20, 22, 28, 30, 32, 40, 42, 44, 46];
  const a = integrate(fits.m0.p, "M0", candidates); const b = integrate(fits.m1.p, "M1", candidates);
  return candidates.reduce((best, t, i) => Math.abs(a[i] - b[i]) > best.delta ? { t, delta: Math.abs(a[i] - b[i]) } : best, { t: candidates[0], delta: Math.abs(a[0] - b[0]) });
}

export function parseCsv(raw: string, fallback: number[]) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(line.includes("\t") ? "\t" : ",").map((x) => x.trim()));
  const head = lines[0]?.map((x) => x.toLowerCase()) ?? [];
  const ti = head.findIndex((x) => /time|hour|时间/.test(x)); const vi = head.findIndex((x) => /value|positive|percent|阳性|比例|%/.test(x));
  const start = ti >= 0 || vi >= 0 ? 1 : 0;
  const points = lines.slice(start).map((row) => ({ t: Number(row[ti >= 0 ? ti : 0]), y: Number(row[vi >= 0 ? vi : 1]) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.y));
  if (!points.length) return { data: fallback, note: "未识别到时间与读出数值列，已保留当前数据。" };
  const fraction = points.every((x) => x.y >= 0 && x.y <= 1.001);
  return { data: T.map((t) => { const near = points.reduce((a, b) => Math.abs(a.t - t) < Math.abs(b.t - t) ? a : b); return clip((fraction ? near.y * 100 : near.y), 0, 100); }), note: "读取 " + points.length + " 行；" + (fraction ? "0–1 比例已换算为百分比。" : "使用原百分比。") + "每个展示时间点采用最近观测。" };
}
