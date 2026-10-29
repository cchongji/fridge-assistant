import fs from 'fs'
import path from 'path'
import { runCodeBuddyVision } from './codebuddy-api.js'

const PROMPT = [
  '这是一张食品照片：可能是包装/保质期标签，也可能只是食物本身。请按以下规则处理：',
  '1. 识别画面中所有可辨认的食品，给出常见中文名称（可带品牌/规格）；',
  '2. 若画面中有生产日期、到期日期或“保质期 X 天/月/年”等明确信息，如实提取；没有则对应字段填 null，禁止编造日期；',
  '3. 若没有明确保质期信息，请依据食品种类（必要时结合存放分区）给出该类食品常见的建议保质期天数，并把 estimated 设为 true；有明确保质期信息时 estimated 设为 false；',
  '4. category 只能是 refrigerated（冷藏）、frozen（冷冻）、ambient（常温）之一；',
  '5. quantity 为该食品的件数/份数（1 盒、1 袋、1 包都记 1，不要统计散装个数），无法判断填 1；confidence 为 0 到 1 的识别把握。',
  '只输出一个 JSON 对象，不要输出任何解释文字：',
  '{"items":[{"name":"食品名称","category":"refrigerated","productDate":"YYYY-MM-DD或null","expireDate":"YYYY-MM-DD或null","shelfLifeDays":数字,"estimated":true,"quantity":数字,"confidence":0到1的小数}]}'
].join('\n')

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
const CATEGORIES = ['refrigerated', 'frozen', 'ambient']

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
    .map(it => {
      const days = Number.isFinite(+it.shelfLifeDays) && +it.shelfLifeDays > 0 ? Math.round(+it.shelfLifeDays) : null
      return {
        name: String(it.name),
        category: CATEGORIES.includes(it.category) ? it.category : undefined,
        productDate: normalizeDate(it.productDate),
        expireDate: normalizeDate(it.expireDate),
        shelfLifeDays: days,
        // 图片未给出保质期时，模型按食品种类给出的建议值
        estimated: it.estimated === true || (it.estimated === undefined && !it.expireDate && !it.productDate),
        quantity: Number.isFinite(+it.quantity) && +it.quantity > 0 ? +it.quantity : 1,
        confidence: Math.min(1, Math.max(0, +it.confidence || 0.5))
      }
    })
}

function normalizeDate(s) {
  if (!s) return null
  const m = String(s).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}
