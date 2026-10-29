import { Router } from 'express'
import db from '../db.js'
import { auth } from '../services/auth.js'
import { scanAndPush } from '../services/reminder.js'
import { sendEmail, resolveEmail, resolveSmtpConfig } from '../services/push.js'

const router = Router()

/** GET /api/settings  读取提醒配置 */
router.get('/settings', auth, (req, res) => {
  const row = db.prepare('SELECT remind_config FROM settings WHERE user_id = ?').get(req.uid)
  res.json({ remind: row ? JSON.parse(row.remind_config) : { d3: true, d1: true, d0: true, expired: true } })
})

/** PUT /api/settings  保存提醒配置 */
router.put('/settings', auth, (req, res) => {
  const remind = JSON.stringify(req.body.remind || {})
  db.prepare(
    `INSERT INTO settings (user_id, remind_config) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET remind_config = excluded.remind_config,
     updated_at = datetime('now','localtime')`
  ).run(req.uid, remind)
  res.json({ ok: true })
})

/** POST /api/remind/scan  手动触发一次扫描（只扫当前用户，返回命中/发送明细） */
router.post('/remind/scan', auth, async (req, res) => {
  try {
    res.json(await scanAndPush({ userId: req.uid }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/remind/test-email  发送一封测试邮件，排查 SMTP/邮箱配置 */
router.post('/remind/test-email', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)
    const to = resolveEmail(user)
    const cfg = resolveSmtpConfig()
    if (!cfg) {
      return res.status(400).json({
        error: '未配置 SMTP：请由管理员配置服务端 SMTP_HOST/SMTP_USER/SMTP_PASS'
      })
    }
    if (!to) return res.status(400).json({ error: '未绑定提醒邮箱，请先在统计页填写邮箱' })
    await sendEmail(
      to,
      '[冰箱日历] 测试邮件',
      `这是一封测试邮件，收件人：${to}，发件账号：${cfg.auth.user}。收到即表示邮件提醒通道正常。`
    )
    res.json({ ok: true, to, from: cfg.auth.user })
  } catch (e) {
    res.status(500).json({ error: `邮件发送失败：${e.message}` })
  }
})

/** GET /api/stats/monthly  本月吃掉/浪费统计 */
router.get('/stats/monthly', auth, (req, res) => {
  const month = new Date().toISOString().slice(0, 7)
  const eaten = db
    .prepare("SELECT COUNT(*) AS n FROM foods WHERE user_id=? AND status='eaten' AND updated_at LIKE ?")
    .get(req.uid, `${month}%`).n
  const expired = db
    .prepare("SELECT COUNT(*) AS n FROM foods WHERE user_id=? AND status='expired' AND updated_at LIKE ?")
    .get(req.uid, `${month}%`).n
  const inStock = db
    .prepare("SELECT COUNT(*) AS n FROM foods WHERE user_id=? AND status='stock'")
    .get(req.uid).n
  res.json({ month, eaten, expired, inStock })
})

/** GET /api/export  导出全部数据 */
router.get('/export', auth, (req, res) => {
  const foods = db.prepare('SELECT * FROM foods WHERE user_id = ?').all(req.uid)
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.uid)
  res.json({ exportedAt: new Date().toISOString(), foods, settings: settings || null })
})

/** POST /api/import  导入数据（覆盖同 id，新增其余） */
router.post('/import', auth, (req, res) => {
  const foods = Array.isArray(req.body?.foods) ? req.body.foods : []
  const stmt = db.prepare(
    `INSERT INTO foods (user_id, name, category, quantity, unit, added_at, expire_date, opened_date, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  let count = 0
  for (const f of foods) {
    if (!f.name || !f.expire_date) continue
    stmt.run(
      req.uid, f.name, f.category || 'refrigerated', f.quantity || 1, f.unit || '',
      f.added_at || new Date().toISOString().slice(0, 10), f.expire_date,
      f.opened_date || null, f.note || '', 'stock'
    )
    count++
  }
  res.json({ imported: count })
})

export default router
