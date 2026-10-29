/** 剩余天数（按自然日，过期日当天算 0） */
export function daysLeft(expireDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expire = new Date(expireDate)
  expire.setHours(0, 0, 0, 0)
  return Math.round((expire.getTime() - today.getTime()) / 86400000)
}

export type Freshness = 'fresh' | 'soon' | 'urgent' | 'expired'

/** 新鲜度状态 */
export function freshness(expireDate: string): Freshness {
  const d = daysLeft(expireDate)
  if (d < 0) return 'expired'
  if (d <= 1) return 'urgent'
  if (d <= 3) return 'soon'
  return 'fresh'
}

/** 展示文案 */
export function daysLeftText(expireDate: string): string {
  const d = daysLeft(expireDate)
  if (d < 0) return `已过期 ${-d} 天`
  if (d === 0) return '今天过期'
  return `还剩 ${d} 天`
}

export const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: '#22c55e',
  soon: '#f59e0b',
  urgent: '#f97316',
  expired: '#ef4444'
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  fresh: '新鲜',
  soon: '临期',
  urgent: '紧急',
  expired: '已过期'
}

/** yyyy-MM-dd */
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 今天 + n 天 */
export function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toDateString(d)
}

export type ShelfLifeUnit = 'day' | 'month' | 'year'

/** 保质期上限（按单位） */
export const SHELF_MAX: Record<ShelfLifeUnit, number> = { day: 3650, month: 120, year: 10 }

/** 解析基准日期：支持 YYYY-MM-DD / YYYY/MM/DD / YYYY年MM月DD日，缺省为今天 */
function parseBaseDate(base?: string | Date | null): Date {
  if (base instanceof Date) return new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const m = String(base || '').match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * 基准日期 + 保质期（天 / 月 / 年），不传基准日期则以今天计算
 * 月末自动收敛：如 1 月 31 日 + 1 个月 → 2 月最后一天
 */
export function addShelfLife(amount: number, unit: ShelfLifeUnit, base?: string | Date | null): string {
  const d = parseBaseDate(base)
  const n = Math.max(1, Math.round(amount))
  if (unit === 'day') {
    d.setDate(d.getDate() + n)
  } else {
    const months = unit === 'year' ? n * 12 : n
    const day = d.getDate()
    d.setDate(1) // 先归到 1 号，避免 setMonth 溢出到下个月
    d.setMonth(d.getMonth() + months)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, lastDay))
  }
  return toDateString(d)
}
