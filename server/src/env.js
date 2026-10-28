import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// .env 统一放在项目根目录（前后端共用）；容器内由 docker env_file 直接注入环境变量，无需此文件
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const candidates = [
  process.env.ENV_FILE, // 显式指定优先
  path.resolve(__dirname, '../../.env'), // 项目根目录
  path.resolve(__dirname, '../.env') // 兼容旧位置 server/.env
].filter(Boolean)

const found = candidates.find(p => fs.existsSync(p))
if (found) {
  dotenv.config({ path: found, quiet: true })
} else if (!process.env.JWT_SECRET) {
  console.warn('[env] 未找到 .env，且 JWT_SECRET 未通过环境变量注入')
}

export const envFile = found || null
