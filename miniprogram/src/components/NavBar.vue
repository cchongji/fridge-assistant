<template>
  <view class="navbar">
    <text class="title">{{ title }}</text>
    <view v-if="hasToken" class="logout" @tap="confirmLogout">
      <text class="logout-text">退出登录</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { logout } from '../utils/request.js'

const props = defineProps({ title: { type: String, default: '' } })
const hasToken = ref(false)

onMounted(() => {
  hasToken.value = !!uni.getStorageSync('token')
})

function confirmLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    confirmText: '退出',
    cancelText: '取消',
    success: r => {
      if (r.confirm) logout()
    }
  })
}
</script>

<style lang="scss" scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 28rpx;
  background: #ffffff;
  border-bottom: 2rpx solid #eef2f0;
}
.title {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-main;
}
.logout {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background: $bg;
  &:active {
    opacity: 0.85;
  }
  .logout-text {
    font-size: 24rpx;
    color: $text-sub;
  }
}
</style>
