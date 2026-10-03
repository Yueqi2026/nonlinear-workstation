# nonlinear-workstation

非线性生物物理闭环科研工作站。项目运行在 Cloudflare Workers，使用 React、Vinext、服务端 API 路由、Drizzle 和 Cloudflare D1。

## 要求

- Node.js 22.13 或更高版本
- pnpm 11
- 个人 Cloudflare 账户

## 常用命令

```powershell
pnpm install --frozen-lockfile
pnpm run dev
pnpm run build
pnpm run start
pnpm run deploy
```

`pnpm run dev` 启动 Vinext 开发服务器。`pnpm run build` 生成 Worker 和浏览器资源。`pnpm run start` 使用 Wrangler 本地预览构建结果。`pnpm run deploy` 构建并部署到当前 Wrangler 登录的 Cloudflare 账户。

## Cloudflare 资源

- Worker 配置：`wrangler.jsonc`
- D1 绑定：`DB`
- D1 数据库名：`nonlinear-workstation-db`
- Drizzle schema：`db/schema.ts`
- SQL 迁移：`drizzle/`

创建数据库后，必须把 Cloudflare 返回的真实数据库 ID 写入 `wrangler.jsonc`，再应用远程迁移。

```powershell
pnpm run db:create
pnpm run db:migrate:remote
```

## 服务端 AI 配置

应用只读取：

- `AI_BASE_URL`
- `AI_MODEL`
- `QUICKROUTER_API_KEY`，必须保存为 Cloudflare Secret

这些变量只在 Worker 服务端使用。不得把 API Key 放入前端源码、`wrangler.jsonc`、Git 仓库或日志。

完整的首次部署、D1 迁移、Cloudflare 后台配置和 GitHub 自动部署步骤见 [CLOUDFLARE_DEPLOYMENT_CN.md](./CLOUDFLARE_DEPLOYMENT_CN.md)。
