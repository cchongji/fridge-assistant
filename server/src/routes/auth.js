import { Router } from 'express'
import db from '../db.js'
import { auth, signToken } from '../services/auth.js'
import { hashPassword, verifyPassword } from '../services/password.js'
import { hit, reset } from '../services/rate-limit.js'
import { createCaptcha, verifyCaptcha, getCaptchaSvg } from '../services/captcha.js'
import { USERNAME_RE, sanitizeText, isValidEmail, checkPassword } from '../services/validate.js'

const router = Router()

const TEN_MIN = 10 * 60 * 1000
const LOGIN_IP_LIMIT = { limit: 20, windowMs: TEN_MIN } // 单 IP 登录尝试
const LOGIN_USER_LIMIT = { limit: 5, windowMs: TEN_MIN } // 单 IP + 单账号
const REGISTER_LIMIT = { limit: 3, windowMs: TEN_MIN } // 单 IP 注册

const clientIp = req => req.ip || req.socket?.remoteAddress || 'unknown'
const tooFast = (res, retryAfter, what) =>
  res.status(429).json({ error: `${what}过于频繁，请 ${Math.max(1, Math.ceil(retryAfter / 60))} 分钟后再试` })

/** GET /api/auth/captcha  注册用图形验证码 */
router.get('/captcha', (req, res) => {
  const rl = hit(`captcha:${clientIp(req)}`, 30, TEN_MIN)
  if (!rl.ok) return tooFast(res, rl.retryAfter, '获取验证码')
  res.json(createCaptcha())
})

/** GET /api/auth/captcha/img?id=xxx  验证码图片（SVG） */
router.get('/captcha/img', (req, res) => {
  const svg = getCaptchaSvg(String(req.query.id || ''))
  if (!svg) return res.status(404).json({ error: '验证码不存在或已过期' })
  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'no-store')
  res.send(svg)
})

/** POST /api/auth/register  注册（验证码 + 限流 + 蜜罐字段） */
router.post('/register', async (req, res) => {
  try {
    const ip = clientIp(req)
    const rl = hit(`reg:${ip}`, REGISTER_LIMIT.limit, REGISTER_LIMIT.windowMs)
    if (!rl.ok) return tooFast(res, rl.retryAfter, '注册')

    const body = req.body || {}
    // 蜜罐：正常用户看不到也不会填这个字段
    if (body.website || body.contact) return res.status(400).json({ error: '请求异常' })

    if (!verifyCaptcha(body.captchaId, body.captchaAnswer)) {
      return res.status(400).json({ error: '验证码错误或已过期，请刷新重试' })
    }

    const username = sanitizeText(body.username, 20)
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: '账号需 3-20 位字母、数字或下划线' })

    const pw = checkPassword(body.password)
    if (!pw.ok) return res.status(400).json({ error: pw.msg })
    if (String(body.password) !== String(body.confirm ?? '')) {
      return res.status(400).json({ error: '两次输入的密码不一致' })
    }

    const email = String(body.email ?? '').trim()
    if (!email) return res.status(400).json({ error: '请输入邮箱' })
    if (!isValidEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' })

    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return res.status(409).json({ error: '该账号已存在' })
    }

    const hash = await hashPassword(String(body.password))
    const nickname = sanitizeText(body.nickname || username, 20)
    const info = db
      .prepare('INSERT INTO users (username, password_hash, nickname, email) VALUES (?, ?, ?, ?)')
      .run(username, hash, nickname, email)
    db.prepare('INSERT OR IGNORE INTO settings (user_id, remind_config) VALUES (?, ?)').run(
      info.lastInsertRowid,
      JSON.stringify({ d3: true, d1: true, d0: true, expired: true })
    )

    const user = db.prepare('SELECT id, username, nickname FROM users WHERE id = ?').get(info.lastInsertRowid)
    res.json({ token: signToken(user.id), uid: user.id, username: user.username, nickname: user.nickname })
  } catch (e) {
    res.status(500).json({ error: e.message || '注册失败' })
  }
})

/** POST /api/auth/login  账号密码登录 */
router.post('/login', async (req, res) => {
  try {
    const ip = clientIp(req)
    const body = req.body || {}
    const username = sanitizeText(body.username, 20)

    const rlIp = hit(`login:${ip}`, LOGIN_IP_LIMIT.limit, LOGIN_IP_LIMIT.windowMs)
    if (!rlIp.ok) return tooFast(res, rlIp.retryAfter, '登录尝试')
    const rlUser = hit(`login:${ip}:${username}`, LOGIN_USER_LIMIT.limit, LOGIN_USER_LIMIT.windowMs)
    if (!rlUser.ok) return tooFast(res, rlUser.retryAfter, '登录尝试')

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    const ok = user?.password_hash ? await verifyPassword(String(body.password ?? ''), user.password_hash) : false
    // 账号不存在时也返回同一提示，避免账号枚举
    if (!ok) return res.status(401).json({ error: '账号或密码错误' })

    reset(`login:${ip}:${username}`)
    res.json({ token: signToken(user.id), uid: user.id, username: user.username, nickname: user.nickname })
  } catch (e) {
    res.status(500).json({ error: e.message || '登录失败' })
  }
})

/** POST /api/auth/logout  JWT 无状态，服务端仅做语义响应 */
router.post('/logout', (req, res) => res.json({ ok: true }))

/** GET /api/auth/me */
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, email, role FROM users WHERE id = ?').get(req.uid)
  if (!user) return res.status(404).json({ error: '用户不存在' })
  res.json({
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    role: user.role
  })
})

/** PUT /api/auth/me  更新昵称/邮箱 */
router.put('/me', auth, (req, res) => {
  const { nickname, email } = req.body || {}
  if (email !== undefined && email !== '' && !isValidEmail(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' })
  }
  const nextEmail = email === undefined ? null : String(email).trim().slice(0, 64)

  db.prepare('UPDATE users SET nickname = COALESCE(?, nickname), email = COALESCE(?, email) WHERE id = ?').run(
    nickname === undefined ? null : sanitizeText(nickname, 20),
    nextEmail,
    req.uid
  )
  res.json({ ok: true })
})

/** PUT /api/auth/password  修改密码（需原密码） */
router.put('/password', auth, async (req, res) => {
  try {
    const { oldPassword, password, confirm } = req.body || {}
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.uid)
    if (!user) return res.status(404).json({ error: '用户不存在' })

    const rl = hit(`pwd:${req.uid}`, 5, TEN_MIN)
    if (!rl.ok) return tooFast(res, rl.retryAfter, '修改密码')

    if (!(await verifyPassword(String(oldPassword ?? ''), user.password_hash))) {
      return res.status(401).json({ error: '原密码不正确' })
    }
    const pw = checkPassword(password)
    if (!pw.ok) return res.status(400).json({ error: pw.msg })
    if (String(password) !== String(confirm ?? '')) return res.status(400).json({ error: '两次输入的密码不一致' })

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(String(password)), req.uid)
    reset(`pwd:${req.uid}`)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message || '修改密码失败' })
  }
})

export default router
