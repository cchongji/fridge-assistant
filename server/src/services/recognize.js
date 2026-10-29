import { recognizeByCodeBuddy } from './recognize-codebuddy.js'

/**
 * 到期日期缺失时，用「生产日期 + 保质期天数」推算
 * 例：productDate=2025-06-15，shelfLifeDays=730 → expireDate=2027-06-15
 * @param {{expireDate?:string|null, productDate?:string|null, shelfLifeDays?:number|null}} item
 */
export function fillExpireDate(item) {
  const { expireDate, productDate, shelfLifeDays } = item || {}
  if (expireDate || !productDate || !Number.isFinite(+shelfLifeDays) || +shelfLifeDays <= 0) return item
  // 兼容 2025-06-15 / 2025/6/15 / 2025年6月15日
  const m = String(productDate).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (!m) return item
  const days = Math.round(+shelfLifeDays)
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3])
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
