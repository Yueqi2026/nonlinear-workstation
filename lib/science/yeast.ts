export const YEAST_QUESTION = "复现 Li 等（2004）酿酒酵母细胞周期 11 节点布尔网络的状态路径、固定点和主 G1 吸引域；删除一条调控边并比较鲁棒性。";
export const YEAST_SYSTEM = "出芽酵母细胞周期；11 节点同步布尔网络；输入为 Start 状态，读出为状态转移和吸引域。参考数据为论文 Table 2 的模型状态序列，不是实验时间序列。";
export const N = ["Cln3", "MBF", "SBF", "Cln1,2", "Cdh1", "Swi5", "Cdc20/Cdc14", "Clb5,6", "Sic1", "Clb1,2", "Mcm1/SFF"];
export type Edge = [number, number, number];
export const TD = new Set([0, 3, 5, 6, 10]);
export const E: Edge[] = [[0,1,1],[0,2,1],[2,3,1],[1,7,1],[7,9,1],[7,10,1],[9,10,1],[9,6,1],[10,9,1],[10,6,1],[10,5,1],[6,4,1],[6,5,1],[6,8,1],[5,8,1],[3,8,-1],[3,4,-1],[7,8,-1],[7,4,-1],[9,2,-1],[9,1,-1],[9,8,-1],[9,4,-1],[9,5,-1],[6,7,-1],[6,9,-1],[4,9,-1],[8,9,-1],[8,7,-1]];
export const REF = [[1,0,0,0,1,0,0,0,1,0,0],[0,1,1,0,1,0,0,0,1,0,0],[0,1,1,1,1,0,0,0,1,0,0],[0,1,1,1,0,0,0,0,0,0,0],[0,1,1,1,0,0,0,1,0,0,0],[0,1,1,1,0,0,0,1,0,1,1],[0,0,0,1,0,0,1,1,0,1,1],[0,0,0,0,0,1,1,0,0,1,1],[0,0,0,0,0,1,1,0,1,1,1],[0,0,0,0,0,1,1,0,1,0,1],[0,0,0,0,0,1,1,0,1,0,0],[0,0,0,0,1,1,1,0,1,0,0],[0,0,0,0,1,0,0,0,1,0,0]];
const key = (x: number[]) => x.join("");
export function step(x: number[], deleted = false) { return x.map((own, target) => { let sum = 0; E.forEach(([from, to, w]) => { if (to === target && !(deleted && from === 0 && to === 2)) sum += w * x[from]; }); return sum > 0 ? 1 : sum < 0 ? 0 : TD.has(target) ? 0 : own; }); }
export function trajectory(deleted = false) { const out = [REF[0]]; while (out.length < REF.length) out.push(step(out[out.length - 1], deleted)); return out; }
export function referenceMatchCount(deleted = false) { const path = trajectory(deleted); return path.filter((state, index) => key(state) === key(REF[index])).length; }
export function basins(deleted = false) {
  const map = new Map<string, { state: number[]; basin: number; cycle: number }>();
  for (let seed = 0; seed < 2048; seed += 1) {
    let x = N.map((_, i) => (seed >> (10 - i)) & 1); const history: number[][] = []; const seen = new Map<string, number>();
    for (let j = 0; j < 40; j += 1) { const k = key(x); const hit = seen.get(k); if (hit !== undefined) { const cycle = history.slice(hit); const id = cycle.map(key).sort()[0]; const old = map.get(id); map.set(id, { state: cycle[0], basin: (old?.basin ?? 0) + 1, cycle: cycle.length }); break; } seen.set(k, history.length); history.push(x); x = step(x, deleted); }
  }
  return Array.from(map.entries()).map(([id, value]) => ({ id, ...value })).sort((a, b) => b.basin - a.basin);
}
