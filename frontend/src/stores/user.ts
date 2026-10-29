import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { login as loginApi, logoutApi, register as registerApi } from '@/api/auth'
import type { RegisterPayload } from '@/api/auth'
import { clearAuth, getUser, getToken, setToken, setUser } from '@/utils/storage'
import type { StoredUser } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken())
  const user = ref<StoredUser | null>(getUser())

  const isLoggedIn = computed(() => !!token.value)
  const nickname = computed(() => (user.value?.nickname as string) || (user.value?.username as string) || '')
  const isAdmin = computed(() => user.value?.role === 'admin')

  function restore() {
    token.value = getToken()
    user.value = getUser()
  }

  function applyAuth(res: {
    token: string
    uid: number
    username: string
    nickname: string
    role?: string
    mustChangePassword?: boolean
  }) {
    token.value = res.token
    const profile: StoredUser = {
      uid: res.uid,
      username: res.username,
      nickname: res.nickname,
      role: res.role || 'user',
      mustChangePassword: res.mustChangePassword === true
    }
    user.value = profile
    setToken(res.token)
    setUser(profile)
  }

  async function login(username: string, password: string) {
    applyAuth(await loginApi(username, password))
  }

  async function register(payload: RegisterPayload) {
    applyAuth(await registerApi(payload))
  }

  function clear() {
    clearAuth()
    token.value = ''
    user.value = null
  }

  async function logout() {
    try {
      await logoutApi()
    } catch {
      /* 服务端无状态，失败也照常清理本地 */
    }
    clear()
  }

  return { token, user, isLoggedIn, isAdmin, nickname, restore, login, register, clear, logout }
})
