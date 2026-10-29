import cron from 'node-cron'
import db from '../db.js'
import { sendEmail, logPush, alreadyPushed, smtpReady, resolveEmail, resolveSmtpConfig } from './push.js'

const DEFAULT_CONFIG = { d3: true, d1: true, d0: true, expired: true }

function remindTypesFor(daysLeft, config) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const types = []
  if (daysLeft === 3 && cfg.d3) types.push('d3')
  if (daysLeft === 1 && cfg.d1) types.push('d1')
  if (daysLeft === 0 && cfg.d0) types.push('d0')
  if (daysLeft < 0 && cfg.expired) types.push('expired')
  return types
}

/** 该用户可用的推送渠道（仅邮件） */
function channelsFor(user) {
  const list = []
  if (smtpReady() && resolveEmail(user)) list.push('email')
  return list
}

/** 无可用渠道时，给出具体缺什么（便于用户自查） */
function noChannelReason(user) {
  const missing = []
  if (!resolveSmtpConfig()) missing.push('服务端未配置 SMTP（需管理员配置 SMTP_HOST/SMTP_USER/SMTP_PASS）')
  else if (!resolveEmail(user)) missing.push('未绑定提醒邮箱（统计页 → 账号 → 邮箱）')
  return missing.join('；')
}

/**
 * 扫描一次：为在库食品匹配提醒类型并发送
 * @param {{userId?: number}} options 传 userId 时只扫描该用户（手动触发用）
 * @returns {Promise<{scanned:number, matched:number, sent:number, skipped:Array}>}
 */
export async function scanAndPush({ userId } = {}) {
  const foods = userId
    ? db.prepare("SELECT * FROM foods WHERE status = 'stock' AND user_id = ?").all(userId)
    : db.prepare("SELECT * FROM foods WHERE status = 'stock'").all()

  const result = { scanned: foods.length, matched: 0, sent: 0, skipped: [] }

  for (const food of foods) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(food.user_id)
    const setting = db.prepare('SELECT remind_config FROM settings WHERE user_id = ?').get(food.user_id)
    const config = setting ? JSON.parse(setting.remind_config) : {}

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expire = new Date(food.expire_date)
    expire.setHours(0, 0, 0, 0)
    const daysLeft = Math.round((expire - today) / 86400000)

    const types = remindTypesFor(daysLeft, config)
    result.matched += types.length

    for (const type of types) {
      const channels = channelsFor(user)
      if (!channels.length) {
        result.skipped.push({ name: food.name, type, reason: `无可用推送渠道：${noChannelReason(user)}` })
        continue
      }

      const todo = channels.filter(ch => !alreadyPushed(user.id, food.id, type, ch))
      if (!todo.length) {
        result.skipped.push({ name: food.name, type, reason: '该提醒本轮之前已发送过' })
        continue
      }

      for (const ch of todo) {
        try {
          await sendEmail(
            resolveEmail(user),
            `[冰箱日历] ${food.name} ${type === 'expired' ? '已过期' : '即将过期'}`,
            `食品「${food.name}」将于 ${food.expire_date} 过期（${
              daysLeft < 0 ? '已过期 ' + -daysLeft + ' 天' : '还剩 ' + daysLeft + ' 天'
            }），请尽快处理。`
          )
          logPush(user.id, food.id, type, ch, true)
          result.sent++
        } catch (e) {
          console.warn(`[remind] 邮件发送失败(${food.name}):`, e.message)
          logPush(user.id, food.id, type, ch, false)
          result.skipped.push({ name: food.name, type, reason: `邮件发送失败：${e.message}` })
        }
      }
    }
  }

  if (result.sent) console.log(`[remind] 本轮发送 ${result.sent} 条提醒`)
  return result
}

export function startReminderCron() {
  // 每小时第 5 分钟扫描一次（错过单次不遗漏）
  cron.schedule('5 * * * *', () => {
    scanAndPush().catch(e => console.error('[remind] 扫描异常:', e.message))
  })
  console.log('[remind] 定时扫描已启动（每小时）')
}
