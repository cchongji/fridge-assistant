FROM node:22-slim

# better-sqlite3 预编译包托管在 GitHub（国内服务器可能无法访问），
# 无法下载预编译包时会回退 node-gyp 源码编译，需要 python3/make/g++
RUN sed -i 's|deb.debian.org|mirrors.tencentyun.com|g' /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list 2>/dev/null || true \
    && apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# CodeBuddy CLI：AI 保质期建议 / 图片识别主引擎（无头调用）
# 放在 COPY src 之前，避免每次改源码都重装（约 5 分钟）
RUN npm i -g @tencent-ai/codebuddy-code@2.167.0

# 源码
COPY src ./src

EXPOSE 3300
CMD ["node", "src/index.js"]
