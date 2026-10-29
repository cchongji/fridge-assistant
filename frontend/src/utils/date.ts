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
