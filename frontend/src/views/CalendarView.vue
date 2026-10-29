<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import FoodCard from '@/components/FoodCard.vue'
import { listFoods } from '@/api/foods'
import type { Food } from '@/api/types'
import { FRESHNESS_COLOR, freshness, toDateString } from '@/utils/date'

const router = useRouter()
const foods = ref<Food[]>([])
const loading = ref(false)
const selectedDate = ref<Date>(new Date())
const statusFilter = ref<'all' | 'stock' | 'eaten'>('all')

const statusFilters = [
  { key: 'all', label: '全部' },
  { key: 'stock', label: '在库' },
  { key: 'eaten', label: '已吃完' }
] as const

const expireMap = computed(() => {
  const map = new Map<string, Food[]>()
  for (const f of foods.value) {
    const list = map.get(f.expire_date) || []
    list.push(f)
    map.set(f.expire_date, list)
  }
  return map
})

const selectedStr = computed(() => toDateString(selectedDate.value))
const todayStr = computed(() => toDateString(new Date()))

const selectedFoods = computed(() =>
  (expireMap.value.get(selectedStr.value) || []).filter(
    f => statusFilter.value === 'all' || f.status === statusFilter.value
  )
)

/** 某天的圆点：在库按新鲜度配色，已吃完为灰色描边 */
function dotsOf(dateStr: string) {
  const items = expireMap.value.get(dateStr) || []
  const seen = new Map<string, { color: string; eaten: boolean }>()
  for (const f of items) {
    if (f.status === 'eaten') seen.set('eaten', { color: 'transparent', eaten: true })
    else {
      const color = FRESHNESS_COLOR[freshness(f.expire_date)]
      seen.set(color, { color, eaten: false })
    }
  }
  return [...seen.values()].slice(0, 4)
}

/** 某天仍未吃完的食品数量（含已过期与即将过期） */
function pendingCount(dateStr: string) {
  return (expireMap.value.get(dateStr) || []).filter(f => f.status !== 'eaten').length
}

/** 某天仍未吃完、且日期已过去的食品数量（已过期） */
function expiredCount(dateStr: string) {
  return dateStr < todayStr.value ? pendingCount(dateStr) : 0
}

function cellClass(dateStr: string) {
  const pending = pendingCount(dateStr)
  return {
    'is-today': dateStr === todayStr.value,
    'has-expired': expiredCount(dateStr) > 0,
    'has-upcoming': pending > 0 && !expiredCount(dateStr)
  }
}

async function load() {
  loading.value = true
  try {
    foods.value = await listFoods({ status: 'all' })
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="app-page">
    <div class="app-page__head">
      <div>
        <h2 class="app-page__title">过期日历</h2>
        <p class="app-page__desc">按过期日期聚合，点击日期查看当天食品</p>
      </div>
      <div class="legend">
        <span class="legend__item"><i class="legend__dot" :style="{ background: '#22c55e' }" />在库（按新鲜度配色）</span>
        <span class="legend__item"><i class="legend__dot" :style="{ background: '#ef4444' }" />已过期</span>
        <span class="legend__item"><i class="legend__dot legend__dot--today" />今天</span>
        <span class="legend__item"><i class="legend__dot legend__dot--eaten" />已吃完</span>
      </div>
    </div>

    <el-card v-loading="loading" shadow="never">
      <el-calendar v-model="selectedDate">
        <template #date-cell="{ data }">
          <div class="cell" :class="cellClass(data.day)">
            <span class="cell__day">{{ data.day.split('-')[2] }}</span>
            <span v-if="data.day === todayStr" class="cell__badge cell__badge--today">今天</span>
            <span v-else-if="expiredCount(data.day)" class="cell__badge">{{ expiredCount(data.day) }}</span>
            <span v-else-if="pendingCount(data.day)" class="cell__badge cell__badge--upcoming">
              {{ pendingCount(data.day) }}
            </span>
            <span class="cell__dots">
              <i
                v-for="(d, i) in dotsOf(data.day)"
                :key="i"
                class="cell__dot"
                :class="{ 'cell__dot--eaten': d.eaten }"
                :style="d.eaten ? {} : { background: d.color }"
              />
            </span>
          </div>
        </template>
      </el-calendar>
    </el-card>

    <el-card shadow="never" class="mt-16">
      <template #header>
        <div class="flex-between">
          <span>{{ selectedStr }} 过期的食品</span>
          <el-radio-group v-model="statusFilter" size="small">
            <el-radio-button v-for="f in statusFilters" :key="f.key" :value="f.key">{{ f.label }}</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <template v-if="selectedFoods.length">
        <div v-for="f in selectedFoods" :key="f.id" class="day-item">
          <el-tag v-if="f.status === 'eaten'" size="small" type="info" class="day-item__badge">已吃完</el-tag>
          <div :class="{ 'is-dimmed': f.status === 'eaten' }">
            <FoodCard :food="f" @click="router.push(`/food/${f.id}`)" />
          </div>
        </div>
      </template>
      <el-empty
        v-else
        :description="statusFilter === 'all' ? '该日期无过期食品' : '该筛选条件下无记录'"
        :image-size="90"
      />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.legend__dot--today {
  background: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}

.legend__dot--eaten {
  background: transparent;
  border: 1.5px solid var(--el-border-color-darker);
}

.cell {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.cell__day {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.cell.is-today .cell__day {
  color: var(--el-color-primary);
  font-weight: 700;
  font-size: 15px;
}

.cell.has-expired .cell__day {
  color: var(--el-color-danger);
  font-weight: 700;
}

/* 今天 / 过期件数角标 */
.cell__badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.cell__badge--today {
  background: var(--el-color-primary);
  font-size: 10px;
}

.cell__badge--upcoming {
  background: var(--el-color-primary);
  font-size: 10px;
}

/* 整格底色：用伪元素铺满单元格，避免只靠小圆点难以辨识 */
.cell::before {
  content: '';
  position: absolute;
  inset: -8px;
  z-index: 0;
  border-radius: 8px;
  background: transparent;
  pointer-events: none;
}

/* 有食品、尚未过期（含今天）：主色系底色 */
.cell.has-upcoming::before {
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 0 0 1.5px var(--el-color-primary-light-7);
}

/* 今天：更强的主色描边 */
.cell.is-today::before {
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 0 0 2px var(--el-color-primary);
}

/* 已过期：红色底色 + 红色描边 */
.cell.has-expired::before {
  background: var(--el-color-danger-light-9);
  box-shadow: inset 0 0 0 1.5px var(--el-color-danger-light-5);
}

.cell > span {
  position: relative;
  z-index: 1;
}

.cell__dots {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 8px;
}

.cell__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.cell__dot--eaten {
  background: transparent;
  border: 1px solid var(--el-border-color-darker);
}

.day-item {
  position: relative;
}

.day-item__badge {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 2;
}

.is-dimmed {
  opacity: 0.55;
}

@media (max-width: 767px) {
  .legend {
    display: none;
  }

  :deep(.el-calendar__body) {
    padding: 8px 0;
  }

  :deep(.el-calendar-table .el-calendar-day) {
    height: 44px;
    padding: 2px;
  }

  .cell::before {
    inset: -2px;
  }

  .cell__badge {
    min-width: 15px;
    height: 15px;
    padding: 0 4px;
    font-size: 10px;
    line-height: 15px;
  }
}
</style>
