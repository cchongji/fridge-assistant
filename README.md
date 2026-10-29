# 冰箱剩余时间日历（Fridge Expiry Calendar）

拍照录入食品 → AI 识别保质期 → 确认入库 → 剩余时间日历 → 临期/过期邮件提醒。

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | Vite 5 + Vue 3 + TypeScript + Element Plus + Vue Router + Pinia + Axios |
| 后端 | Node.js + Express + better-sqlite3（SQLite） |
| 部署 | Docker Compose（Caddy 托管前端静态资源 + 反向代理 `/api`） |

## 目录结构

```
fridge-app/
├── server/        # Express + SQLite 后端（识别/存储/提醒）
├── frontend/      # Vite + Vue3 + Element Plus 前端（响应式，桌面/移动同一套）
├── docs/          # 联调与部署文档
├── Caddyfile      # Caddy 站点配置（静态 + /api 反代）
├── Dockerfile.web # 前端多阶段构建 → Caddy
└── docker-compose.yml
```

## 快速开始

```bash
# 环境变量统一放在项目根目录 .env（前后端共用）
cp server/.env.example .env   # 填入 CODEBUDDY_API_KEY / SMTP 等配置

npm install                   # 根目录依赖（concurrently / cross-env）
npm run dev                   # 后端 :3300 + 前端 :5181 同时启动（pnpm run dev 等价）
```

访问 <http://localhost:5181>，默认跳转 `#/login`。

根目录脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 并发启动后端 + 前端（任一退出即整体停止） |
| `npm run dev:server` | 只启动后端 `:3300` |
| `npm run dev:web` | 只启动前端 `:5181`（`/api` 代理到 3300） |
| `npm run build:web` | 前端生产构建（含 `vue-tsc` 类型检查） |
| `npm run typecheck` | 仅类型检查 |
| `npm run e2e` / `e2e:prod` | E2E（本地 `:5181` / 线上 `E2E_ENV=production`） |

> **Node 版本要求**：`>= 22.22.3`（同时满足 `better-sqlite3` 的 ABI 与 e2e 的版本门槛，推荐 `nvm use 22.23.4`）。

> `.env` 位置：`fridge-app/.env`。后端由 `server/src/env.js` 加载，前端由 vite 的 `envDir` 读取（仅暴露 `VITE_` 前缀变量），e2e 配置用 `process.loadEnvFile` 读取。

## 前端结构

```
frontend/src/
├── api/          # axios 封装 + 各业务接口（auth/foods/misc/recognize）
├── components/   # FoodCard / FoodSuggest
├── layouts/      # MainLayout（顶栏导航 + 移动端底部 TabBar）
├── router/       # 6 条路由 + 登录守卫
├── stores/       # user（token/登录态）
├── utils/        # date（剩余天数/新鲜度）、storage（localStorage）
└── views/        # Login / Home / Calendar / Add / Detail / Stats
```

## 部署

```bash
# 本地打包并上传（排除 .env / node_modules / dist）
tar -czf deploy.tgz --exclude=node_modules --exclude=dist --exclude=.git \
  --exclude=.env --exclude=server/data --exclude=server/uploads .
scp deploy.tgz root@<host>:/opt/fridge-app/

# 服务器上
cd /opt/fridge-app && tar -xzf deploy.tgz && docker compose up -d --build
```

详见 `docs/deploy.md`。
