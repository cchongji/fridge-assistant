import { Router } from 'express'
import db from '../db.js'
import { auth, adminOnly } from '../services/auth.js'
import { hashPassword } from '../services/password.js'
import { hit } from '../services/rate-limit.js'

const router = Router()
const TEN_MIN = 10 * 60 * 1000
/** 管理员重置后的统一密码（可用 USER_RESET_PASSWORD 覆盖） */
const RESET_PASSWORD = String(process.env.USER_RESET_PASSWORD || '123456')

const clientIp = req => req.ip || req.socket?.remoteAddress || 'unknown'

/** 记录管理员敏感操作，便于审计追溯 */
function logAdminAction(req, action, target, detail = '') {
  try {
    const admin = db.prepare('SELECT username FROM users WHERE id = ?').get(req.uid)
    db.prepare(
      `INSERT INTO admin_logs (admin_id, admin_username, action, target_id, target_username, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.uid,
      admin?.username || '',
      action,
      target?.id ?? null,
      target?.username || '',
      detail,
      clientIp(req)
    )
  } catch (e) {
    console.warn('[admin] 写审计日志失败:', e.message)
  }
}

router.use(auth, adminOnly)

/** GET /api/admin/users  账号列表（含食品数量与状态） */
router.get('/users', (req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.email, u.role, u.status, u.created_at,
              (SELECT COUNT(*) FROM foods f WHERE f.user_id = u.id) AS food_count,
              (SELECT COUNT(*) FROM foods f WHERE f.user_id = u.id AND f.status = 'stock') AS stock_count
       FROM users u
       ORDER BY u.id`
    )
    .all()
  res.json({ users })
})

/** GET /api/admin/logs  最近的管理员操作记录 */
router.get('/logs', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
  const logs = db.prepare('SELECT * FROM admin_logs ORDER BY id DESC LIMIT ?').all(limit)
  res.json({ logs })
})

/** POST /api/admin/users/:id/reset-password  将指定账号密码重置为统一密码 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '账号参数不合法' })
    if (id === req.uid) {
      return res.status(400).json({ error: '不能重置自己的密码，请使用「修改密码」' })
    }

    const target = db.prepare('SELECT id, username, token_version FROM users WHERE id = ?').get(id)
    if (!target) return res.status(404).json({ error: '账号不存在' })
    if (!target.username) return res.status(400).json({ error: '该账号未设置用户名，无法重置密码' })

    const rl = hit(`admin-reset:${req.uid}`, 30, TEN_MIN)
    if (!rl.ok) {
      return res.status(429).json({ error: `操作过于频繁，请 ${Math.ceil(rl.retryAfter / 60)} 分钟后再试` })
    }

    // 重置密码同时自增 token_version（旧设备立即失效），并标记必须修改密码
    db.prepare(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1, must_change_password = 1 WHERE id = ?'
    ).run(await hashPassword(RESET_PASSWORD), id)
    logAdminAction(req, 'reset_password', target, '密码已重置为统一初始密码')

    res.json({ ok: true, id, username: target.username, password: RESET_PASSWORD })
  } catch (e) {
    res.status(500).json({ error: e.message || '重置密码失败' })
  }
})

/** POST /api/admin/users/:id/status  启用 / 停用账号 */
router.post('/users/:id/status', (req, res) => {
  try {
    const id = Number(req.params.id)
    const status = String(req.body?.status || '')
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '账号参数不合法' })
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ error: '状态参数不合法' })
    if (id === req.uid) return res.status(400).json({ error: '不能停用自己的账号' })

    const target = db.prepare('SELECT id, username, role, status FROM users WHERE id = ?').get(id)
    if (!target) return res.status(404).json({ error: '账号不存在' })
    if (target.role === 'admin' && status === 'disabled') {
      const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND status = 'active'").get().n
      if (admins <= 1) return res.status(400).json({ error: '至少需保留一个启用状态的管理员' })
    }
    if (target.status === status) return res.json({ ok: true, id, status })

    // 停用后旧令牌立即失效
    db.prepare(
      status === 'disabled'
        ? 'UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?'
        : 'UPDATE users SET status = ? WHERE id = ?'
    ).run(status, id)
    logAdminAction(req, status === 'disabled' ? 'disable' : 'enable', target)

    res.json({ ok: true, id, status })
  } catch (e) {
    res.status(500).json({ error: e.message || '更新账号状态失败' })
  }
})

export default router
