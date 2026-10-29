import nodemailer from 'nodemailer'
import db from '../db.js'

/** 服务端 SMTP 是否已配置 */
export function smtpReady() {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass } = process.env
  return !!(host && user && pass)
}

/** 收件人：优先用户绑定邮箱，未绑定时回落到服务端配置的 SMTP_TO */
export function resolveEmail(user) {
  const bound = String(user?.email || '').trim()
  if (bound) return bound
  return String(process.env.SMTP_TO || '').trim()
}

/**
 * 解析发信配置：统一使用服务端 SMTP_* 配置
 * @returns {{host:string,port:number,secure:boolean,auth:{user:string,pass:string},from:string}|null}
 */
export function resolveSmtpConfig() {
  if (!smtpReady()) return null
  const portNum = Number(process.env.SMTP_PORT) || 465
  return {
    host: process.env.SMTP_HOST,
    port: portNum,
    secure: portNum === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    from: process.env.SMTP_USER
  }
}

/** 邮件推送（使用服务端统一的 SMTP 通道） */
export async function sendEmail(to, subject, text) {
  const cfg = resolveSmtpConfig()
  if (!cfg) throw new Error('未配置 SMTP：请联系管理员配置服务端 SMTP_HOST/SMTP_USER/SMTP_PASS')
  const recipient = String(to || '').trim() || String(process.env.SMTP_TO || '').trim()
  if (!recipient) throw new Error('没有收件邮箱')
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure, // 465 隐式 TLS；587 走 STARTTLS
    auth: cfg.auth,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  })
  await transporter.sendMail({ from: cfg.from, to: recipient, subject, text })
  return true
}

/** 记录推送日志（去重依据；失败行可被后续成功覆盖） */
export function logPush(userId, foodId, remindType, channel, ok) {
  db.prepare(
    `INSERT INTO push_log (user_id, food_id, remind_type, channel, ok) VALUES (?,?,?,?,?)
     ON CONFLICT(user_id, food_id, remind_type, channel)
     DO UPDATE SET ok = excluded.ok, sent_at = datetime('now','localtime')`
  ).run(userId, foodId, remindType, channel, ok ? 1 : 0)
}

/** 只有成功发送过才算已推送，失败记录允许下轮重试 */
export function alreadyPushed(userId, foodId, remindType, channel) {
  return !!db
    .prepare('SELECT 1 FROM push_log WHERE user_id=? AND food_id=? AND remind_type=? AND channel=? AND ok=1')
    .get(userId, foodId, remindType, channel)
}
