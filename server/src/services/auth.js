import jwt from 'jsonwebtoken'
import db from '../db.js'
import { hashPassword } from './password.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export function signToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '30d' })
}

/** Bearer JWT 鉴权中间件 */
export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: '未登录' })
  try {
    req.uid = jwt.verify(token, JWT_SECRET).uid
    next()
  } catch (e) {
    return res.status(401).json({ error: '登录态失效，请重新登录' })
  }
}

/**
 * 启动时确保存在默认管理员账号
 * 账号 admin，密码取 ADMIN_INIT_PASSWORD，默认 czy@1234
 */
export async function ensureDefaultAdmin() {
  const DEFAULT_PASSWORD = process.env.ADMIN_INIT_PASSWORD || 'czy@1234'
  const exist = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin')
  if (exist) return exist

  const hash = await hashPassword(DEFAULT_PASSWORD)

  // 复用旧的 H5 游客账号，保留其食品数据与邮箱提醒配置
  const legacy = db
    .prepare("SELECT id FROM users WHERE openid = 'dev-user-h5' AND (username IS NULL OR username = '')")
    .get()
  if (legacy) {
    db.prepare("UPDATE users SET username = 'admin', password_hash = ?, role = 'admin', nickname = COALESCE(NULLIF(nickname, ''), '管理员') WHERE id = ?").run(hash, legacy.id)
    console.log('[auth] 已将原 H5 游客账号升级为 admin（食品与提醒配置保持不变）')
    return db.prepare('SELECT id, username FROM users WHERE id = ?').get(legacy.id)
  }

  const info = db
    .prepare("INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, '管理员', 'admin')")
    .run('admin', hash)
  db.prepare('INSERT OR IGNORE INTO settings (user_id, remind_config) VALUES (?, ?)').run(
    info.lastInsertRowid,
    JSON.stringify({ d3: true, d1: true, d0: true, expired: true })
  )
  console.log('[auth] 已初始化默认管理员：admin / ' + (process.env.ADMIN_INIT_PASSWORD ? '(自定义密码)' : 'czy@1234') + '（请登录后尽快修改）')
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(info.lastInsertRowid)
}
