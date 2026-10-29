import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'
import router from '@/router'
import { clearAuth, getToken } from '@/utils/storage'

/** H5 走 vite 代理 /api（生产由 Caddy 反代到后端 3300） */
export const BASE_URL = import.meta.env.VITE_API_BASE || '/api'

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

/** 认证接口自身 401 时保持在当前页，便于展示错误 */
const isAuthPath = (url = '') => url.startsWith('/auth/')

http.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  res => res,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status ?? 0
    const url = error.config?.url || ''
    const msg = error.response?.data?.error || (status ? `请求失败(${status})` : '网络异常')

    if (status === 401 && !isAuthPath(url)) {
      clearAuth()
      router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
      return Promise.reject(new Error('登录态失效，请重新登录'))
    }
    const err = new Error(msg) as Error & { status?: number }
    err.status = status
    return Promise.reject(err)
  }
)

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, config)
  return data
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<T>(url, body, config)
  return data
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.put<T>(url, body)
  return data
}

export async function del<T>(url: string): Promise<T> {
  const { data } = await http.delete<T>(url)
  return data
}

/** 上传单个文件（字段名 image，与后端 /api/recognize 对齐） */
export async function upload<T>(url: string, file: File, field = 'image'): Promise<T> {
  const form = new FormData()
  form.append(field, file)
  const { data } = await http.post<T>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000
  })
  return data
}
