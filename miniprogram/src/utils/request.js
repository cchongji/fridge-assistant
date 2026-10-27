// 统一请求封装：H5 走代理 /api，小程序直连后端
export const BASE_URL = (() => {
  // #ifdef H5
  return '/api'
  // #endif
  // #ifndef H5
  return 'http://localhost:3300/api'
  // #endif
})()

const LOGIN_PAGE = '/pages/login/index'

/** 清除登录态并跳转登录页 */
export function goLogin() {
  uni.removeStorageSync('token')
  uni.removeStorageSync('user')
  uni.reLaunch({ url: LOGIN_PAGE })
}

/** 退出登录 */
export function logout() {
  const token = uni.getStorageSync('token')
  if (token) {
    uni.request({ url: `${BASE_URL}/auth/logout`, method: 'POST', header: { Authorization: `Bearer ${token}` } })
  }
  goLogin()
}

const isAuthPath = p => p.startsWith('/auth/')

export function request(path, { method = 'GET', data, header } = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header: { 'Content-Type': 'application/json', ...header },
      success: res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          const msg = res.data?.error || `请求失败(${res.statusCode})`
          // 认证接口自身返回 401 时保持在当前页，便于展示错误提示
          if (res.statusCode === 401 && !isAuthPath(path)) {
            goLogin()
            reject(new Error('登录态失效，请重新登录'))
          } else {
            reject(new Error(msg))
          }
        }
      },
      fail: err => reject(new Error(err.errMsg || '网络异常'))
    })
  })
}

/** 带鉴权的请求（自动补充 token） */
export async function api(path, options = {}) {
  const token = uni.getStorageSync('token')
  if (!token) {
    goLogin()
    throw new Error('请先登录')
  }
  return request(path, {
    ...options,
    header: { Authorization: `Bearer ${token}`, ...(options.header || {}) }
  })
}
