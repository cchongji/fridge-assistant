import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { hashPassword } from './password.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export function signToken(userId, tokenVersion = 0) {
  return jwt.sign({ uid: userId, ver: tokenVersion }, JWT_SECRET, { expiresIn: '30d' })
}

/** Bearer JWT 鉴权中间件：校验账号状态与令牌版本（改密/停用后可强制下线） */
export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: '未登录' })

  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: '登录态失效，请重新登录' })
  }

  const row = db
    .prepare('SELECT status, token_version, must_change_password FROM users WHERE id = ?')
    .get(payload.uid)
  if (!row) return res.status(401).json({ error: '登录态失效，请重新登录' })
  if (row.status === 'disabled') return res.status(401).json({ error: '账号已停用，请联系管理员' })
  if ((payload.ver || 0) !== (row.token_version || 0)) {
    return res.status(401).json({ error: '登录态已失效，请重新登录' })
  }

  // 必须修改初始密码时，仅放行改密与登出相关接口
  if (row.must_change_password) {
    const allowed = ['/api/auth/password', '/api/auth/me', '/api/auth/logout']
    if (!allowed.some(p => req.originalUrl.startsWith(p))) {
      return res.status(403).json({ error: '请先修改初始密码', code: 'MUST_CHANGE_PASSWORD' })
    }
  }

  req.uid = payload.uid
  next()
}

/** 仅管理员可访问（需先经过 auth 中间件） */
export function adminOnly(req, res, next) {
  const row = db.prepare('SELECT role FROM users WHERE id = ?').get(req.uid)
  if (row?.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' })
  next()
}

/**
 * 初始管理员密码：优先取 ADMIN_INIT_PASSWORD；
 * 未配置时生成一次性随机密码，仅在首次初始化时打印到日志
 */
function initAdminPassword() {
  const fromEnv = String(process.env.ADMIN_INIT_PASSWORD || '').trim()
  if (fromEnv) return { password: fromEnv, generated: false }
  return { password: crypto.randomBytes(9).toString('base64url'), generated: true }
}

/**
 * 启动时确保存在默认管理员账号
 * 账号 admin，密码取 ADMIN_INIT_PASSWORD，未配置时随机生成
 */
export async function ensureDefaultAdmin() {
  const { password: DEFAULT_PASSWORD, generated } = initAdminPassword()
  const exist = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin')
  if (exist) return exist

  const hash = await hashPassword(DEFAULT_PASSWORD)

  // 复用旧的 H5 游客账号，保留其食品数据与邮箱提醒配置
  const legacy = db
    .prepare("SELECT id FROM users WHERE openid = 'dev-user-h5' AND (username IS NULL OR username = '')")
    .get()
  if (legacy) {
    db.prepare("UPDATE users SET username = 'admin', password_hash = ?, role = 'admin', nickname = COALESCE(NULLIF(nickname, ''), '管理员') WHERE id = ?").run(hash, legacy.id)
    console.log(
      '[auth] 已将原 H5 游客账号升级为 admin（食品与提醒配置保持不变）' +
        (generated ? `，初始密码：${DEFAULT_PASSWORD}` : '')
    )
    return db.prepare('SELECT id, username FROM users WHERE id = ?').get(legacy.id)
  }

  const info = db
    .prepare("INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, '管理员', 'admin')")
    .run('admin', hash)
  db.prepare('INSERT OR IGNORE INTO settings (user_id, remind_config) VALUES (?, ?)').run(
    info.lastInsertRowid,
    JSON.stringify({ d3: true, d1: true, d0: true, expired: true })
  )
  console.log(
    generated
      ? `[auth] 已初始化默认管理员：admin / ${DEFAULT_PASSWORD}（随机生成，请登录后立即修改）`
      : '[auth] 已初始化默认管理员：admin /（ADMIN_INIT_PASSWORD 指定，请登录后尽快修改）'
  )
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(info.lastInsertRowid)
}
