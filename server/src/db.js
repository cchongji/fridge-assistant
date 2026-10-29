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
  channel TEXT NOT NULL,                          -- email
  ok INTEGER NOT NULL,
  sent_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(user_id, food_id, remind_type, channel)
);

-- 管理员敏感操作审计
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  admin_username TEXT DEFAULT '',
  action TEXT NOT NULL,                           -- reset_password / disable / enable
  target_id INTEGER,
  target_username TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`)

// ---- 轻量迁移：账号密码登录所需字段 ----
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name)
if (!userCols.includes('username')) db.exec('ALTER TABLE users ADD COLUMN username TEXT')
if (!userCols.includes('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT')
if (!userCols.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
if (!userCols.includes('status')) db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'") // active/disabled
if (!userCols.includes('token_version')) db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0') // 自增即强制下线
if (!userCols.includes('must_change_password')) db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0') // 管理员重置密码后强制改密
// 账号唯一（允许微信等遗留账号为空）
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL AND username <> \'\'')

export default db
