import { recognizeByCodeBuddy } from './recognize-codebuddy.js'
import { recognizeByGlm } from './recognize-glm.js'

/**
 * 双引擎识别抽象层：CodeBuddy 网关主引擎，失败/超时自动降级智谱多模态
 * @param {string} imagePath
 * @returns {Promise<{engine: string, items: Array, degraded: boolean}>}
 */
export async function recognize(imagePath) {
  let primaryError = null
  try {
    const { items } = await recognizeByCodeBuddy(imagePath)
    if (items.length) return { engine: 'codebuddy', items, degraded: false }
    primaryError = new Error('CodeBuddy 未识别出食品')
  } catch (e) {
    primaryError = e
    console.warn('[recognize] CodeBuddy 引擎失败，降级 GLM：', e.message)
  }

  const { items } = await recognizeByGlm(imagePath)
  return { engine: 'glm', items, degraded: true, primaryError: primaryError?.message }
}
