<template>
  <view class="page">
    <NavBar title="过期日历" />

    <!-- 月份切换 -->
    <view class="month-bar">
      <text class="arrow" @tap="changeMonth(-1)">‹</text>
      <text class="month">{{ year }} 年 {{ month + 1 }} 月</text>
      <text class="arrow" @tap="changeMonth(1)">›</text>
    </view>

    <!-- 星期头 -->
    <view class="week-row">
      <text v-for="w in weeks" :key="w" class="week-cell">{{ w }}</text>
    </view>

    <!-- 日期网格 -->
    <view class="grid">
      <view v-for="(cell, i) in cells" :key="i" class="cell" @tap="select(cell)">
        <text v-if="cell.day" class="day" :class="{ today: cell.isToday, selected: selected === cell.date }">
          {{ cell.day }}
        </text>
        <view v-if="cell.dots.length" class="dots">
          <view
            v-for="(d, j) in cell.dots.slice(0, 4)"
            :key="j"
            class="dot"
            :class="{ eaten: d.eaten }"
            :style="d.eaten ? {} : { background: d.color }"
          />
        </view>
      </view>
    </view>

    <!-- 图例 -->
    <view class="legend">
      <view class="legend-item"><view class="dot legend-dot" :style="{ background: '#22c55e' }" /><text>在库（按新鲜度配色）</text></view>
      <view class="legend-item"><view class="dot legend-dot eaten" /><text>已吃完</text></view>
    </view>

    <!-- 选中日列表 -->
    <view class="day-list">
      <view class="day-list-head">
        <text>{{ selected }} 过期的食品</text>
        <text class="count" v-if="selectedFoods.length">{{ selectedFoods.length }} 件</text>
      </view>
      <view class="filter-row">
        <view
          v-for="f in statusFilters"
          :key="f.key"
          class="filter-chip"
          :class="{ active: statusFilter === f.key }"
          @tap="statusFilter = f.key"
        >
          {{ f.label }}
        </view>
      </view>
      <view v-for="f in selectedFoods" :key="f.id" class="cal-item">
        <view v-if="f.status === 'eaten'" class="eaten-badge">已吃完</view>
        <FoodCard :food="f" :class="{ dimmed: f.status === 'eaten' }" @tap="goDetail(f)" />
      </view>
      <view v-if="!selectedFoods.length" class="empty">
        <text>{{ statusFilter === 'all' ? '该日期无过期食品 ✓' : '该筛选条件下无记录' }}</text>
      </view>
    </view>

    <TabBar current="calendar" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../utils/request.js'
import { freshness, FRESHNESS_COLOR } from '../../utils/date.js'
import FoodCard from '../../components/FoodCard.vue'
import TabBar from '../../components/TabBar.vue'
import NavBar from '../../components/NavBar.vue'

const weeks = ['日', '一', '二', '三', '四', '五', '六']
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth())
const selected = ref(new Date().toISOString().slice(0, 10))
const foods = ref([])
const statusFilter = ref('all')
const statusFilters = [
  { key: 'all', label: '全部' },
  { key: 'stock', label: '在库' },
  { key: 'eaten', label: '已吃完' }
]

const expireMap = computed(() => {
  const map = {}
  for (const f of foods.value) {
    (map[f.expire_date] = map[f.expire_date] || []).push(f)
  }
  return map
})

const cells = computed(() => {
  const first = new Date(year.value, month.value, 1)
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)
  const list = []
  for (let i = 0; i < first.getDay(); i++) list.push({ day: 0, dots: [] })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year.value}-${String(month.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const items = expireMap.value[date] || []
    const dotMap = {}
    for (const f of items) {
      const key = f.status === 'eaten' ? 'eaten' : FRESHNESS_COLOR[freshness(f.expire_date)]
      dotMap[key] = dotMap[key] || { color: FRESHNESS_COLOR[freshness(f.expire_date)], eaten: f.status === 'eaten' }
    }
    list.push({ day: d, date, isToday: date === todayStr, dots: Object.values(dotMap) })
  }
  return list
})

const selectedFoods = computed(() =>
  (expireMap.value[selected.value] || []).filter(
    f => statusFilter.value === 'all' || f.status === statusFilter.value
  )
)

function changeMonth(delta) {
  let m = month.value + delta
  let y = year.value
  if (m < 0) { m = 11; y-- }
  if (m > 11) { m = 0; y++ }
  year.value = y
  month.value = m
}
function select(cell) {
  if (cell.day) selected.value = cell.date
}
function goDetail(f) {
  uni.navigateTo({ url: `/pages/detail/index?id=${f.id}` })
}

onShow(async () => {
  try {
    foods.value = await api('/foods?status=all')
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 160rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60rpx;
  margin-bottom: 16rpx;
  .month {
    font-size: 34rpx;
    font-weight: 700;
  }
  .arrow {
    font-size: 44rpx;
    color: $primary;
    padding: 0 20rpx;
  }
}
.week-row {
  display: flex;
  .week-cell {
    flex: 1;
    text-align: center;
    font-size: 22rpx;
    color: $text-sub;
  }
}
.grid {
  display: flex;
  flex-wrap: wrap;
  background: $card-bg;
  border-radius: $radius;
  box-shadow: $card-shadow;
  padding: 12rpx 0;
  margin-bottom: 28rpx;
}
.cell {
  width: 14.28%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10rpx 0;
  min-height: 88rpx;
  .day {
    font-size: 26rpx;
    color: $text-main;
    width: 56rpx;
    height: 56rpx;
    line-height: 56rpx;
    text-align: center;
    border-radius: 50%;
  }
  .today {
    background: $primary;
    color: #fff;
    font-weight: 700;
  }
  .selected {
    box-shadow: 0 0 0 3rpx $primary-light inset;
  }
  .dots {
    display: flex;
    gap: 6rpx;
    margin-top: 4rpx;
  }
  .dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    border: 3rpx solid transparent;
    box-sizing: border-box;
    &.eaten {
      background: transparent !important;
      border-color: #c9d4cf;
    }
  }
}
.legend {
  display: flex;
  gap: 32rpx;
  margin-bottom: 20rpx;
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 20rpx;
    color: $text-sub;
  }
  .legend-dot {
    width: 14rpx;
    height: 14rpx;
  }
}
.filter-row {
  display: flex;
  gap: 14rpx;
  margin-bottom: 16rpx;
}
.filter-chip {
  padding: 8rpx 24rpx;
  border-radius: 30rpx;
  background: $card-bg;
  font-size: 22rpx;
  color: $text-sub;
  box-shadow: $card-shadow;
  &.active {
    background: linear-gradient(135deg, $primary, $primary-deep);
    color: #fff;
    font-weight: 600;
  }
}
.cal-item {
  position: relative;
  .eaten-badge {
    position: absolute;
    top: -8rpx;
    right: 16rpx;
    z-index: 2;
    background: #c9d4cf;
    color: #fff;
    font-size: 20rpx;
    padding: 4rpx 14rpx;
    border-radius: 16rpx;
  }
  :deep(.food-card.dimmed) {
    opacity: 0.55;
  }
}
.day-list {
  .day-list-head {
    display: flex;
    justify-content: space-between;
    font-size: 28rpx;
    font-weight: 600;
    margin-bottom: 16rpx;
    .count { color: $text-sub; font-weight: 400; font-size: 24rpx; }
  }
}
.empty {
  text-align: center;
  color: $text-sub;
  padding: 60rpx 0;
  font-size: 26rpx;
}
</style>
