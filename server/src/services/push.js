import axios from 'axios'
import nodemailer from 'nodemailer'
import db from '../db.js'
import { decryptSecret } from './secret.js'

let cachedToken = null // { token, expiresAt }

async function getWxAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token
  const appid = process.env.WX_APPID
  const secret = process.env.WX_APPSECRET
  if (!appid || !secret) throw new Error('未配置 WX_APPID/WX_APPSECRET')
  const { data } = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`,
    { timeout: 10000 }
  )
  if (!data.access_token) throw new Error(`获取 access_token 失败: ${data.errmsg}`)
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
  return cachedToken.token
}

/**
 * 发送微信订阅消息（需小程序端提前 wx.requestSubscribeMessage 授权）
 * @param {string} openid
 * @param {string} templateId 小程序后台申请的模板 ID
 * @param {{name:string, expireDate:string, daysLeft:number}} payload
 */
export async function sendWxSubscribe(openid, templateId, { name, expireDate, daysLeft }) {
  const token = await getWxAccessToken()
  const { data } = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
    {
      touser: openid,
      template_id: templateId,
      page: 'pages/index/index',
      data: {
        thing1: { value: String(name).slice(0, 20) },
        date2: { value: expireDate },
        number3: { value: Math.abs(daysLeft) },
        thing4: { value: daysLeft < 0 ? '已过期' : daysLeft === 0 ? '今天过期' : '即将过期' }
      }
    },
    { timeout: 10000 }
  )
  if (data.errcode) throw new Error(`订阅消息发送失败: ${data.errcode} ${data.errmsg}`)
  return true
}

/** 服务端兜底 SMTP 是否已配置 */
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

/** 常见邮箱域名 → SMTP 服务器（用户自带授权码时按域名推断） */
const SMTP_HOST_MAP = {
  'qq.com': 'smtp.qq.com',
  'foxmail.com': 'smtp.qq.com',
  '163.com': 'smtp.163.com',
  '126.com': 'smtp.126.com',
  'yeah.net': 'smtp.yeah.net',
  'gmail.com': 'smtp.gmail.com',
  'outlook.com': 'smtp.office365.com',
  'hotmail.com': 'smtp.office365.com',
  'live.com': 'smtp.office365.com',
  'sina.com': 'smtp.sina.com',
  'sohu.com': 'smtp.sohu.com',
  'aliyun.com': 'smtp.aliyun.com',
  'icloud.com': 'smtp.mail.me.com'
}

function domainOf(email) {
  return String(email || '').split('@')[1]?.trim().toLowerCase() || ''
}

/** 按邮箱域名推断 SMTP 服务器，推断不出则回落服务端配置 */
function guessSmtpHost(email) {
  const domain = domainOf(email)
  if (!domain) return ''
  return SMTP_HOST_MAP[domain] || `smtp.${domain}`
}

/**
 * 读取用户的 SMTP 绑定（授权码在内存中解密使用，绝不返回给前端 / 绝不落日志）
 * @param {number} userId
 * @returns {{email:string, pass:string}} 未绑定时均为空串
 */
export function getUserSmtp(userId) {
  if (!userId) return { email: '', pass: '' }
  const row = db.prepare('SELECT email, smtp_email, smtp_auth_enc FROM users WHERE id = ?').get(userId)
  if (!row) return { email: '', pass: '' }
  // 默认发件邮箱 = 注册时绑定的邮箱
  const email = String(row.smtp_email || row.email || '').trim()
  const pass = row.smtp_auth_enc ? decryptSecret(row.smtp_auth_enc) : ''
  return { email, pass: pass || '' }
}

/** 选择发信服务器：与服务端账号同域名用服务端配置，否则按用户邮箱域名推断 */
function pickHost(email) {
  const serverDomain = domainOf(process.env.SMTP_USER)
  const domain = domainOf(email)
  if (domain && serverDomain && domain === serverDomain) return process.env.SMTP_HOST
  return guessSmtpHost(email) || process.env.SMTP_HOST || ''
}

/**
 * 解析实际发信配置：优先用户自己的「邮箱 + 授权码」，否则回落服务端 SMTP_*
 * @param {number} userId
 * @returns {{host:string,port:number,secure:boolean,auth:{user:string,pass:string},from:string,source:string}|null}
 */
export function resolveSmtpConfig(userId) {
  const portNum = Number(process.env.SMTP_PORT) || 465
  const mine = getUserSmtp(userId)
  if (mine.email && mine.pass) {
    const host = pickHost(mine.email)
    if (host) {
      return {
        host,
        port: portNum,
        secure: portNum === 465,
        auth: { user: mine.email, pass: mine.pass },
        from: mine.email,
        source: 'user'
      }
    }
  }
  if (smtpReady()) {
    return {
      host: process.env.SMTP_HOST,
      port: portNum,
      secure: portNum === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      from: process.env.SMTP_USER,
      source: 'server'
    }
  }
  return null
}

/** 该用户当前是否具备发信条件（用户自带配置或服务端兜底） */
export function smtpReadyFor(userId) {
  return !!resolveSmtpConfig(userId)
}

/** 邮件兜底推送（自动选用用户绑定或服务端兜底的 SMTP 通道） */
export async function sendEmail(userId, to, subject, text) {
  const cfg = resolveSmtpConfig(userId)
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
