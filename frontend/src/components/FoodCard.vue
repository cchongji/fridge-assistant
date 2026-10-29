<script setup lang="ts">
import { computed } from 'vue'
import { Clock } from '@element-plus/icons-vue'
import type { Food } from '@/api/types'
import { FRESHNESS_COLOR, daysLeft, daysLeftText, freshness } from '@/utils/date'

const props = defineProps<{
  food: Food
  /** 参考总时长（录入→过期），用于进度条 */
  totalDays?: number
}>()

const state = computed(() => freshness(props.food.expire_date))
const color = computed(() => FRESHNESS_COLOR[state.value])
const daysText = computed(() => daysLeftText(props.food.expire_date))
const percent = computed(() => {
  const d = daysLeft(props.food.expire_date)
  const total = props.totalDays || Math.max(d + 7, 7)
  return Math.max(4, Math.min(100, Math.round((Math.max(d, 0) / total) * 100)))
})

const categoryLabel = computed(
  () => ({ refrigerated: '冷藏', frozen: '冷冻', ambient: '常温' })[props.food.category]
)
</script>

<template>
  <el-card class="food-card" shadow="hover" :body-style="{ padding: '14px 16px' }">
    <div class="food-card__row">
      <div class="food-card__main">
        <div class="food-card__title">
          <el-tag :color="color" effect="dark" size="small" class="food-card__dot" />
          <span class="food-card__name" :title="food.name">{{ food.name }}</span>
          <el-tag size="small" type="info" effect="plain">{{ categoryLabel }}</el-tag>
          <el-tag v-if="food.opened_date" size="small" type="warning" effect="plain">已开封</el-tag>
        </div>
        <div class="food-card__meta">
          <el-icon><Clock /></el-icon>
          <span>{{ food.quantity }}{{ food.unit }}</span>
          <el-divider direction="vertical" />
          <span>{{ food.expire_date }} 过期</span>
        </div>
        <el-progress :percentage="percent" :color="color" :show-text="false" :stroke-width="4" class="food-card__bar" />
      </div>
      <div class="food-card__days" :style="{ color }">{{ daysText }}</div>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.food-card {
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:hover {
    transform: translateY(-1px);
  }
}

.food-card__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.food-card__main {
  flex: 1;
  min-width: 0;
}

.food-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.food-card__dot {
  width: 6px;
  height: 6px;
  min-width: 6px;
  padding: 0;
  border: none;
  border-radius: 50%;
}

.food-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.food-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.food-card__bar {
  margin-top: 8px;
}

.food-card__days {
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
