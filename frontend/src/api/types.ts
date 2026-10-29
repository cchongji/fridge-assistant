export type Category = 'refrigerated' | 'frozen' | 'ambient'
export type FoodStatus = 'stock' | 'eaten' | 'expired'

export interface Food {
  id: number
  name: string
  category: Category
  quantity: number
  unit: string
  added_at: string
  expire_date: string
  opened_date: string | null
  note: string
  status: FoodStatus
  created_at?: string
  updated_at?: string
}

export interface FoodPayload {
  name: string
  category: Category
  quantity: number
  unit: string
  addedAt: string
  expireDate: string
  openedDate?: string | null
  note?: string
}

export interface LoginResult {
  token: string
  uid: number
  username: string
  nickname: string
}

export interface MeInfo {
  id: number
  username: string
  nickname: string
  email: string
  role: string
}

export interface Captcha {
  id: string
  url: string
}

export interface FuzzyItem {
  name: string
  category: Category
  days: number
}

export interface SuggestResult {
  days: number
  expireDate: string
  category?: Category
  tip?: string
  source?: string
}

export interface RecognizeItem {
  name: string
  category?: Category
  quantity?: number
  unit?: string
  days?: number
  shelfLifeDays?: number
  expireDate?: string
  note?: string
  confidence?: number
}

export interface RecognizeResult {
  items: RecognizeItem[]
  engine?: string
  imageUrl?: string
  raw?: string
}

export interface RemindConfig {
  d3: boolean
  d1: boolean
  d0: boolean
  expired: boolean
}

export interface MonthlyStats {
  month: string
  eaten: number
  expired: number
  inStock: number
}
