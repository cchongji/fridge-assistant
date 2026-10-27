/** 进程内滑动窗口限流（单容器部署足够；多实例可换 Redis） */
const buckets = new Map()

/**
 * @param {string} key 限流键（如 login:ip:username）
 * @param {number} limit 窗口内允许次数
 * @param {number} windowMs 窗口毫秒数
 * @returns {{ok:boolean, remaining:number, retryAfter?:number}}
 */
export function hit(key, limit, windowMs) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, remaining: limit - bucket.count }
}

/** 成功后清空计数（如登录成功重置失败次数） */
export function reset(key) {
  buckets.delete(key)
}

// 定期清理过期窗口，避免内存无限增长
const timer = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k)
}, 60_000)
timer.unref?.()
