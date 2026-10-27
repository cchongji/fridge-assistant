<template>
  <view class="page">
    <NavBar title="统计与设置" />

    <!-- 本月统计 -->
    <view class="card">
      <view class="card-title">本月统计（{{ stats.month }}）</view>
      <view class="bar-wrap">
        <view class="bar-row">
          <text class="bar-label">😋 吃掉</text>
          <view class="bar-bg">
            <view class="bar green" :style="{ width: pct(stats.eaten) }" />
          </view>
          <text class="bar-num">{{ stats.eaten }}</text>
        </view>
        <view class="bar-row">
          <text class="bar-label">🗑️ 浪费</text>
          <view class="bar-bg">
            <view class="bar red" :style="{ width: pct(stats.expired) }" />
          </view>
          <text class="bar-num">{{ stats.expired }}</text>
        </view>
      </view>
      <view class="summary">
        <text v-if="stats.eaten + stats.expired === 0">本月暂无消耗记录</text>
        <text v-else-if="stats.expired === 0">零浪费！全部吃光，太棒了 🎉</text>
        <text v-else>节约提示：减少囤货、先吃临期食品</text>
      </view>
    </view>

    <!-- 提醒配置 -->
    <view class="card">
      <view class="card-title">提醒设置</view>
      <view class="switch-row" v-for="opt in remindOptions" :key="opt.key">
        <text class="switch-label">{{ opt.label }}</text>
        <switch :checked="remind[opt.key]" color="#07C160" @change="e => toggleRemind(opt.key, e)" />
      </view>
      <button class="sub-btn" @tap="requestSubscribe" v-if="isWeixin">
        🔔 开启微信提醒（订阅消息授权）
      </button>
      <text class="hint" v-if="isWeixin">微信订阅消息为一次性授权，每次收到提醒后需重新授权</text>
    </view>

    <!-- 账号 -->
    <view class="card">
      <view class="card-title">账号</view>
      <view class="account-row">
        <text class="account-name">{{ me.nickname || me.username || '未登录' }}</text>
      </view>
      <view class="account-email" v-if="me.username">
        <text class="email-label">绑定邮箱</text>
        <text class="email-value" :class="{ empty: !me.email }">{{ me.email || '未绑定' }}</text>
      </view>
      <input
        v-if="me.username"
        class="email-input"
        type="text"
        :value="emailDraft"
        @input="onEmailInput"
        placeholder="输入新邮箱，点击保存即可修改绑定邮箱"
        placeholder-class="ph"
        maxlength="64"
        :adjust-position="true"
      />
      <view class="action-row">
        <button class="act-btn ghost" @tap="saveEmail">💾 保存邮箱</button>
        <button class="act-btn ghost" @tap="testEmail">📮 发测试邮件</button>
      </view>
      <text class="hint">
        提醒邮件由服务端邮箱（switch_wula_cc_bx@163.com）发送到该邮箱；邮箱为空时不会发送任何邮件提醒
      </text>
    </view>

    <!-- 数据管理 -->
    <view class="card">
      <view class="card-title">数据管理</view>
      <view class="action-row">
        <button class="act-btn ghost" @tap="doExport">⬇️ 导出数据</button>
        <button class="act-btn ghost" @tap="doImport">⬆️ 导入数据</button>
      </view>
      <view class="action-row">
        <button class="act-btn ghost" @tap="manualScan">🧪 立即扫描提醒</button>
      </view>
    </view>

    <TabBar current="stats" />
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../utils/request.js'
import TabBar from '../../components/TabBar.vue'
import NavBar from '../../components/NavBar.vue'

const me = reactive({ username: '', nickname: '', email: '' })
const emailDraft = ref('')

const onEmailInput = e => {
  emailDraft.value = e.detail.value
}

const stats = reactive({ month: '', eaten: 0, expired: 0, inStock: 0 })
const remind = reactive({ d3: true, d1: true, d0: true, expired: true })
const remindOptions = [
  { key: 'd3', label: '提前 3 天提醒' },
  { key: 'd1', label: '提前 1 天提醒' },
  { key: 'd0', label: '过期当天提醒' },
  { key: 'expired', label: '过期后持续提醒' }
]
// #ifdef MP-WEIXIN
const isWeixin = ref(true)
// #endif
// #ifndef MP-WEIXIN
const isWeixin = ref(false)
// #endif

const pct = n => Math.min(100, (n / Math.max(stats.eaten + stats.expired, 1)) * 100) + '%'
const emailValid = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

