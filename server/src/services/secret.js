import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * 敏感凭据（SMTP 授权码）加密存储：与密码一样绝不明文落库。
 * 采用 AES-256-GCM（自带完整性校验），密钥由服务端密钥派生。
 * 存储格式：v1$<iv-hex>$<tag-hex>$<cipher-hex>
 * 注：这是可逆加密（发信时需要使用明文授权码），数据库泄露时若无服务端密钥仍无法解密。
 */

const PREFIX = 'v1'
const SALT = 'fridge-smtp-secret-v1'

let cachedKey = null
function key() {
  if (cachedKey) return cachedKey
  const raw = process.env.SECRET_ENC_KEY || process.env.JWT_SECRET || 'dev-secret'
  cachedKey = scryptSync(String(raw), SALT, 32)
  return cachedKey
}

/** 加密为可安全落库的字符串 */
export function encryptSecret(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  return [PREFIX, iv.toString('hex'), cipher.getAuthTag().toString('hex'), data.toString('hex')].join('$')
}

/** 解密；格式异常或密钥变更时返回 null（不抛错，避免探测） */
export function decryptSecret(stored) {
  if (typeof stored !== 'string' || !stored) return null
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== PREFIX) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(parts[1], 'hex'))
    decipher.setAuthTag(Buffer.from(parts[2], 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'hex')), decipher.final()]).toString('utf8')
  } catch (e) {
    return null
  }
}
