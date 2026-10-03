# nonlinear-workstation 部署到个人 Cloudflare Workers

项目保留 React、Vinext、服务端 API 路由、Drizzle 和 D1。根目录的 `wrangler.jsonc` 是 Cloudflare 配置源，构建后的 Worker 配置位于 `dist/server/wrangler.json`。

## 1. 准备 Cloudflare 账户

本机安装 Node.js 22.13 或更高版本，然后在项目目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm wrangler login
pnpm wrangler whoami
```

`wrangler login` 会打开 Cloudflare 登录页。本机交互部署不需要创建或保存 API Token。

## 2. 创建并绑定 D1

创建生产数据库：

```powershell
pnpm run db:create
```

命令会返回数据库 ID。把该 ID写入 `wrangler.jsonc` 的 `d1_databases[0].database_id`，保留绑定名 `DB` 和数据库名 `nonlinear-workstation-db`。

应用已有迁移：

```powershell
pnpm run db:migrate:remote
```

本地开发数据库使用同一批迁移：

```powershell
pnpm run db:migrate:local
```

新增或修改 Drizzle schema 后，先执行 `pnpm run db:generate`，检查新生成的 `drizzle/*.sql`，再分别应用本地和生产迁移。

## 3. 配置服务端 AI 变量

应用只读取以下三个服务端变量：

| 名称 | 类型 | 用途 |
|---|---|---|
| `AI_BASE_URL` | 普通变量 | OpenAI 兼容服务根地址，例如 QuickRouter 的 `/v1` 地址 |
| `AI_MODEL` | 普通变量 | QuickRouter 支持结构化输出的完整模型 ID |
| `QUICKROUTER_API_KEY` | Secret | QuickRouter Bearer Token |

Cloudflare 后台入口：**Workers & Pages → nonlinear-workstation → Settings → Variables and Secrets**。添加 `AI_BASE_URL` 和 `AI_MODEL` 为普通变量，添加 `QUICKROUTER_API_KEY` 为加密 Secret，然后部署新版本。

也可以在本机设置 Secret，命令会安全地交互读取值：

```powershell
pnpm wrangler secret put QUICKROUTER_API_KEY
```

不要把 Secret 放入 `wrangler.jsonc`、`.env`、GitHub 仓库或构建日志。`.dev.vars.example` 只列出名称；本地使用时复制为 `.dev.vars`，该文件已被 Git 忽略。

## 4. 构建和首次部署

```powershell
pnpm run build
pnpm run deploy
```

`pnpm run deploy` 会重新构建并通过生成的 `dist/server/wrangler.json` 部署。部署完成后访问 Wrangler 输出的 `workers.dev` 地址。

## 5. 从 GitHub 自动部署

1. 将项目推送到 GitHub；不要提交 `.dev.vars`、任何 API Key 或 Cloudflare Token。
2. 打开 Cloudflare Dashboard，进入 **Workers & Pages → Create application → Import a repository**。
3. 授权 Cloudflare GitHub App，选择仓库和生产分支。
4. 构建命令填写 `pnpm run build`。
5. 部署命令填写 `pnpm wrangler deploy --config dist/server/wrangler.json`。
6. 根目录填写 `/`；如果仓库上层还包含其他项目，则填写 `nonlinear-workstation`。
7. 在项目 **Settings → Variables and Secrets** 中配置 `AI_BASE_URL`、`AI_MODEL` 和加密的 `QUICKROUTER_API_KEY`。
8. 确认 D1 绑定为 `DB`，目标数据库为 `nonlinear-workstation-db`。根配置已声明绑定，数据库 ID 必须是当前 Cloudflare 账户中的真实 ID。
9. 保存并触发首次部署。以后向生产分支推送会自动构建和部署。

Cloudflare Git 集成负责部署认证，因此仓库内不需要 `CLOUDFLARE_API_TOKEN`。D1 迁移不会因 Git 推送自动执行；发布含数据库变更的版本前，先运行 `pnpm run db:migrate:remote`。

## 迁移后的身份行为

OpenAI Sites 原先注入的 `oai-authenticated-user-*` 请求头在个人 Cloudflare Worker 中不存在。当前数据库代码会把没有该请求头的请求归到 `local-preview` 所有者，因此功能可以运行，但所有公开访问者共享同一数据空间。正式公开站点前，应另行接入 Cloudflare Access 或应用自己的登录系统，并把稳定用户 ID 传给数据库层。
