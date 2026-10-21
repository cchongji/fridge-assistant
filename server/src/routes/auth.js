import { Router } from 'express'
import db from '../db.js'
import { auth, signToken, upsertUserByCode, getDevUser } from '../services/auth.js'

const router = Router()

/** POST /api/auth/login  {code} 微信登录 */
router.post('/login', async (req, res) => {
  try {
    const user = await upsertUserByCode(req.body.code)
    res.json({ token: signToken(user.id), uid: user.id })
  } catch (e) {
    res.status(401).json({ error: e.message })
  }
})

/** POST /api/auth/dev-login  H5 联调游客模式 */
router.post('/dev-login', (req, res) => {
  const user = getDevUser()
  res.json({ token: signToken(user.id), uid: user.id })
})

/** GET /api/auth/me */
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, openid, nickname, email FROM users WHERE id = ?').get(req.uid)
  res.json(user)
})

/** PUT /api/auth/me  更新昵称/邮箱 */
router.put('/me', auth, (req, res) => {
  const { nickname, email } = req.body || {}
  db.prepare('UPDATE users SET nickname = COALESCE(?, nickname), email = COALESCE(?, email) WHERE id = ?').run(
    nickname ?? null,
    email ?? null,
    req.uid
  )
  res.json({ ok: true })
})

export default router
