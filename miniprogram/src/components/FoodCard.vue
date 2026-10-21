<template>
  <view class="food-card" :style="{ borderLeftColor: color }" @tap="$emit('tap')">
    <view class="left">
      <text class="name">{{ food.name }}</text>
      <text class="meta">
        {{ food.quantity }}{{ food.unit }} · {{ food.expire_date }} 过期
        <text v-if="food.opened_date" class="opened">· 已开封</text>
      </text>
    </view>
    <view class="right">
      <text class="days" :style="{ color }">{{ daysText }}</text>
      <view class="ring-outer">
        <view class="ring" :style="{ width: ringPct + '%', backgroundColor: color }" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { daysLeft, daysLeftText, freshness, FRESHNESS_COLOR } from '../utils/date.js'

const props = defineProps({
  food: { type: Object, required: true },
  /** 参考总时长（录入→过期）用于进度环 */
  totalDays: { type: Number, default: 0 }
})
defineEmits(['tap'])

const color = computed(() => FRESHNESS_COLOR[freshness(props.food.expire_date)])
const daysText = computed(() => daysLeftText(props.food.expire_date))
const ringPct = computed(() => {
  const d = daysLeft(props.food.expire_date)
  const total = props.totalDays || Math.max(d + 7, 7)
  return Math.max(4, Math.min(100, Math.round((Math.max(d, 0) / total) * 100)))
})
</script>

<style lang="scss" scoped>
.food-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $card-bg;
  border-radius: $radius;
  box-shadow: $card-shadow;
  border-left: 8rpx solid $fresh;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  transition: transform 0.15s ease;
  &:active {
    transform: scale(0.98);
  }
}
.left {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex: 1;
  overflow: hidden;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-main;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  font-size: 22rpx;
  color: $text-sub;
}
.opened {
  color: $soon;
}
.right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
  margin-left: 16rpx;
}
.days {
  font-size: 30rpx;
  font-weight: 700;
}
.ring-outer {
  width: 140rpx;
  height: 10rpx;
  background: #eef2f0;
  border-radius: 6rpx;
  overflow: hidden;
}
.ring {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}
</style>
