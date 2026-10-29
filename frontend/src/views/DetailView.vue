<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Delete, Edit, RefreshLeft, Select } from '@element-plus/icons-vue'
import { eatFood, listFoods, removeFood, updateFood } from '@/api/foods'
import type { Category, Food } from '@/api/types'
import { FRESHNESS_COLOR, daysLeft, daysLeftText, freshness } from '@/utils/date'

const route = useRoute()
const router = useRouter()

const food = ref<Food | null>(null)
const loading = ref(false)
const editing = ref(false)
const saving = ref(false)

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'refrigerated', label: '冷藏' },
  { value: 'frozen', label: '冷冻' },
  { value: 'ambient', label: '常温' }
]
const categoryLabel = (c: Category) => CATEGORIES.find(i => i.value === c)?.label || '冷藏'

const STATUS_LABEL: Record<Food['status'], string> = { stock: '在库', eaten: '已吃完', expired: '已过期' }

const edit = reactive({
  name: '',
  category: 'refrigerated' as Category,
  quantity: 1,
  expireDate: '',
  openedDate: '',
  note: ''
})

const state = computed(() => (food.value ? freshness(food.value.expire_date) : 'fresh'))
const heroColor = computed(() => FRESHNESS_COLOR[state.value])
const daysText = computed(() => (food.value ? daysLeftText(food.value.expire_date) : ''))
const isStock = computed(() => food.value?.status === 'stock')

async function load() {
  loading.value = true
  try {
    const all = await listFoods({ status: 'all' })
    const id = Number(route.params.id)
    food.value = all.find(f => f.id === id) || null
    if (!food.value) ElMessage.warning('食品不存在')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function startEdit() {
  if (!food.value) return
  Object.assign(edit, {
    name: food.value.name,
    category: food.value.category,
    quantity: food.value.quantity,
    expireDate: food.value.expire_date,
    openedDate: food.value.opened_date || '',
    note: food.value.note || ''
  })
  editing.value = true
}

async function save() {
  if (!food.value) return
  if (!edit.name.trim()) return ElMessage.warning('名称不能为空')
  if (!edit.expireDate) return ElMessage.warning('请选择过期日期')
  saving.value = true
  try {
    food.value = await updateFood(food.value.id, {
      name: edit.name.trim(),
      category: edit.category,
      quantity: edit.quantity || 1,
      expireDate: edit.expireDate,
      openedDate: edit.openedDate || null,
      note: edit.note
    })
    editing.value = false
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

async function markEaten() {
  if (!food.value) return
  try {
    await eatFood(food.value.id)
    ElMessage.success('已标记吃完')
    router.push('/')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function restore() {
  if (!food.value) return
  try {
    food.value = await updateFood(food.value.id, { status: 'stock' })
    ElMessage.success('已恢复在库')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function remove() {
  if (!food.value) return
  try {
    await ElMessageBox.confirm(`确定删除「${food.value.name}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await removeFood(food.value.id)
    ElMessage.success('已删除')
    router.push('/')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="app-page" v-loading="loading">
    <div class="app-page__head">
      <el-button :icon="Back" @click="router.push('/')">返回</el-button>
      <el-tag v-if="food" :type="isStock ? 'success' : 'info'" effect="plain">
        {{ STATUS_LABEL[food.status] }}
      </el-tag>
    </div>

    <template v-if="food">
      <div class="hero" :style="{ background: `linear-gradient(135deg, ${heroColor}, ${heroColor}cc)` }">
        <div>
          <div class="hero__name">{{ food.name }}</div>
          <div class="hero__sub">{{ food.expire_date }} 到期 · {{ categoryLabel(food.category) }}</div>
        </div>
        <div class="hero__days">{{ daysText }}</div>
      </div>

      <el-card v-if="!editing" shadow="never">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="录入时间">{{ food.added_at }}</el-descriptions-item>
          <el-descriptions-item label="数量">{{ food.quantity }}{{ food.unit }}</el-descriptions-item>
          <el-descriptions-item label="开封日期">{{ food.opened_date || '未开封' }}</el-descriptions-item>
          <el-descriptions-item label="剩余天数">{{ daysLeft(food.expire_date) }} 天</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ food.note || '—' }}</el-descriptions-item>
        </el-descriptions>

        <div class="actions mt-16">
          <template v-if="isStock">
            <el-button :icon="Edit" @click="startEdit">编辑</el-button>
            <el-button type="success" :icon="Select" @click="markEaten">吃完了</el-button>
            <el-button type="danger" plain :icon="Delete" @click="remove">删除</el-button>
          </template>
          <template v-else>
            <el-button :icon="RefreshLeft" @click="restore">恢复在库</el-button>
            <el-button type="danger" plain :icon="Delete" @click="remove">删除</el-button>
          </template>
        </div>
      </el-card>

      <el-card v-else shadow="never">
        <el-form label-width="88px" label-position="left">
          <el-form-item label="名称">
            <el-input v-model="edit.name" maxlength="40" />
          </el-form-item>
          <el-form-item label="分区">
            <el-select v-model="edit.category" style="width: 200px">
              <el-option v-for="c in CATEGORIES" :key="c.value" :label="c.label" :value="c.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="数量">
            <el-input-number v-model="edit.quantity" :min="1" :max="99" />
          </el-form-item>
          <el-form-item label="过期日期">
            <el-date-picker v-model="edit.expireDate" type="date" value-format="YYYY-MM-DD" style="width: 200px" />
          </el-form-item>
          <el-form-item label="开封日期">
            <el-date-picker
              v-model="edit.openedDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="未开封"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="edit.note" type="textarea" :rows="2" maxlength="200" show-word-limit />
          </el-form-item>
          <el-form-item>
            <el-button @click="editing = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </template>

    <el-empty v-else-if="!loading" description="食品不存在或已被删除" />
  </div>
</template>

<style scoped lang="scss">
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  border-radius: 10px;
  color: #fff;
  margin-bottom: 16px;
}

.hero__name {
  font-size: 20px;
  font-weight: 700;
}

.hero__sub {
  margin-top: 6px;
  font-size: 13px;
  opacity: 0.92;
}

.hero__days {
  font-size: 24px;
  font-weight: 800;
  white-space: nowrap;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .hero__days {
    font-size: 18px;
  }

  :deep(.el-descriptions__body .el-descriptions__table) {
    table-layout: auto;
  }
}
</style>
