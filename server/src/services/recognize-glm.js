import axios from 'axios'

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

const PROMPT =
  '这是食品包装/保质期标签照片。识别其中所有食品的名称与保质期信息，' +
  '输出 JSON（不要其他文字）：{"items":[{"name":"食品名称","productDate":"YYYY-MM-DD或null",' +
  '"expireDate":"YYYY-MM-DD或null","shelfLifeDays":数字或null,"quantity":数字或null,' +
  '"confidence":0到1的小数}]}'

/**
 * 智谱多模态识别引擎（兜底）
 * @param {string} imagePath 本地图片路径
 */
export async function recognizeByGlm(imagePath) {
  const apiKey = process.env.GLM_API_KEY
  if (!apiKey) throw new Error('未配置 GLM_API_KEY')
  const b64 = (await import('fs')).default.readFileSync(imagePath).toString('base64')
  const ext = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'

  const { data } = await axios.post(
    API_URL,
    {
      model: process.env.GLM_VISION_MODEL || 'glm-4v-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/${ext};base64,${b64}` } },
            { type: 'text', text: PROMPT }
          ]
        }
      ],
      temperature: 0.1
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 60000 }
  )
  const text = data.choices?.[0]?.message?.content || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('GLM 未返回 JSON')
  const obj = JSON.parse(m[0])
  const items = Array.isArray(obj.items) ? obj.items : [obj]
  return {
    items: items
      .filter(it => it && it.name)
      .map(it => ({
        name: String(it.name),
        productDate: it.productDate || null,
        expireDate: it.expireDate || null,
        shelfLifeDays: Number.isFinite(+it.shelfLifeDays) ? +it.shelfLifeDays : null,
        quantity: Number.isFinite(+it.quantity) && +it.quantity > 0 ? +it.quantity : 1,
        confidence: Math.min(1, Math.max(0, +it.confidence || 0.5))
      }))
  }
}
