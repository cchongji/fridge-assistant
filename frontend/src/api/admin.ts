import { get, post } from './http'
import type { AdminUser } from './types'

/** 账号列表（仅管理员） */
export const fetchAdminUsers = () => get<{ users: AdminUser[] }>('/admin/users')

/** 将指定账号密码重置为统一密码（仅管理员） */
export const resetUserPassword = (id: number) =>
  post<{ ok: boolean; id: number; username: string; password: string }>(`/admin/users/${id}/reset-password`, {})

/** 启用 / 停用账号（仅管理员） */
export const setUserStatus = (id: number, status: 'active' | 'disabled') =>
  post<{ ok: boolean; id: number; status: string }>(`/admin/users/${id}/status`, { status })
