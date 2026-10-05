# V2 实施进度

更新时间：2026-10-04

## P0 审计和基线

- [x] 审计 AI、科学计算、D1、迁移和 Cloudflare 配置。
- [x] 记录输入到结果的实际调用链与来源边界。
- [x] 区分真实计算、AI 提案、演示数据和未实现能力。
- [x] 输出 `BASELINE_AUDIT_CN.md`。
- [x] 运行 QuickRouter 适配器测试和生产构建基线。

## P1 模块化与运行追踪

- [x] 抽离 `lib/science/cd8.ts` 和 `lib/science/yeast.ts` 纯计算模块。
- [x] 新增 `lib/contracts/workflow.ts` 工作流、artifact、provenance 和 run 状态契约。
- [x] 新增 `lib/modules/registry.ts` 模块注册表和端口连接校验。
- [x] 新增 D1 增量迁移 `drizzle/0001_workflow_runtime.sql`。
- [x] 新增 `/api/runs`，支持保存流程、创建运行、写入事件和结束运行。
- [ ] 把运行输入输出 artifact 全部写入 D1/R2；当前先记录流程版本和节点事件。
- [ ] 完成取消、超时、刷新恢复和项目访问控制。

## P2 图形化流程

- [x] 新增 `components/workflow/WorkflowCanvas.tsx`。
- [x] 支持添加注册模块、拖动节点、删除节点、选择节点和查看端口/来源。
- [x] 支持端口兼容校验的双击连线，拒绝不兼容连接。
- [x] AI 提案可作为带 `ai_suggestion` 来源标记的可编辑草稿。
- [x] 保存草稿、确认流程并创建运行记录。
- [ ] 增加撤销/重做、键盘移动、自动布局和运行日志折叠面板。
- [ ] 让右侧配置真正驱动 CD8T/酵母执行参数，而不是只展示契约。

## 验证记录

- `tests/quickrouter.test.mjs`：5/5 通过，覆盖结构化输出、401、模型不可用、非 JSON 和 schema 错误。
- QuickRouter 响应解析已兼容 OpenAI 兼容接口常见的文本分片和 ```json 围栏；schema 仍保持严格字段约束，新增测试后为 6/6。
- `tests/science.test.mjs`：5/5 通过；CD8T 确定性拟合、CSV 解析、酵母 2,048 初态穷举和参考序列比较均有测试。
- `tsc --noEmit`：通过（直接调用 `node_modules/.bin/tsc.cmd`）。
- `pnpm run build`：通过；Vinext 输出 5 个构建阶段和 `/api/analyze`、`/api/knowledge`、`/api/runs`、`/api/runtime` 路由。
- `pnpm run lint`：0 errors，12 个既有/本轮未使用符号 warning，待清理旧组件后再收敛。
- D1 生产迁移：代码已准备，必须在发布前执行 `pnpm run db:migrate:remote`。

## 当前限制

这一阶段不宣称已完成文献解析、语义检索、异步长任务、权限隔离、自动实验设备控制或任意自定义代码执行。未注册执行器会被标记为待实现并阻止伪执行。

## 本轮真实性核对

- 酵母同步更新器与页面内嵌的论文 Table 2 参考序列实际匹配 11 / 13 个状态步；t10、t11 存在差异。页面已改为显示计算匹配数，并用橙色标出差异，不能再显示固定的“13 / 13”。
- 原网络吸引域由同一执行器重新穷举：7 个固定点，主 G1 吸引域 1,764 / 2,048；这些数值不再写死在 UI。
- P1 运行 API 已校验流程版本、节点类型、端口、DAG 和确认状态；已增加 `run_artifacts` D1 表并保存 CD8T 拟合 artifact，超大内容仍需 R2 适配器。
