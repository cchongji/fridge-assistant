# 联调与部署指南

> 架构：`frontend/`（Vite + Vue3 + Element Plus，构建为静态资源） + `server/`（Express + SQLite），
> 线上由 Caddy 托管静态资源并反向代理 `/api` → 后端 3300。

## 一、本地联调

```bash
# 1. 环境变量（项目根目录，前后端共用）
cp server/.env.example .env
vim .env                 # JWT_SECRET / CODEBUDDY_API_KEY / SMTP 等

# 2. 依赖
npm install              # 根目录（concurrently）
npm --prefix server install
npm --prefix frontend install

# 3. 一键启动
npm run dev              # 后端 :3300 + 前端 :5181
```

| 服务 | 地址 | 单独启动 |
| --- | --- | --- |
| 后端 API | http://localhost:3300 | `npm run dev:server` |
| 前端 | http://localhost:5181 | `npm run dev:web` |

前端 vite 已配置 `/api` → `http://localhost:3300` 代理，无需处理跨域。

已验证链路：登录 → 拍照识别/模板/手动录入 → 入库 → 首页倒计时 → 日历标记 → 详情编辑 → 统计与提醒设置。

## 二、环境变量（根目录 `.env`）

| 变量 | 说明 |
| --- | --- |
| `PORT` | 后端端口，默认 3300 |
| `JWT_SECRET` | 登录令牌密钥，生产必须替换 |
| `CODEBUDDY_API_KEY` | CodeBuddy 网关 Key（AI 建议 / 拍照识别 / e2e Agent） |
| `CODEBUDDY_BASE_URL` | 网关地址，默认 `https://www.codebuddy.cn/v2` |
| `CODEBUDDY_MODEL` / `CODEBUDDY_VISION_MODEL` | 文本建议 / 图片识别模型，默认 `glm-5.3-flash` |
| `SMTP_HOST/PORT/USER/PASS` | 全局发件配置（邮件提醒统一使用该账号发信） |

> 后端由 `server/src/env.js` 加载根目录 `.env`；前端 Vite 通过 `envDir` 读取（仅暴露 `VITE_` 前缀）；e2e 用 `process.loadEnvFile` 读取。

> AI 建议与拍照识别由后端直连 CodeBuddy 网关（OpenAI 兼容 `/chat/completions`，网关仅支持流式，服务端统一做 SSE 聚合），无需安装 codebuddy CLI。

## 三、构建

```bash
npm run build:web        # 产物 frontend/dist（含 vue-tsc 类型检查）
npm run typecheck        # 仅类型检查
```

## 四、服务器部署（Docker Compose）

```bash
# 1. 首次准备
ssh root@<host>
mkdir -p /opt/fridge-app && cd /opt/fridge-app

# 2. 配置（放根目录，供 server 容器注入环境变量）
cp server/.env.example .env
vim .env

# 3. 启动
docker compose up -d --build

# 4. 验证
curl -k https://<host>:18000/api/health
```

`docker-compose.yml` 要点：

- `server`：Node 镜像，`env_file: ./.env`，数据卷挂载 `server/data`（SQLite）与 `server/uploads`
- `web`：`Dockerfile.web` 多阶段构建 `frontend/`，产物交给 Caddy
- `Caddyfile`：静态资源 + `/api/*` 反代 `server:3300`

## 五、日常更新发布

```bash
# 本地打包（排除敏感与体积目录）
tar -czf deploy.tgz --exclude=node_modules --exclude=dist --exclude=.git \
  --exclude=.env --exclude=server/data --exclude=server/uploads --exclude=.e2e .

scp deploy.tgz root@<host>:/opt/fridge-app/
ssh root@<host> "cd /opt/fridge-app && tar -xzf deploy.tgz && docker compose up -d --build"
```

> 只改了前端时可 `docker compose up -d --build web`，避免重建 server 镜像。

## 六、E2E

```bash
npm run dev              # 先起服务
npm run e2e              # 本地（frontend:5181）
npm run e2e:prod         # 线上（115.159.95.183:18000）
```

- 用例位于 `frontend/tests/`，配置 `frontend/e2e.config.ts`
- Agent 用例依赖 `CODEBUDDY_API_KEY`；模型网关仅支持流式，配置里已做 SSE 聚合适配
- 线上为自签证书，若浏览器拒绝，可把 Caddy 根证书导入本机信任库：`certutil -addstore -f Root caddy-root.crt`

## 七、邮件提醒

1. 用户注册时必须绑定邮箱（提醒邮件收件地址，可在「统计与设置」页修改）
2. 在服务端 `.env` 配置全局 SMTP（`SMTP_HOST/PORT/USER/PASS`），用户无需填写授权码
3. 后端 `node-cron` 每小时扫描：提前 3 天 / 1 天 / 当天 / 过期后持续提醒，按 `push_log` 去重
4. 「统计与设置」页可发测试邮件、手动触发一次扫描排查

## 八、上线检查清单

- [ ] `.env` 中 `JWT_SECRET` 已替换为强随机值
- [ ] `CODEBUDDY_API_KEY` 有效（发一次 AI 建议验证）
- [ ] SMTP 配置可用（发测试邮件成功）
- [ ] `docker compose ps` 两容器均为 Up
- [ ] `https://<host>:18000/api/health` 返回 `{"status":"ok"}`
- [ ] 前端强刷后登录、录入、日历、统计全链路正常
- [ ] 备份 `server/data/*.db` 与 `server/uploads`
