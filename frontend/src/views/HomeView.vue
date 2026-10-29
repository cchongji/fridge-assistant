<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import FoodCard from '@/components/FoodCard.vue'
import { listFoods } from '@/api/foods'
import type { Food } from '@/api/types'
import { daysLeft } from '@/utils/date'

const router = useRouter()
const foods = ref<Food[]>([])
const loading = ref(false)
const currentCate = ref<'all' | Food['category']>('all')

const categories = [
  { key: 'all', label: '全部' },
  { key: 'refrigerated', label: '冷藏' },
  { key: 'frozen', label: '冷冻' },
  { key: 'ambient', label: '常温' }
] as const

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
  currentCate.value === 'all' ? foods.value : foods.value.filter(f => f.category === currentCate.value)
)

function totalDaysOf(f: Food) {
  const added = new Date(f.added_at).getTime()
  const expire = new Date(f.expire_date).getTime()
  return Math.max(1, Math.round((expire - added) / 86400000))
}

async function load() {
  loading.value = true
  try {
    foods.value = await listFoods()
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
        <h2 class="app-page__title">我的冰箱</h2>
        <p class="app-page__desc">按过期时间升序排列，颜色越红越紧急</p>
      </div>
      <div class="flex-center">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="router.push('/add')">添加食品</el-button>
      </div>
    </div>

    <el-row :gutter="12" class="mb-16">
      <el-col :xs="8" :sm="8">
        <el-card shadow="never" class="stat">
          <el-statistic title="在库" :value="stats.inStock" />
        </el-card>
      </el-col>
      <el-col :xs="8" :sm="8">
        <el-card shadow="never" class="stat">
          <el-statistic title="今日过期" :value="stats.todayExpire" value-style="color: var(--el-color-warning)" />
        </el-card>
      </el-col>
      <el-col :xs="8" :sm="8">
        <el-card shadow="never" class="stat">
          <el-statistic title="3 天内临期" :value="stats.soonExpire" value-style="color: var(--el-color-danger)" />
        </el-card>
      </el-col>
    </el-row>

    <div class="filter mb-16">
      <el-radio-group v-model="currentCate" size="default">
        <el-radio-button v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</el-radio-button>
      </el-radio-group>
    </div>

    <div v-loading="loading" class="list">
      <template v-if="filteredFoods.length">
        <FoodCard
          v-for="f in filteredFoods"
          :key="f.id"
          :food="f"
          :total-days="totalDaysOf(f)"
          @click="router.push(`/food/${f.id}`)"
        />
      </template>
      <el-empty v-else :description="currentCate === 'all' ? '冰箱空空如也' : '该分区暂无食品'">
        <el-button type="primary" :icon="Plus" @click="router.push('/add')">去添加食品</el-button>
      </el-empty>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat {
  text-align: center;

  :deep(.el-statistic__head) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.filter {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.list {
  min-height: 200px;
}
</style>
