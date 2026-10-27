import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LEN = 64

/**
 * 生成密码哈希（scrypt：自带随机盐，抗彩虹表与 GPU 暴力破解）
 * 格式：scrypt$N$r$p$<salt-hex>$<hash-hex>
 */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, KEY_LEN, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('hex'), derived.toString('hex')].join('$')
}

/** 校验密码；任何格式异常都返回 false（不抛错，避免探测账号是否存在） */
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false
  const parts = stored.split('$')
  if (parts.length !== 6) return false
  const [, N, r, p, saltHex, hashHex] = parts
  const expected = Buffer.from(hashHex, 'hex')
  if (!expected.length) return false
  try {
    const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p)
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch (e) {
    return false
  }
}
