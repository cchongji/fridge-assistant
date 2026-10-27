<template>
  <view class="page">
    <!-- 背景装饰 -->
    <view class="bg-decor">
      <view class="blob blob-a"></view>
      <view class="blob blob-b"></view>
      <view class="blob blob-c"></view>
    </view>

    <view class="wrap" :style="{ paddingTop: safeTop + 'px' }">
      <!-- 品牌区 -->
      <view class="brand">
        <view class="logo-tile">
          <text class="logo-emoji">🧊</text>
        </view>
        <text class="brand-name">冰箱剩余时间日历</text>
        <text class="brand-slogan">登录后管理你的食材保质期</text>
      </view>

      <!-- 表单卡片 -->
      <view class="card">
        <view class="segment">
          <view class="seg-indicator" :class="{ right: mode === 'register' }"></view>
          <text class="seg-item" :class="{ active: mode === 'login' }" @tap="switchMode('login')">登录</text>
          <text class="seg-item" :class="{ active: mode === 'register' }" @tap="switchMode('register')">注册</text>
        </view>

        <view class="form">
          <view class="input-item">
            <text class="icon">👤</text>
            <input
              class="input"
              v-model="form.username"
              placeholder="请输入账号"
              placeholder-class="ph"
              maxlength="20"
              :adjust-position="true"
            />
          </view>

          <view class="input-item">
            <text class="icon">🔒</text>
            <input
              class="input"
              v-model="form.password"
              placeholder="请输入密码"
              placeholder-class="ph"
              maxlength="64"
              :password="!showPwd"
              :adjust-position="true"
            />
            <text class="toggle" @tap="showPwd = !showPwd">{{ showPwd ? '隐藏' : '显示' }}</text>
          </view>

          <view class="input-item" v-if="mode === 'register'">
            <text class="icon">🔒</text>
            <input
              class="input"
              v-model="form.confirm"
              placeholder="请再次输入密码"
              placeholder-class="ph"
              maxlength="64"
              :password="!showPwd"
              :adjust-position="true"
            />
          </view>

          <view class="input-item" v-if="mode === 'register'">
            <text class="icon">🪪</text>
            <input
              class="input"
              v-model="form.nickname"
              placeholder="昵称（选填）"
              placeholder-class="ph"
              maxlength="20"
              :adjust-position="true"
            />
          </view>

          <view class="input-item" v-if="mode === 'register'">
            <text class="icon">✉️</text>
            <input
              class="input"
              v-model="form.email"
              placeholder="邮箱（必填，用于过期提醒）"
              placeholder-class="ph"
              maxlength="64"
              :adjust-position="true"
            />
          </view>

          <view class="captcha-block" v-if="mode === 'register'">
            <view class="input-item">
              <text class="icon">🛡️</text>
              <input
                class="input"
                v-model="form.captchaAnswer"
                placeholder="输入图中 4 位字符"
                placeholder-class="ph"
                maxlength="6"
                :adjust-position="true"
              />
              <view class="captcha" @tap="loadCaptcha">
                <image class="captcha-img" v-if="captcha.url" :src="captcha.url" mode="aspectFit" />
                <text class="captcha-text" v-else>点击获取</text>
              </view>
            </view>
            <text class="captcha-tip">看不清？点击右侧图片换一张（不区分大小写）</text>
          </view>
        </view>

        <view class="error" v-if="error">
          <text class="error-icon">!</text>
          <text class="error-text">{{ error }}</text>
        </view>

        <button class="submit" :class="{ disabled: loading }" :disabled="loading" @tap="submit">
          <text class="spinner" v-if="loading"></text>
          <text class="submit-text">{{ loading ? '处理中…' : mode === 'login' ? '登录' : '注册并登录' }}</text>
        </button>

        <text class="footnote">
          {{ mode === 'login' ? '还没有账号？点击上方「注册」即可创建' : '账号 3-20 位字母/数字/下划线，密码至少 8 位且含字母和数字' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { request, BASE_URL } from '../../utils/request.js'

const mode = ref('login')
const loading = ref(false)
const error = ref('')
const showPwd = ref(false)
const safeTop = ref(20)
const captcha = reactive({ id: '', url: '' })
const form = reactive({
  username: '',
  password: '',
  confirm: '',
  nickname: '',
  email: '',
  captchaAnswer: ''
})

async function loadCaptcha() {
  try {
    const c = await request('/auth/captcha')
    captcha.id = c.id
    // 加时间戳避免图片被缓存
    captcha.url = `${BASE_URL}${c.url}&t=${Date.now()}`
  } catch (e) {
    error.value = e.message
  }
}

function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  error.value = ''
  if (next === 'register' && !captcha.id) loadCaptcha()
}

async function submit() {
  if (loading.value) return
  error.value = ''
  const isReg = mode.value === 'register'

  if (!form.username || !form.password) {
    error.value = '请输入账号和密码'
    return
  }
  if (isReg && form.password !== form.confirm) {
    error.value = '两次输入的密码不一致'
    return
  }
  if (isReg && !form.email.trim()) {
    error.value = '请输入邮箱'
    return
  }
  if (isReg && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    error.value = '邮箱格式不正确'
    return
  }
  if (isReg && !captcha.id) {
    error.value = '验证码已失效，请点击刷新'
    return
  }

  loading.value = true
  try {
    const payload = isReg
      ? {
          username: form.username,
          password: form.password,
          confirm: form.confirm,
          nickname: form.nickname,
          email: form.email,
          captchaId: captcha.id,
          captchaAnswer: form.captchaAnswer
        }
      : { username: form.username, password: form.password }

    const res = await request(isReg ? '/auth/register' : '/auth/login', { method: 'POST', data: payload })
    uni.setStorageSync('token', res.token)
    uni.setStorageSync('user', { uid: res.uid, username: res.username, nickname: res.nickname })
    uni.showToast({ title: isReg ? '注册成功' : '登录成功', icon: 'none' })
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (e) {
    error.value = e.message || '操作失败'
    if (isReg) {
      form.captchaAnswer = ''
      loadCaptcha()
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  try {
    const info = uni.getSystemInfoSync && uni.getSystemInfoSync()
    if (info && info.statusBarHeight) safeTop.value = info.statusBarHeight + 12
  } catch (e) {
    safeTop.value = 32
  }

  if (uni.getStorageSync('token')) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  loadCaptcha()
})
</script>

<style lang="scss" scoped>
.page {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  background: linear-gradient(180deg, #eafaf1 0%, #f6f8f7 46%, #f6f8f7 100%);
  overflow: hidden;
}

/* 背景光斑 */
.bg-decor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 720rpx;
  .blob {
    position: absolute;
    border-radius: 50%;
  }
  .blob-a {
    top: -140rpx;
    left: -80rpx;
    width: 420rpx;
    height: 420rpx;
    background: radial-gradient(circle, rgba(7, 193, 96, 0.22) 0%, rgba(7, 193, 96, 0) 70%);
  }
  .blob-b {
    top: 40rpx;
    right: -120rpx;
    width: 460rpx;
    height: 460rpx;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0) 70%);
  }
  .blob-c {
    top: 360rpx;
    left: 40rpx;
    width: 300rpx;
    height: 300rpx;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0) 70%);
  }
}

