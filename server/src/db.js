import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'fridge.db'))
db.pragma('journal_mode = WAL') // WAL 模式避免锁冲突
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT UNIQUE,
  nickname TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'refrigerated',  -- refrigerated/frozen/ambient
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT '',
  added_at TEXT NOT NULL,
  expire_date TEXT NOT NULL,
  opened_date TEXT,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'stock',           -- stock/eaten/expired
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_foods_user_expire ON foods(user_id, expire_date);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  remind_config TEXT NOT NULL DEFAULT '{}',       -- {d3,d1,d0,expired} 开关
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  food_id INTEGER NOT NULL,
  remind_type TEXT NOT NULL,                      -- d3/d1/d0/expired
  channel TEXT NOT NULL,                          -- weixin/email
  ok INTEGER NOT NULL,
  sent_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(user_id, food_id, remind_type, channel)
);
`)

// ---- 轻量迁移：账号密码登录所需字段 ----
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name)
if (!userCols.includes('username')) db.exec('ALTER TABLE users ADD COLUMN username TEXT')
if (!userCols.includes('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT')
if (!userCols.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
// 账号唯一（允许微信等遗留账号为空）
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL AND username <> \'\'')

// ---- 迁移：SMTP 绑定（发件邮箱 + 授权码密文，授权码不明文存储） ----
if (!userCols.includes('smtp_email')) db.exec('ALTER TABLE users ADD COLUMN smtp_email TEXT')
if (!userCols.includes('smtp_auth_enc')) db.exec('ALTER TABLE users ADD COLUMN smtp_auth_enc TEXT')
// 默认发件邮箱 = 注册时绑定的邮箱
db.exec("UPDATE users SET smtp_email = email WHERE (smtp_email IS NULL OR smtp_email = '') AND email IS NOT NULL AND email <> ''")

export default db
