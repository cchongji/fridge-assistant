# 冰箱剩余时间日历（Fridge Expiry Calendar）

拍照录入食品 → AI 识别保质期 → 确认入库 → 剩余时间日历 → 临期/过期微信订阅消息提醒。

## 目录结构

```
fridge-app/
├── server/        # Node.js + Express + SQLite 后端（识别/存储/推送）
├── miniprogram/   # uni-app 微信小程序端（Vue3 语法）
└── docs/          # 联调与部署文档
```

## 快速开始

### 一键启动（推荐）

根目录提供统一入口，一条命令同时拉起后端与 H5 前端：

```bash
# 环境变量统一放在项目根目录 .env（前后端共用）
cp server/.env.example .env   # 填入微信 AppSecret / GLM Key / SMTP 配置

npm install                   # 装根目录依赖（concurrently / cross-env）
npm run dev                   # 后端 :3300 + H5 :5180 同时启动（pnpm run dev 等价）
```

根目录脚本一览：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 并发启动后端 dev 与 H5 dev（任一退出即整体停止） |
| `npm run dev:server` | 只启动后端 `:3300` |
| `npm run dev:h5` | 只启动 H5 `:5180`（`/api` 代理到 3300） |
| `npm run dev:mp` | 小程序端编译（产物 `miniprogram/dist/dev/mp-weixin`） |
| `npm run build:h5` / `build:mp` | 构建 H5 / 小程序 |
| `npm run e2e` / `e2e:prod` | 跑 E2E（本地 / 线上 `E2E_ENV=production`） |

> **Node 版本要求**：`>= 22.22.3`（同时满足 `better-sqlite3` 的 ABI 与 e2e 的版本门槛，推荐 `nvm use 22.23.4`）。Node 24 下 `better-sqlite3@13` 需重新源码编译，缺 Python/MSVC 会启动失败。

> `.env` 位置：`fridge-app/.env`。后端由 `server/src/env.js` 加载，H5 由 vite 的 `envDir` 读取（仅暴露 `VITE_` 前缀变量），e2e 配置用 `process.loadEnvFile` 读取。

### 分端启动

```bash
cd server && npm install && npm run dev    # 后端默认 http://localhost:3300
cd miniprogram && npm install
npm run dev:mp-weixin  # 产物在 dist/dev/mp-weixin，用微信开发者工具打开
npm run dev:h5         # 浏览器快速预览（联调用）
```

## 开发前提

- 微信小程序 AppID（注册地址 mp.weixin.qq.com）+ 微信开发者工具
- 开发联调：开发者工具 → 详情 → 本地设置 → 勾选"不校验合法域名"
- 生产部署：HTTPS + ICP 备案域名，配置到小程序后台 request 合法域名
