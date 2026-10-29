import axios from 'axios'
import nodemailer from 'nodemailer'
import db from '../db.js'

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
