import { get, post, put } from './http'
import type { MonthlyStats, RemindConfig } from './types'

export const fetchSettings = () => get<{ remind: RemindConfig }>('/settings')

export const saveSettings = (remind: RemindConfig) => put<{ ok: boolean }>('/settings', { remind })

export interface ScanResult {
  scanned?: number
  matched?: number
  sent?: number
  skipped?: Array<{ name?: string; to?: string; ok?: boolean; reason?: string }>
  details?: Array<{ name?: string; to?: string; ok?: boolean; reason?: string }>
}

export const scanRemind = () => post<ScanResult>('/remind/scan')

export const sendTestEmail = () => post<{ ok: boolean; to: string; from: string }>('/remind/test-email')

export const fetchMonthlyStats = () => get<MonthlyStats>('/stats/monthly')

export const exportData = () => get<Record<string, unknown>>('/export')

export const importData = (foods: unknown[]) => post<{ imported: number }>('/import', { foods })
