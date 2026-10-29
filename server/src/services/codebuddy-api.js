import crypto from 'crypto'

/**
 * CodeBuddy 网关直连（不再依赖 codebuddy CLI）
 *
 * 通信方式与前端 e2e.config.ts 保持一致：
 *   1. baseURL 默认 https://www.codebuddy.cn/v2（可用 CODEBUDDY_BASE_URL 覆盖）
 *   2. 网关仅接受流式请求，非流式会返回 11101；这里统一 stream:true，再把 SSE 聚合成完整文本
 *   3. 补 CLI 来源头（X-IDE-* / X-Product），便于网关配额与统计归因
 */

const BASE_URL = (process.env.CODEBUDDY_BASE_URL || 'https://www.codebuddy.cn/v2').replace(/\/+$/, '')
const CLI_VERSION = process.env.CODEBUDDY_CLI_VERSION || '2.167.0'
const SOURCE_HEADERS = {
  'X-IDE-Type': 'CLI',
  'X-IDE-Name': 'CLI',
  'X-IDE-Version': CLI_VERSION,
  'X-Product-Version': CLI_VERSION,
  'X-Product': 'CLI'
}

const TEXT_MODEL = () => process.env.CODEBUDDY_MODEL || 'glm-5.3-flash'
const VISION_MODEL = () => process.env.CODEBUDDY_VISION_MODEL || TEXT_MODEL()

/** 把 chat.completion.chunk 的 SSE 文本聚合成完整回复文本 */
function sseToText(sse) {
  let content = ''
  for (const line of sse.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    let chunk
    try {
      chunk = JSON.parse(data)
    } catch {
      continue
    }
    const delta = chunk.choices?.[0]?.delta
    if (!delta) continue
    if (typeof delta.content === 'string') content += delta.content
    else if (Array.isArray(delta.content)) {
      // 部分网关把内容拆成分片数组
      for (const part of delta.content) {
        if (typeof part === 'string') content += part
        else if (part?.type === 'text' && typeof part.text === 'string') content += part.text
      }
    }
  }
  return content
}

/** 非流式 JSON 与流式 SSE 都能取到正文 */
function pickText(body, contentType) {
  if (!/text\/event-stream/i.test(contentType || '')) {
    try {
      const obj = JSON.parse(body)
      const content = obj?.choices?.[0]?.message?.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) return content.map(p => p?.text || '').join('')
      return ''
    } catch {
      return ''
    }
  }
  return sseToText(body)
}

/**
 * 调一次 chat/completions，返回模型输出文本
 * @param {Array<object>} messages OpenAI 格式消息
 * @param {{model?:string, timeoutMs?:number, temperature?:number}} options
 * @returns {Promise<string>}
 */
export async function chatCompletion(messages, { model, timeoutMs = 90000, temperature } = {}) {
  const apiKey = process.env.CODEBUDDY_API_KEY
  if (!apiKey) throw new Error('未配置 CODEBUDDY_API_KEY')

  const body = { model: model || TEXT_MODEL(), messages, stream: true }
  if (temperature !== undefined) body.temperature = temperature

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Request-Id': crypto.randomUUID(),
    ...SOURCE_HEADERS
  }

  let res
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new Error('CODEBUDDY_TIMEOUT')
    if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(e.message)) {
      throw new Error(`模型网关不可达（${BASE_URL}）：${e.message}`)
    }
    throw e
  }

  const raw = await res.text()
  if (!res.ok) {
    let detail = raw.slice(0, 300)
    try {
      const obj = JSON.parse(raw)
      detail = obj.msg || obj.message || obj.error?.message || detail
    } catch {
      /* 保持原文截断 */
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`模型鉴权失败（${res.status}）：CODEBUDDY_API_KEY 无效或与网关地址不匹配｜${detail}`)
    }
    throw new Error(`模型调用失败（${res.status}）：${detail}`)
  }

  const text = pickText(raw, res.headers.get('content-type')).trim()
  if (!text) throw new Error('模型未返回内容')
  return text
}

/**
 * 纯文本提示词
 * @param {string} prompt 提示词
 * @param {number} timeoutMs 超时（默认 90s）
 * @returns {Promise<string>}
 */
export function runCodeBuddyPrompt(prompt, timeoutMs = 90000) {
  return chatCompletion([{ role: 'user', content: prompt }], { timeoutMs })
}

/**
 * 图片 + 提示词（多模态）
 * @param {string} dataUrl data:image/...;base64,xxx
 * @param {string} prompt 提示词
 * @param {number} timeoutMs 超时（默认 120s）
 * @returns {Promise<string>}
 */
export function runCodeBuddyVision(dataUrl, prompt, timeoutMs = 120000) {
  return chatCompletion(
    [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: prompt }
        ]
      }
    ],
    { model: VISION_MODEL(), timeoutMs, temperature: 0.1 }
  )
}
