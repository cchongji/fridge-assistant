<script setup lang="ts">
import { computed } from 'vue'
import { fuzzyFoods } from '@/api/foods'
import type { Category, FuzzyItem } from '@/api/types'
import { getToken } from '@/utils/storage'

const props = withDefaults(
  defineProps<{
    modelValue: string
    category?: Category
    placeholder?: string
  }>(),
  { placeholder: '输入名称，自动联想保质期' }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [item: FuzzyItem]
}>()

const value = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

type SuggestItem = FuzzyItem & { value: string }

async function query(q: string, cb: (items: SuggestItem[]) => void) {
  const keyword = q.trim()
  // 联想为非关键请求：未登录直接跳过
  if (!keyword || !getToken()) return cb([])
  try {
    const { items } = await fuzzyFoods(keyword, props.category)
    cb(items.map(i => ({ ...i, value: i.name })))
  } catch {
    cb([])
  }
}

function onSelect(item: Record<string, unknown>) {
  const selected = item as unknown as FuzzyItem
  emit('select', { name: selected.name, category: selected.category, days: selected.days })
}

const CATEGORY_LABEL: Record<Category, string> = {
  refrigerated: '冷藏',
  frozen: '冷冻',
  ambient: '常温'
}
</script>

<template>
  <el-autocomplete
    v-model="value"
    :fetch-suggestions="query"
    :placeholder="placeholder"
    clearable
    :trigger-on-focus="false"
    value-key="value"
    class="food-suggest"
    @select="onSelect"
  >
    <template #default="{ item }">
      <div class="food-suggest__item">
        <span class="food-suggest__name">{{ item.name }}</span>
        <span class="food-suggest__meta">
          {{ CATEGORY_LABEL[(item.category as Category) || 'refrigerated'] }} · {{ item.days }} 天
        </span>
      </div>
    </template>
  </el-autocomplete>
</template>

<style scoped lang="scss">
.food-suggest {
  width: 100%;
}

.food-suggest__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  line-height: 1.4;
}

.food-suggest__name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.food-suggest__meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
