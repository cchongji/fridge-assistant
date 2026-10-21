/** 剩余天数（按自然日，过期日当天算 0） */
export function daysLeft(expireDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expire = new Date(expireDate)
  expire.setHours(0, 0, 0, 0)
  return Math.round((expire - today) / 86400000)
}

/** 新鲜度状态：fresh/soon/urgent/expired */
export function freshness(expireDate) {
  const d = daysLeft(expireDate)
  if (d < 0) return 'expired'
  if (d === 0) return 'urgent'
  if (d <= 1) return 'urgent'
  if (d <= 3) return 'soon'
  return 'fresh'
}

/** 展示文案 */
export function daysLeftText(expireDate) {
  const d = daysLeft(expireDate)
  if (d < 0) return `已过期 ${-d} 天`
  if (d === 0) return '今天过期'
  return `还剩 ${d} 天`
}

export const FRESHNESS_COLOR = {
  fresh: '#22c55e',
  soon: '#f59e0b',
  urgent: '#f97316',
  expired: '#ef4444'
}
