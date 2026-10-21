import jwt from 'jsonwebtoken'
import db from '../db.js'

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

/** code 换 openid 并确保用户存在，返回 user 行 */
export async function upsertUserByCode(code) {
  const appid = process.env.WX_APPID
  const secret = process.env.WX_APPSECRET
  if (!appid || !secret) throw new Error('服务端未配置 WX_APPID/WX_APPSECRET')
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
  const { data } = await axiosGet(url)
  if (data.errcode) throw new Error(`微信登录失败: ${data.errcode} ${data.errmsg}`)
  return upsertUserByOpenid(data.openid)
}

export function upsertUserByOpenid(openid) {
  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)
  if (!user) {
    const info = db.prepare('INSERT INTO users(openid) VALUES (?)').run(openid)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
  }
  return user
}

/** H5 联调用：固定游客账号 */
export function getDevUser() {
  return upsertUserByOpenid('dev-user-h5')
}

import axios from 'axios'
function axiosGet(url) {
  return axios.get(url, { timeout: 10000 })
}
