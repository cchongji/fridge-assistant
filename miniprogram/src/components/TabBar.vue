<template>
  <view class="tabbar">
    <view
      v-for="t in tabs"
      :key="t.key"
      class="tab-item"
      :class="{ active: current === t.key }"
      @tap="go(t)"
    >
      <text class="icon">{{ t.icon }}</text>
      <text class="label">{{ t.label }}</text>
    </view>
    <view class="fab" @tap="goAdd">
      <text class="fab-icon">＋</text>
      <text class="fab-label">扫描添加</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({ current: { type: String, default: 'home' } })
const tabs = [
  { key: 'home', icon: '🧊', label: '冰箱', url: '/pages/index/index' },
  { key: 'calendar', icon: '📅', label: '日历', url: '/pages/calendar/index' },
  { key: 'stats', icon: '📊', label: '统计', url: '/pages/stats/index' }
]

function go(t) {
  if (props.current === t.key) return
  uni.redirectTo({ url: t.url })
}
function goAdd() {
  uni.navigateTo({ url: '/pages/add/index' })
}
</script>

<style lang="scss" scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 -4rpx 20rpx rgba(31, 45, 43, 0.08);
  display: flex;
  align-items: stretch;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  .icon {
    font-size: 40rpx;
  }
  .label {
    font-size: 20rpx;
    color: $text-sub;
  }
  &.active .label {
    color: $primary;
    font-weight: 600;
  }
}
.fab {
  width: 170rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 12rpx 20rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, $primary, $primary-deep);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(7, 193, 96, 0.35);
  &:active {
    opacity: 0.9;
  }
  .fab-icon {
    font-size: 36rpx;
    font-weight: 700;
    line-height: 1;
  }
  .fab-label {
    font-size: 20rpx;
    margin-top: 4rpx;
  }
}
</style>
