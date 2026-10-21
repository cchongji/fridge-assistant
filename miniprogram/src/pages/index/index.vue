<template>
  <view class="page">
    <!-- 顶部统计条 -->
    <view class="stat-bar">
      <view class="stat-pill">
        <text class="num">{{ stats.inStock }}</text>
        <text class="label">在库</text>
      </view>
      <view class="stat-pill warn">
        <text class="num">{{ stats.todayExpire }}</text>
        <text class="label">今日过期</text>
      </view>
      <view class="stat-pill urgent">
        <text class="num">{{ stats.soonExpire }}</text>
        <text class="label">3天内临期</text>
      </view>
    </view>

    <!-- 分区筛选 -->
    <scroll-view scroll-x class="cate-scroll">
      <view class="cate-row">
        <view
          v-for="c in categories"
          :key="c.key"
          class="cate-chip"
          :class="{ active: currentCate === c.key }"
          @tap="currentCate = c.key"
        >
          {{ c.icon }} {{ c.label }}
        </view>
      </view>
    </scroll-view>

    <!-- 食品列表 -->
    <view class="list">
      <FoodCard
        v-for="f in filteredFoods"
        :key="f.id"
        :food="f"
        :total-days="totalDaysOf(f)"
        @tap="goDetail(f)"
      />
      <view v-if="!filteredFoods.length" class="empty">
        <text class="empty-icon">🧊</text>
        <text class="empty-text">{{ currentCate === 'all' ? '冰箱空空如也' : '该分区暂无食品' }}</text>
        <button class="empty-btn" @tap="goAdd">拍一张，添加食品</button>
      </view>
    </view>

    <TabBar current="home" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { api } from '../../utils/request.js'
import { daysLeft } from '../../utils/date.js'
import FoodCard from '../../components/FoodCard.vue'
import TabBar from '../../components/TabBar.vue'

const foods = ref([])
const currentCate = ref('all')
const categories = [
  { key: 'all', icon: '🍽️', label: '全部' },
  { key: 'refrigerated', icon: '🧊', label: '冷藏' },
  { key: 'frozen', icon: '❄️', label: '冷冻' },
  { key: 'ambient', icon: '🥫', label: '常温' }
]

const stats = computed(() => {
  const stock = foods.value
  return {
    inStock: stock.length,
    todayExpire: stock.filter(f => daysLeft(f.expire_date) === 0).length,
    soonExpire: stock.filter(f => {
      const d = daysLeft(f.expire_date)
      return d >= 1 && d <= 3
    }).length
  }
})

const filteredFoods = computed(() =>
  currentCate.value === 'all'
    ? foods.value
    : foods.value.filter(f => f.category === currentCate.value)
)

async function load() {
  try {
    foods.value = await api('/foods')
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

function totalDaysOf(f) {
  const added = new Date(f.added_at)
  const expire = new Date(f.expire_date)
  return Math.max(1, Math.round((expire - added) / 86400000))
}

function goDetail(f) {
  uni.navigateTo({ url: `/pages/detail/index?id=${f.id}` })
}
function goAdd() {
  uni.navigateTo({ url: '/pages/add/index' })
}

onShow(load)
onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 160rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.stat-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.stat-pill {
  flex: 1;
  background: $card-bg;
  border-radius: 20rpx;
  padding: 20rpx 0;
  text-align: center;
  box-shadow: $card-shadow;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  .num {
    font-size: 40rpx;
    font-weight: 700;
    color: $fresh;
  }
  .label {
    font-size: 22rpx;
    color: $text-sub;
  }
  &.warn .num {
    color: $urgent;
  }
  &.urgent .num {
    color: $expired;
  }
}
.cate-scroll {
  white-space: nowrap;
  margin-bottom: 24rpx;
}
.cate-row {
  display: inline-flex;
  gap: 14rpx;
}
.cate-chip {
  display: inline-block;
  padding: 12rpx 28rpx;
  border-radius: 40rpx;
  background: $card-bg;
  font-size: 24rpx;
  color: $text-sub;
  box-shadow: $card-shadow;
  transition: all 0.2s;
  &.active {
    background: linear-gradient(135deg, $primary, $primary-deep);
    color: #fff;
    font-weight: 600;
  }
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
  gap: 16rpx;
  .empty-icon {
    font-size: 100rpx;
  }
  .empty-text {
    color: $text-sub;
    font-size: 26rpx;
  }
  .empty-btn {
    margin-top: 16rpx;
    background: linear-gradient(135deg, $primary, $primary-deep);
    color: #fff;
    border-radius: 44rpx;
    font-size: 28rpx;
    padding: 0 48rpx;
  }
}
</style>
