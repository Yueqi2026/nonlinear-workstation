# P0 基线审计

审计日期：2026-10-04  
代码源：`C:\Users\12828\Documents\GitHub\nonlinear-workstation`  
生产 Worker：`nonlinear-workstation`  
审计范围：当前 Git `main`（删除反应扩散案例后的版本）及本地构建路径。

## 调用链

1. `app/page.tsx` 收集科学问题、体系、知识条目和 CSV；浏览器调用 `/api/runtime`、`/api/knowledge`、`/api/analyze`。
2. `app/api/analyze/route.ts` 从 Cloudflare Worker `env` 读取 `AI_BASE_URL`、`QUICKROUTER_API_KEY`、`AI_MODEL`，检索 D1 知识条目，然后调用 `lib/quickrouter.ts`。
3. `lib/quickrouter.ts` 请求 `${AI_BASE_URL}/chat/completions`，发送 `response_format.json_schema`，解析 `choices[0].message.content`，再做严格字段校验。
4. `/api/analyze` 将结构化提案写入现有 `analysis_runs`；`/api/knowledge` 读写 `knowledge_documents`。
5. CD8T 的 RK4、固定随机种子多起点搜索、RMSE 和推荐时间点，以及酵母网络轨迹/吸引域计算，原先都内嵌在 `app/page.tsx`；本轮已抽离到 `lib/science/cd8.ts` 和 `lib/science/yeast.ts`。

## 能力分类

| 能力 | 当前来源 | 结论 |
|---|---|---|
| CD8T ODE 轨迹 | RK4 确定性积分 | 真实计算，固定步长 0.15 h |
| CD8T 多起点拟合 | 页面触发的固定种子参数搜索 | 真实计算；当前仍为同步短任务 |
| CD8T 图表 | 拟合/积分数组 | 计算结果，不是 AI 生成 |
| 酵母轨迹与吸引域 | 11 节点同步布尔更新、2048 初态 | 真实计算；论文 Table 2 仅作模型参考 |
| AI 流程建议 | QuickRouter Chat Completions | 真实外部请求；响应严格 JSON schema 校验 |
| 知识库 | Cloudflare D1 | 真实持久化，但目前只有元数据/文本/关键词检索 |
| 运行追踪 | 本轮新增 workflow/run/event 表和 `/api/runs` | 已有增量接口；前端画布确认后创建运行记录 |
| 反应扩散 | 已删除入口 | 当前明确未实现 |
| 文献解析/语义检索 | 未实现 | 不得宣称已支持 |
| 任意自定义代码执行 | 未实现且禁止 | 注册表标记待实现，不能伪执行 |

## 配置与部署

- `wrangler.jsonc` 保留 D1 `DB` 绑定，并声明非敏感 `AI_BASE_URL`、`AI_MODEL`。
- `QUICKROUTER_API_KEY` 只应作为 Cloudflare Production Secret；代码和测试均不输出密钥。
- Cloudflare Git 构建使用 `pnpm run build`，部署使用生成的 `dist/server/wrangler.json`。
- D1 迁移目录为 `drizzle/`，已有 `0000_public_big_bertha.sql`，本轮新增 `0001_workflow_runtime.sql`。

## 关键差距

- 旧页面是三步列表流程，确认页以前没有可编辑图形依赖图。
- 旧计算没有 Project/Dataset/Model/Workflow/Run 的持久化版本引用。
- 没有取消、异步任务、权限隔离或大文件 artifact 存储；当前 Worker 仍适合短任务和元数据。
- Sites 注入的身份头在个人 Worker 中不存在；无身份时数据库回退 `local-preview`，公开站点不能据此宣称用户隔离。
- 当前 QuickRouter 只承担流程提案，不应被描述为执行器或数值优化器。
