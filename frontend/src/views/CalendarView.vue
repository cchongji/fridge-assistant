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

const cellKey = (date: Date) => toDateString(date)

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
        <span class="legend__item"><i class="legend__dot legend__dot--eaten" />已吃完</span>
      </div>
    </div>

    <el-card v-loading="loading" shadow="never">
      <el-calendar v-model="selectedDate">
        <template #date-cell="{ data }">
          <div class="cell" :class="{ 'is-today': cellKey(data.date) === cellKey(new Date()) }">
            <span class="cell__day">{{ data.day.split('-')[2] }}</span>
            <span class="cell__dots">
              <i
                v-for="(d, i) in dotsOf(cellKey(data.date))"
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

.legend__dot--eaten {
  background: transparent;
  border: 1.5px solid var(--el-border-color-darker);
}

.cell {
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
}

.cell__dots {
  display: flex;
  gap: 3px;
  height: 6px;
}

.cell__dot {
  width: 6px;
  height: 6px;
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
}
</style>