async function load() {
  try {
    Object.assign(stats, await api('/stats/monthly'))
    const s = await api('/settings')
    Object.assign(remind, s.remind)
    const u = await api('/auth/me')
    Object.assign(me, { username: u.username || '', nickname: u.nickname || '', email: u.email || '' })
    emailDraft.value = me.email
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}



async function toggleRemind(key, e) {
  remind[key] = e.detail.value
  try {
    await api('/settings', { method: 'PUT', data: { remind: { ...remind } } })
  } catch (err) {
    uni.showToast({ title: err.message, icon: 'none' })
  }
}

async function saveEmail() {
  const email = String(emailDraft.value || '').trim()
  if (!emailValid(email)) {
    return uni.showToast({ title: '邮箱格式不正确', icon: 'none' })
  }
  try {
    await api('/auth/me', { method: 'PUT', data: { email } })
    me.email = email
    emailDraft.value = email
    uni.showToast({ title: email ? '邮箱已保存' : '已清除邮箱', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function testEmail() {
  try {
    const r = await api('/remind/test-email', { method: 'POST' })
    uni.showToast({ title: `已发送至 ${r.to}`, icon: 'success' })
  } catch (e) {
    console.log(e.message)
    uni.showToast({ title: e.message, icon: 'none', duration: 3000 })
  }
}

function requestSubscribe() {
  const tmplId = import.meta.env?.VITE_WX_TMPL_ID || ''
  // #ifdef MP-WEIXIN
  uni.requestSubscribeMessage({
    tmplIds: tmplId ? [tmplId] : [],
    complete: res => {
      uni.showToast({ title: tmplId ? '已发起订阅' : '请先在后端配置订阅模板ID', icon: 'none' })
    }
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: 'H5 环境不支持订阅消息', icon: 'none' })
  // #endif
}

function doExport() {
  api('/export').then(data => {
    // #ifdef H5
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fridge-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    // #endif
    // #ifndef H5
    uni.setClipboardData({
      data: JSON.stringify(data),
      success: () => uni.showToast({ title: '备份 JSON 已复制到剪贴板', icon: 'none' })
    })
    // #endif
  })
}

function doImport() {
  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const text = await input.files[0].text()
    try {
      const r = await api('/import', { method: 'POST', data: JSON.parse(text) })
      uni.showToast({ title: `导入 ${r.imported} 件 ✓`, icon: 'success' })
    } catch (e) {
      uni.showToast({ title: e.message, icon: 'none' })
    }
  }
  input.click()
  // #endif
  // #ifndef H5
  uni.showToast({ title: '小程序端请粘贴 JSON 到后端 /api/import', icon: 'none' })
  // #endif
}

async function manualScan() {
  try {
    const r = await api('/remind/scan', { method: 'POST' })
    const lines = [`扫描在库 ${r.scanned} 件，命中提醒 ${r.matched} 条，成功发送 ${r.sent} 条`]
    if (r.skipped?.length) {
      const uniq = [...new Set(r.skipped.map(s => s.reason))]
      lines.push('', '未发送原因：', ...uniq.slice(0, 3).map(s => `· ${s}`))
    }
    if (r.matched === 0) lines.push('', '（今天没有到期/临期食品，或提醒开关已关闭）')
    uni.showModal({ title: '扫描结果', content: lines.join('\n'), showCancel: false })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

onShow(load)
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 160rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.card {
  background: $card-bg;
  border-radius: $radius;
  box-shadow: $card-shadow;
  padding: 28rpx;
  margin-bottom: 24rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}
.bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.bar-label {
  width: 140rpx;
  font-size: 24rpx;
  color: $text-sub;
}
.bar-bg {
  flex: 1;
  height: 22rpx;
  background: #eef2f0;
  border-radius: 12rpx;
  overflow: hidden;
}
.bar {
  height: 100%;
  border-radius: 12rpx;
  transition: width 0.4s ease;
  &.green { background: linear-gradient(90deg, $fresh, $primary-deep); }
  &.red { background: linear-gradient(90deg, #f87171, $expired); }
}
.bar-num {
  width: 50rpx;
  text-align: right;
  font-weight: 700;
}
.summary {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: $text-sub;
  background: $bg;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}
.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  .switch-label { font-size: 27rpx; }
}
.sub-btn {
  margin-top: 20rpx;
  background: linear-gradient(135deg, $primary, $primary-deep);
  color: #fff;
  border-radius: 20rpx;
  font-size: 27rpx;
}
.hint {
  display: block;
  margin-top: 14rpx;
  font-size: 20rpx;
  color: $text-sub;
  line-height: 1.6;
}
.action-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.act-btn {
  flex: 1;
  border-radius: 20rpx;
  font-size: 26rpx;
  &.ghost {
    background: $bg;
    color: $text-main;
  }
}
.email-input {
  width: 100%;
  height: 88rpx;
  box-sizing: border-box;
  background: $bg;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 27rpx;
  color: $text-main;
}
.account-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  .account-name {
    font-size: 30rpx;
    font-weight: 600;
    color: $text-main;
  }
  .account-sub {
    font-size: 24rpx;
    color: $text-sub;
  }
}
.account-email {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 16rpx;
  padding: 14rpx 20rpx;
  background: $bg;
  border-radius: 12rpx;
  .email-label {
    font-size: 24rpx;
    color: $text-sub;
    flex-shrink: 0;
  }
  .email-value {
    font-size: 26rpx;
    color: $text-main;
    word-break: break-all;
    &.empty {
      color: $text-sub;
    }
  }
}
</style>
