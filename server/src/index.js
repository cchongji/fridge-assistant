import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import foodRoutes from './routes/foods.js'
import recognizeRoutes from './routes/recognize.js'
import miscRoutes from './routes/misc.js'
import { startReminderCron } from './services/reminder.js'
import { ensureDefaultAdmin } from './services/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// 经 Caddy 反向代理时取真实客户端 IP（限流依赖）
app.set('trust proxy', true)

app.use(express.json({ limit: '10mb' }))

// 基础安全响应头（XSS / 嗅探 / 点击劫持）
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'")
  next()
})

// 识别图片静态访问
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/foods', foodRoutes)
app.use('/api/recognize', recognizeRoutes)
app.use('/api', miscRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// 兜底错误处理
app.use((err, req, res, next) => {
  console.error('[server]', err.message)
  res.status(500).json({ error: err.message || '服务器内部错误' })
})

const PORT = process.env.PORT || 3300
ensureDefaultAdmin()
  .catch(e => console.error('[auth] 初始化管理员失败:', e.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[fridge-server] http://localhost:${PORT}`)
      startReminderCron()
    })
  })
