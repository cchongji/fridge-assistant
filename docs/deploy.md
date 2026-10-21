# 冰箱剩余时间日历 — 联调与部署指引

## 方式一：Docker 部署（Debian 13 服务器，推荐）

仓库已含 `docker-compose.yml`、`Dockerfile.web`（容器内自动构建 H5）、`server/Dockerfile`、`Caddyfile`。

```bash
# 1. 上传整个项目到服务器（如 /opt/fridge-app），排除本地依赖目录
#    rsync -av --exclude node_modules --exclude dist --exclude server/data ./ user@服务器:/opt/fridge-app/

# 2. 服务器上准备配置
cd /opt/fridge-app
cp server/.env.example server/.env
vim server/.env          # 改 JWT_SECRET；填 CODEBUDDY_API_KEY；WX/SMTP 按需（GLM_API_KEY 仅图片识别兜底，可留空）

# 3. 一键构建启动（首次约 3~5 分钟，含容器内 npm 构建 H5）
docker compose up -d --build

# 4. 验证
curl http://服务器IP/api/health
# 浏览器打开 http://服务器IP
```

**启用 HTTPS（有域名）**：编辑 `Caddyfile`，把 `:80` 改成你的域名（如 `fridge.example.com`），并删除 `auto_https off` 行，然后：

```bash
docker compose up -d && docker compose restart web
# Caddy 自动向 Let's Encrypt 申请并续期证书（需域名 A 记录已指向服务器，放行 80/443）
```

**数据备份**（都挂载在宿主机，容器删除不丢）：

```bash
0 3 * * * cp /opt/fridge-app/server/data/fridge.db /opt/backup/fridge-$(date +\%F).db
```

**更新版本**：

```bash
git pull   # 或重新上传代码
docker compose up -d --build
```

## 方式二：传统部署（pm2 + Nginx）

## 当前开发环境（本机已就绪）

| 服务 | 地址 | 启动命令 |
| --- | --- | --- |
| 后端 API | http://localhost:3300 | `cd server && npm run dev` |
| H5 预览 | http://localhost:5180 | `cd miniprogram && npm run dev:h5` |
| 小程序构建产物 | `miniprogram/dist/dev/mp-weixin` | `npm run dev:mp-weixin` |

H5 联调已验证通过的链路：登录 → 手动/模板录入 → 云端入库 → 首页倒计时列表 → 日历标记 → 统计。
图片识别（CodeBuddy CLI 主引擎 + 智谱兜底）已通过单接口冒烟（置信度 0.98）。

## 微信真机联调步骤

1. **注册小程序**：mp.weixin.qq.com 注册，获取 AppID/AppSecret，填入 `server/.env` 的 `WX_APPID`/`WX_APPSECRET`
2. **安装微信开发者工具**，导入 `miniprogram` 项目，同时把 AppID 填入 `miniprogram/src/manifest.json` 的 `mp-weixin.appid`
3. **关闭合法域名校验**：开发者工具 → 详情 → 本地设置 → 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"
4. `npm run dev:mp-weixin` 后用开发者工具打开 `dist/dev/mp-weixin`
5. 手机预览：开发者工具点"预览"扫码（手机与电脑需同一局域网，且小程序端 baseUrl 需改为电脑局域网 IP，见 `src/utils/request.js` 的非 H5 分支）

## 订阅消息推送配置

1. 小程序后台（mp.weixin.qq.com）→ 功能 → 订阅消息 → 申请"一次性订阅"模板
   模板字段需包含：食品名称(thing)、过期日期(date)、剩余天数(number)、状态(thing)
2. 把模板 ID 填入 `server/.env` 的 `WX_SUBSCRIBE_TEMPLATE_ID`
3. 小程序端"统计与设置"页点"开启微信提醒"完成 `wx.requestSubscribeMessage` 授权
4. 后端 `node-cron` 每小时扫描（临期3天/1天/当天/过期后，按用户配置），命中即发送并按 `push_log` 去重
5. 未配置小程序凭证时自动跳过微信推送；配置 SMTP 后邮件兜底

## 生产部署清单

- [ ] 服务器部署 `server/`（Node 18+，`npm start`，建议 pm2 守护）
- [ ] HTTPS + ICP 备案域名指向后端，Nginx 反代 3300
- [ ] 小程序后台配置 request 合法域名：`https://你的域名`
- [ ] `miniprogram/src/utils/request.js` 非 H5 分支的 baseUrl 改为生产域名
- [ ] `.env` 替换生产 JWT_SECRET，确认 AppSecret/SMTP 凭证
- [ ] 小程序提交审核（类目建议：工具 > 效率）

## 已知限制

- CLI 识别单次 10~30 秒，后端已设 120s 超时 + 智谱 glm-4v-flash 自动降级
- 订阅消息为一次性授权，每次推送后需用户重新授权（可在收到提醒后回到设置页续订）
- `ck_` API Key 当前为明文存于 `server/.env`（已 gitignore），建议定期轮换
