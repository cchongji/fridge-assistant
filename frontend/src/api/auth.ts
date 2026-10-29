import { BASE_URL, get, post, put } from './http'
import type { Captcha, LoginResult, MeInfo, SmtpConfig } from './types'

export const fetchCaptcha = () => get<Captcha>('/auth/captcha')

/** 验证码图片地址（拼上 baseURL 与防缓存参数） */
export function captchaImageUrl(c: Captcha): string {
  const sep = c.url.includes('?') ? '&' : '?'
  return `${BASE_URL}${c.url}${sep}t=${Date.now()}`
}

export const login = (username: string, password: string) =>
  post<LoginResult>('/auth/login', { username, password })

export interface RegisterPayload {
  username: string
  password: string
  confirm: string
  nickname?: string
  email: string
  captchaId: string
  captchaAnswer: string
}

export const register = (payload: RegisterPayload) => post<LoginResult>('/auth/register', payload)

export const fetchMe = () => get<MeInfo>('/auth/me')

export const updateMe = (payload: { nickname?: string; email?: string }) =>
  put<{ ok: boolean }>('/auth/me', payload)

export const fetchSmtp = () => get<SmtpConfig>('/auth/smtp')

export const updateSmtp = (payload: { email?: string; authCode?: string; clearAuth?: boolean }) =>
  put<{ ok: boolean; email: string; authSet: boolean }>('/auth/smtp', payload)

export const changePassword = (payload: { oldPassword: string; password: string; confirm: string }) =>
  put<{ ok: boolean }>('/auth/password', payload)

export const logoutApi = () => post<{ ok: boolean }>('/auth/logout')
