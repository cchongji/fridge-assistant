import fs from 'fs'
import path from 'path'
import { runCodeBuddyVision } from './codebuddy-api.js'

const PROMPT =
  '这是一张食品包装/保质期标签的照片。只根据图片内容，寻找食品名称和生产日期/到期日期/保质期天数信息。' +
  '如果图片中有多件食品，逐件列出。最后输出一个 JSON 对象（不要输出其他解释文字）：' +
  '{"items":[{"name":"食品名称","productDate":"YYYY-MM-DD或null","expireDate":"YYYY-MM-DD或null","shelfLifeDays":数字或null,"quantity":数字或null,"confidence":0到1的小数}]}'

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }

/** 本地图片 → data URL（网关多模态输入） */
function toDataUrl(imagePath) {
  const mime = MIME[path.extname(imagePath).toLowerCase()] || 'image/jpeg'
  return `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`
}

/**
 * CodeBuddy 网关多模态识别引擎
 * @param {string} imagePath 图片绝对路径
 * @param {number} timeoutMs 超时（默认 120s）
 * @returns {Promise<{items: Array}>}
 */
export function recognizeByCodeBuddy(imagePath, timeoutMs = 120000) {
  return runCodeBuddyVision(toDataUrl(imagePath), PROMPT, timeoutMs).then(text => ({
    items: extractItems(text)
  }))
}

/** 从模型文本中宽容提取 JSON（支持 ```json 包裹或混排） */
export function extractItems(text) {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('未找到 JSON')
  const obj = JSON.parse(m[0])
  const items = Array.isArray(obj.items) ? obj.items : [obj]
  return items
    .filter(it => it && it.name)
    .map(it => ({
      name: String(it.name),
      productDate: normalizeDate(it.productDate),
      expireDate: normalizeDate(it.expireDate),
      shelfLifeDays: Number.isFinite(+it.shelfLifeDays) ? +it.shelfLifeDays : null,
      quantity: Number.isFinite(+it.quantity) && +it.quantity > 0 ? +it.quantity : 1,
      confidence: Math.min(1, Math.max(0, +it.confidence || 0.5))
    }))
}

function normalizeDate(s) {
  if (!s) return null
  const m = String(s).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}
