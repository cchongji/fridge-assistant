import { del, get, post, put } from './http'
import type { Category, Food, FoodPayload, FoodStatus, FuzzyItem, SuggestResult } from './types'

export interface ListQuery {
  status?: FoodStatus | 'all'
  category?: Category | ''
  q?: string
}

export const listFoods = (query: ListQuery = {}) =>
  get<Food[]>('/foods', {
    params: {
      status: query.status || 'stock',
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { q: query.q } : {})
    }
  })

export const createFood = (payload: FoodPayload) => post<Food>('/foods', payload)

/** 批量新增（后端支持数组） */
export const createFoods = (list: FoodPayload[]) => post<Food[] | Food>('/foods', list)

/** 后端会与库中记录合并，允许局部字段更新 */
export const updateFood = (id: number, payload: Partial<FoodPayload> & { status?: FoodStatus }) =>
  put<Food>(`/foods/${id}`, payload)

export const eatFood = (id: number) => post<{ ok: boolean }>(`/foods/${id}/eat`)

export const removeFood = (id: number) => del<{ ok: boolean }>(`/foods/${id}`)

export const fuzzyFoods = (q: string, category?: Category) =>
  get<{ items: FuzzyItem[] }>('/foods/fuzzy', { params: { q, ...(category ? { category } : {}) } })

export const suggestFood = (name: string, category?: Category) =>
  post<SuggestResult>('/foods/suggest', { name, category })
