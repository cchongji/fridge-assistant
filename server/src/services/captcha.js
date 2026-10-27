import { randomBytes, randomInt } from 'crypto'

/**
 * 图形验证码（服务端渲染 SVG，无第三方依赖）
 * - 4 位字符，去除 0/O/1/I 等易混淆字符
 * - 随机旋转、干扰线与噪点，加大 OCR 识别难度
 * - 服务端一次性校验，5 分钟过期
 */
const store = new Map()
const TTL = 5 * 60 * 1000
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const COLORS = ['#0e9f6e', '#1f7a5a', '#2f6f4f', '#0b6b57', '#38916a']

const rand = (min, max) => randomInt(min, max + 1)
const pick = arr => arr[randomInt(arr.length)]

function renderSvg(text) {
  const w = 120
  const h = 44
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  svg += `<rect width="100%" height="100%" fill="#eef7f1"/>`

  // 干扰线
  for (let i = 0; i < 4; i++) {
    svg += `<line x1="${rand(0, w)}" y1="${rand(0, h)}" x2="${rand(0, w)}" y2="${rand(0, h)}" stroke="${pick(COLORS)}" stroke-width="1" stroke-opacity="0.55"/>`
  }
  // 噪点
  for (let i = 0; i < 24; i++) {
    svg += `<circle cx="${rand(0, w)}" cy="${rand(0, h)}" r="${rand(1, 2)}" fill="${pick(COLORS)}" fill-opacity="0.4"/>`
  }
  // 字符
  text.split('').forEach((ch, i) => {
    const x = 14 + i * 24
    const y = 30 + rand(-4, 4)
    const rot = rand(-20, 20)
    svg += `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="${pick(COLORS)}" transform="rotate(${rot} ${x} ${y})">${ch}</text>`
  })

  return svg + '</svg>'
}

/** 生成验证码：返回 id 与图片地址（前端用 <image src> 展示） */
export function createCaptcha() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CHARS[randomInt(CHARS.length)]
  const id = randomBytes(12).toString('hex')
  store.set(id, { code, expireAt: Date.now() + TTL })
  return { id, url: `/auth/captcha/img?id=${id}` }
}

/** 取出验证码图片（不消费，可重复拉取；校验时才会失效） */
export function getCaptchaSvg(id) {
  const item = store.get(id)
  if (!item || Date.now() > item.expireAt) return null
  return renderSvg(item.code)
}

/** 校验并消费验证码；忽略大小写 */
export function verifyCaptcha(id, answer) {
  if (!id) return false
  const item = store.get(id)
  if (!item) return false
  store.delete(id) // 一次性，防止重放
  if (Date.now() > item.expireAt) return false
  return String(answer ?? '').trim().toUpperCase() === item.code
}

const timer = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of store) if (now > v.expireAt) store.delete(k)
}, 60_000)
timer.unref?.()
