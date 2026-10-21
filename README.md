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

### 后端

```bash
cd server
npm install
cp .env.example .env   # 填入微信 AppSecret / GLM Key / SMTP 配置
npm run dev            # 默认 http://localhost:3300
```

### 小程序（uni-app）

```bash
cd miniprogram
npm install
npm run dev:mp-weixin  # 产物在 dist/dev/mp-weixin，用微信开发者工具打开
npm run dev:h5         # 浏览器快速预览（联调用）
```

## 开发前提

- 微信小程序 AppID（注册地址 mp.weixin.qq.com）+ 微信开发者工具
- 开发联调：开发者工具 → 详情 → 本地设置 → 勾选"不校验合法域名"
- 生产部署：HTTPS + ICP 备案域名，配置到小程序后台 request 合法域名
