import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// 可用 CODEBUDDY_CLI_PATH 覆盖（容器内自定义安装位置）
const CODEBUDDY_JS =
  process.env.CODEBUDDY_CLI_PATH ||
  path.join(
    path.dirname(process.execPath),
    'node_modules',
    '@tencent-ai',
    'codebuddy-code',
    'dist',
    'codebuddy.js'
  )

/**
 * CodeBuddy CLI 无头调用：执行一次提示词，返回模型输出文本
 * 需要环境变量 CODEBUDDY_API_KEY（可选 CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT、CODEBUDDY_CLI_MODEL）
 * @param {string} prompt 提示词
 * @param {number} timeoutMs 超时（默认 120s）
 * @returns {Promise<string>} 模型输出的纯文本
 */
export function runCodeBuddyPrompt(prompt, timeoutMs = 120000) {
  const apiKey = process.env.CODEBUDDY_API_KEY
  if (!apiKey) throw new Error('未配置 CODEBUDDY_API_KEY')

  const env = { ...process.env, CODEBUDDY_API_KEY: apiKey }
  if (process.env.CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT) {
    env.CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT = process.env.CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT
  }

  const cliJs = fs.existsSync(CODEBUDDY_JS) ? CODEBUDDY_JS : 'codebuddy'
  const usePath = cliJs === 'codebuddy'
  const cmd = usePath ? 'codebuddy' : process.execPath
  const args = [
    ...(usePath ? [] : [cliJs]),
    '-y',
    '-p',
    prompt,
    '--output-format',
    'json',
    '--model',
    process.env.CODEBUDDY_CLI_MODEL || 'glm-5.3-flash'
  ]

  return new Promise((resolve, reject) => {
    // 仅 WINDOWS + 走 PATH 的 codebuddy.cmd 需要 shell；
    // 其余情况（含 Linux 下的 codebuddy）直接 spawn：由 uv 按 PATH 查找，避免换行/空格参数被 shell 截断
    const shell = usePath && process.platform === 'win32'
    const child = spawn(cmd, args, { shell, env })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('CODEBUDDY_TIMEOUT'))
    }, timeoutMs)

    child.stdout.on('data', d => (stdout += d))
    child.stderr.on('data', d => (stderr += d))
    child.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', code => {
      clearTimeout(timer)
      const raw = stdout.trim()
      const errText = stderr.trim()
      try {
        const arr = JSON.parse(raw)
        const last = Array.isArray(arr) ? arr[arr.length - 1] : arr
        const text = (last?.result || '').trim()
        if (!text) {
          return reject(
            new Error(`CLI 未返回结果：${errText ? cleanCliError(errText) : `退出码 ${code}`}`)
          )
        }
        resolve(text)
      } catch (e) {
        const detail = errText ? cleanCliError(errText) : `退出码 ${code}`
        reject(new Error(`CLI 输出解析失败：${detail}｜原始输出：${raw.slice(0, 200) || '(空)'}`))
      }
    })
  })
}

/** 清洗 CLI 报错：去 ANSI/路径噪音、截断，并补充常见原因提示 */
function cleanCliError(text, max = 300) {
  const lines = text
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  // 优先取含中文报错或 Error 的行
  const hit = lines.find(l => l.includes('Error') || /[\u4e00-\u9fa5]/.test(l)) || lines.join(' ')
  let msg = hit.length > max ? `${hit.slice(0, max)}…` : hit
  if (/代理|proxy|ECONNREFUSED/i.test(text)) msg += '（提示：网络/代理不可达，检查 CODEBUDDY_COPILOT_INTERNET_ENVIRONMENT 与代理端口）'
  if (/401|403|Unauthorized|invalid api key/i.test(text)) msg += '（提示：CODEBUDDY_API_KEY 无效或过期）'
  return msg
}
