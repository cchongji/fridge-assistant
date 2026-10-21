// 统一请求封装：H5 走代理 /api，小程序直连后端
const BASE_URL = (() => {
  // #ifdef H5
  return '/api'
  // #endif
  // #ifndef H5
  return 'http://localhost:3300/api'
  // #endif
})()

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
          if (res.statusCode === 401) {
            // 登录态失效，重新登录
            uni.removeStorageSync('token')
            login().finally(() => reject(new Error(msg)))
          } else {
            reject(new Error(msg))
          }
        }
      },
      fail: err => reject(new Error(err.errMsg || '网络异常'))
    })
  })
}

/** 微信登录：code 换 JWT */
export async function login() {
  // #ifdef MP-WEIXIN
  const { code } = await uni.login({ provider: 'weixin' })
  const res = await request('/auth/login', { method: 'POST', data: { code } })
  uni.setStorageSync('token', res.token)
  return res.token
  // #endif
  // #ifndef H5
  // #endif
  // H5 调试用：游客模式，后端发 dev token
  // #ifdef H5
  const res = await request('/auth/dev-login', { method: 'POST' })
  uni.setStorageSync('token', res.token)
  return res.token
  // #endif
}

/** 带鉴权的请求（自动补充 token，未登录自动登录） */
export async function api(path, options = {}) {
  let token = uni.getStorageSync('token')
  if (!token) {
    token = await login()
  }
  return request(path, {
    ...options,
    header: { Authorization: `Bearer ${token}`, ...(options.header || {}) }
  })
}