.wrap {
  position: relative;
  z-index: 1;
  padding: 0 48rpx 64rpx;
  box-sizing: border-box;
}

/* 品牌区 */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72rpx 0 64rpx;
  .logo-tile {
    width: 132rpx;
    height: 132rpx;
    border-radius: 36rpx;
    background: linear-gradient(135deg, $primary 0%, $primary-deep 100%);
    box-shadow: 0 16rpx 32rpx rgba(7, 193, 96, 0.32);
    display: flex;
    align-items: center;
    justify-content: center;
    .logo-emoji {
      font-size: 64rpx;
      line-height: 1;
    }
  }
  .brand-name {
    margin-top: 28rpx;
    font-size: 42rpx;
    font-weight: 700;
    letter-spacing: 2rpx;
    color: $text-main;
  }
  .brand-slogan {
    margin-top: 12rpx;
    font-size: 26rpx;
    color: $text-sub;
  }
}

/* 卡片 */
.card {
  background: $card-bg;
  border-radius: 32rpx;
  padding: 32rpx 32rpx 36rpx;
  box-shadow: 0 12rpx 40rpx rgba(31, 45, 43, 0.08);
}

/* 分段切换 */
.segment {
  position: relative;
  display: flex;
  padding: 6rpx;
  margin-bottom: 36rpx;
  border-radius: 999rpx;
  background: #f1f5f3;
  .seg-indicator {
    position: absolute;
    top: 6rpx;
    left: 6rpx;
    width: calc(50% - 6rpx);
    height: 68rpx;
    border-radius: 999rpx;
    background: #ffffff;
    box-shadow: 0 4rpx 12rpx rgba(31, 45, 43, 0.1);
    transition: left 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    &.right {
      left: 50%;
    }
  }
  .seg-item {
    position: relative;
    z-index: 1;
    flex: 1;
    height: 68rpx;
    line-height: 68rpx;
    text-align: center;
    font-size: 29rpx;
    color: $text-sub;
    transition: color 0.28s ease;
    &.active {
      color: $primary-deep;
      font-weight: 700;
    }
  }
}

