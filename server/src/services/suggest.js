import { runCodeBuddyPrompt } from './codebuddy-cli.js'

const CATE_LABEL = { refrigerated: '冷藏', frozen: '冷冻', ambient: '常温' }

// 单行提示：避免经 shell 传递时换行被当作多条命令
const PROMPT = (name, cate) =>
  `你是食品保鲜专家。请依据常识判断食品「${name}」在${cate}条件下，从购买或录入当天算起的常见最佳保质期天数。硬性要求：1. 即使把握不大也必须给出该类食品最常见的天数，禁止回答“无法判断”“未识别”之类的内容；2. 同时给出一句简短中文保存建议；3. 不要联网、不要读写任何文件、不要执行任何操作；4. 只输出一行 JSON，不要 Markdown 代码块，不要任何解释文字。示例：{"days": 5, "tip": "密封冷藏，尽快食用"}。现在回答：食品「${name}」，存储方式：${cate}`

/**
 * 根据食品名称与存储方式，AI 推荐保质期天数（CodeBuddy 引擎，使用 CODEBUDDY_API_KEY）
 * @param {string} name 食品名称，如 小米椒
 * @param {string} category refrigerated/frozen/ambient
 * @returns {Promise<{days:number, tip:string, expireDate:string}>}
 */
export async function suggestShelfLife(name, category) {
  const cate = CATE_LABEL[category] || '冷藏'
  // CLI 冷启动 + 模型推理实测约 50s，留足余量
  const timeoutMs = +(process.env.CODEBUDDY_SUGGEST_TIMEOUT_MS || 90000)

  let text
  try {
    text = await runCodeBuddyPrompt(PROMPT(name, cate), timeoutMs)
  } catch (e) {
    if (e.message === 'CODEBUDDY_TIMEOUT') throw new Error('AI 建议超时，请重试')
    throw e
  }

  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI 未返回有效建议')
  const obj = JSON.parse(m[0])
  const days = Math.max(1, Math.min(3650, Math.round(+obj.days) || 7))
  const expireDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  })()
  return { days, tip: String(obj.tip || '').slice(0, 60), expireDate }
}
