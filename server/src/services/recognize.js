import { recognizeByCodeBuddy } from './recognize-codebuddy.js'

/** 今天的 UTC 零点（避免时区导致日期偏移） */
function todayUtc() {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * 到期日期缺失时，用「生产日期 + 保质期天数」推算；
 * 图片没有生产日期（例如只拍了食物本身）时，以今天为基准 + AI 建议的保质期天数
 * 例：productDate=2025-06-15，shelfLifeDays=730 → expireDate=2027-06-15
 * @param {{expireDate?:string|null, productDate?:string|null, shelfLifeDays?:number|null}} item
 */
export function fillExpireDate(item) {
  const { expireDate, productDate, shelfLifeDays } = item || {}
  if (expireDate || !Number.isFinite(+shelfLifeDays) || +shelfLifeDays <= 0) return item

  let base = todayUtc()
  if (productDate) {
    // 兼容 2025-06-15 / 2025/6/15 / 2025年6月15日
    const m = String(productDate).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
    if (m) base = Date.UTC(+m[1], +m[2] - 1, +m[3])
  }

  const days = Math.round(+shelfLifeDays)
  const date = new Date(base + days * 86400000)
  if (Number.isNaN(date.getTime())) return item
  return { ...item, expireDate: date.toISOString().slice(0, 10) }
}

/**
 * 图片识别：CodeBuddy 网关多模态引擎
 * @param {string} imagePath
 * @returns {Promise<{engine: string, items: Array}>}
 */
export async function recognize(imagePath) {
  const { items } = await recognizeByCodeBuddy(imagePath)
  return { engine: 'codebuddy', items: items.map(fillExpireDate) }
}
