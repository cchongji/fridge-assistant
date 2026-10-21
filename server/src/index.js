import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import foodRoutes from './routes/foods.js'
import recognizeRoutes from './routes/recognize.js'
import miscRoutes from './routes/misc.js'
import { startReminderCron } from './services/reminder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json({ limit: '10mb' }))

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
app.listen(PORT, () => {
  console.log(`[fridge-server] http://localhost:${PORT}`)
  startReminderCron()
})