/* 输入项 */
.input-item {
  display: flex;
  align-items: center;
  height: 96rpx;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
  border-radius: $radius;
  background: #f5f8f6;
  border: 2rpx solid transparent;
  transition: background 0.2s ease, border-color 0.2s ease;
  &:active {
    background: #eef4f0;
    border-color: rgba(7, 193, 96, 0.35);
  }
  .icon {
    width: 44rpx;
    font-size: 30rpx;
    text-align: center;
    opacity: 0.85;
  }
  .input {
    flex: 1;
    height: 96rpx;
    padding: 0 16rpx;
    font-size: 29rpx;
    color: $text-main;
    background: transparent;
  }
  .ph {
    color: #a9bab4;
    font-size: 28rpx;
  }
  .toggle {
    padding: 8rpx 4rpx 8rpx 12rpx;
    font-size: 25rpx;
    color: $primary-deep;
    font-weight: 600;
    &:active {
      opacity: 0.6;
    }
  }
}

/* 验证码 */
.captcha-block {
  margin-bottom: 4rpx;
  .captcha {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200rpx;
    height: 68rpx;
    border-radius: 12rpx;
    background: #e8f5ee;
    overflow: hidden;
    &:active {
      opacity: 0.8;
    }
    .captcha-img {
      width: 200rpx;
      height: 68rpx;
    }
    .captcha-text {
      font-size: 24rpx;
      color: $primary-deep;
      font-weight: 600;
    }
  }
  .captcha-tip {
    display: block;
    padding: 0 8rpx;
    margin-bottom: 16rpx;
    font-size: 22rpx;
    color: $text-sub;
  }
}

/* 错误提示 */
.error {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
  border-radius: 12rpx;
  background: rgba(239, 68, 68, 0.08);
  .error-icon {
    width: 32rpx;
    height: 32rpx;
    line-height: 32rpx;
    margin-right: 12rpx;
    border-radius: 50%;
    background: $expired;
    color: #ffffff;
    font-size: 22rpx;
    font-weight: 700;
    text-align: center;
  }
  .error-text {
    flex: 1;
    font-size: 24rpx;
    color: $expired;
  }
}

/* 提交按钮 */
.submit {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  margin-top: 12rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-deep 100%);
  box-shadow: 0 12rpx 28rpx rgba(7, 193, 96, 0.32);
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 2rpx;
  &::after {
    border: none;
  }
  &:active {
    opacity: 0.9;
  }
  &.disabled {
    opacity: 0.65;
  }
  .spinner {
    width: 28rpx;
    height: 28rpx;
    margin-right: 14rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .submit-text {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.footnote {
  display: block;
  margin-top: 28rpx;
  text-align: center;
  font-size: 22rpx;
  line-height: 1.6;
  color: $text-sub;
}
</style>
