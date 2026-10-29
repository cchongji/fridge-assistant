<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { Camera, MagicStick, Picture, Plus } from '@element-plus/icons-vue'
import FoodSuggest from '@/components/FoodSuggest.vue'
import { createFood, createFoods, suggestFood } from '@/api/foods'
import { recognizeImage } from '@/api/recognize'
import type { Category, FoodPayload, FuzzyItem } from '@/api/types'
import { addDays, addShelfLife, toDateString, SHELF_MAX } from '@/utils/date'
import type { ShelfLifeUnit } from '@/utils/date'

const router = useRouter()

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'refrigerated', label: '冷藏' },
  { value: 'frozen', label: '冷冻' },
  { value: 'ambient', label: '常温' }
]
const categoryLabel = (c: Category) => CATEGORIES.find(i => i.value === c)?.label || '冷藏'

/* ---------------- 常用模板 ---------------- */
const templates = [
  { icon: '🥛', name: '牛奶', days: 7 },
  { icon: '🥚', name: '鸡蛋', days: 30 },
  { icon: '🥟', name: '速冻水饺', days: 90 },
  { icon: '🍞', name: '面包', days: 5 },
  { icon: '🍶', name: '酸奶', days: 21 },
  { icon: '🥬', name: '绿叶菜', days: 3 },
  { icon: '🍅', name: '番茄', days: 7 },
  { icon: '🍖', name: '鲜肉(冷冻)', days: 180 }
]
const quickAdding = ref('')

function basePayload(patch: Partial<FoodPayload> & Pick<FoodPayload, 'name' | 'expireDate'>): FoodPayload {
  return {
    name: patch.name,
    category: patch.category || 'refrigerated',
    quantity: patch.quantity || 1,
    unit: patch.unit || '',
    addedAt: toDateString(new Date()),
    expireDate: patch.expireDate,
    openedDate: null,
    note: ''
  }
}

async function quickAdd(t: (typeof templates)[number]) {
  quickAdding.value = t.name
  try {
    await createFood(basePayload({ name: t.name, expireDate: addDays(t.days) }))
    ElMessage.success(`${t.name} 已入冰箱`)
    router.push('/')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    quickAdding.value = ''
  }
}

/* ---------------- 图片识别 ---------------- */
const recognizing = ref(false)
const confirmVisible = ref(false)
const saving = ref(false)
const engine = ref('')

interface ConfirmItem {
  name: string
  category: Category
  quantity: number
  productDate: string
  expireDate: string
  confidence?: number
  estimated?: boolean
  shelfAmount?: number
  shelfUnit: ShelfLifeUnit
}
const confirmItems = ref<ConfirmItem[]>([])

async function onFileChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return
  recognizing.value = true
  try {
    const data = await recognizeImage(raw)
    engine.value = 'CodeBuddy 视觉'
    confirmItems.value = (data.items || []).map(it => ({
      name: it.name,
      category: it.category || 'refrigerated',
      quantity: it.quantity || 1,
      productDate: it.productDate || '',
      // 过期日期缺失时，优先按「生产日期 + 保质期天数」推算
      expireDate:
        it.expireDate ||
        (it.productDate && it.shelfLifeDays ? addShelfLife(it.shelfLifeDays, 'day', it.productDate) : addDays(it.days || 7)),
      confidence: it.confidence,
      estimated: it.estimated === true,
      // 识别到（或 AI 建议）的保质期天数，预填到快捷保质期
      shelfAmount: it.shelfLifeDays && it.shelfLifeDays > 0 ? it.shelfLifeDays : undefined,
      shelfUnit: 'day' as ShelfLifeUnit
    }))
    if (!confirmItems.value.length) {
      ElMessage.warning('未识别出食品，请手动录入')
      return
    }
    confirmVisible.value = true
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    recognizing.value = false
  }
}

function onConfirmSelect(item: ConfirmItem, s: FuzzyItem) {
  item.category = s.category
  item.expireDate = addDays(s.days)
}

/** 确认弹窗内：输入快捷保质期后，按「生产日期 + 保质期」自动算出过期日期 */
function recalcExpire(item: ConfirmItem) {
  const amount = Number(item.shelfAmount)
  if (!Number.isFinite(amount) || amount <= 0) return
  // 切换单位后原数量可能超出上限，按当前单位收敛
  const n = Math.min(Math.round(amount), SHELF_MAX[item.shelfUnit])
  if (n !== amount) item.shelfAmount = n
  item.expireDate = addShelfLife(n, item.shelfUnit, item.productDate)
}

async function saveAll() {
  for (const item of confirmItems.value) {
    if (!item.name.trim()) return ElMessage.warning('名称不能为空')
    if (!item.expireDate) return ElMessage.warning('请选择过期日期')
  }
  saving.value = true
  try {
    await createFoods(
      confirmItems.value.map(it =>
        basePayload({
          name: it.name.trim(),
          category: it.category,
          quantity: it.quantity,
          expireDate: it.expireDate
        })
      )
    )
    ElMessage.success('已入冰箱')
    confirmVisible.value = false
    router.push('/')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

/* ---------------- 手动录入 ---------------- */
const manual = reactive({
  name: '',
  category: 'refrigerated' as Category,
  quantity: 1,
  expireDate: ''
})
const suggesting = ref(false)
const suggestTip = ref('')
const manualSaving = ref(false)

/* 自定义保质期：数量 + 单位（天/月/年） */
const shelfAmount = ref<number>()
const shelfUnit = ref<ShelfLifeUnit>('day')
const SHELF_UNIT_LABEL: Record<ShelfLifeUnit, string> = { day: '天', month: '个月', year: '年' }
const shelfMax = computed(() => SHELF_MAX[shelfUnit.value])

function applyShelfLife() {
  const amount = Number(shelfAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) return ElMessage.warning('请输入大于 0 的保质期')
  const n = Math.min(Math.round(amount), SHELF_MAX[shelfUnit.value])
  manual.expireDate = addShelfLife(n, shelfUnit.value)
  suggestTip.value = `按保质期 ${n} ${SHELF_UNIT_LABEL[shelfUnit.value]}计算：有效期至 ${manual.expireDate}`
}

function onManualSelect(s: FuzzyItem) {
  manual.category = s.category
  manual.expireDate = addDays(s.days)
  suggestTip.value = `已按词典填充：${s.name}，${categoryLabel(s.category)}建议 ${s.days} 天`
}

async function suggest() {
  if (!manual.name.trim()) return ElMessage.warning('请先填写食品名称')
  suggesting.value = true
  suggestTip.value = ''
  try {
    const r = await suggestFood(manual.name.trim(), manual.category)
    manual.expireDate = r.expireDate
    suggestTip.value = `AI 建议：${categoryLabel(manual.category)}约 ${r.days} 天（至 ${r.expireDate}）${r.tip ? '，' + r.tip : ''}`
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    suggesting.value = false
  }
}

async function saveManual() {
  if (!manual.name.trim()) return ElMessage.warning('请填写名称')
  if (!manual.expireDate) return ElMessage.warning('请选择过期日期')
  manualSaving.value = true
  try {
    await createFood(
      basePayload({
        name: manual.name.trim(),
        category: manual.category,
        quantity: manual.quantity,
        expireDate: manual.expireDate
      })
    )
    ElMessage.success('已入冰箱')
    router.push('/')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    manualSaving.value = false
  }
}

function resetManual() {
  Object.assign(manual, { name: '', category: 'refrigerated', quantity: 1, expireDate: '' })
  shelfAmount.value = undefined
  shelfUnit.value = 'day'
  suggestTip.value = ''
}
</script>

<template>
  <div class="app-page">
    <div class="app-page__head">
      <div>
        <h2 class="app-page__title">添加食品</h2>
        <p class="app-page__desc">拍照识别、选模板或手动录入，都会直接进入冰箱清单</p>
      </div>
      <el-button @click="router.push('/')">返回冰箱</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="24" :md="14">
        <el-card shadow="never" class="mb-16">
          <template #header>
            <div class="flex-between">
              <span>拍照识别</span>
              <el-tag size="small" type="info">AI 自动识别名称与保质期</el-tag>
            </div>
          </template>

          <el-upload
            drag
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            :disabled="recognizing"
            :on-change="onFileChange"
            class="uploader"
          >
            <div v-if="recognizing" class="uploader__inner">
              <el-icon class="is-loading" :size="28"><Camera /></el-icon>
              <p class="uploader__title">正在识别保质期…</p>
              <p class="text-muted">通常需要 10~30 秒，请稍候</p>
            </div>
            <div v-else class="uploader__inner">
              <el-icon :size="34" color="var(--el-color-primary)"><Picture /></el-icon>
              <p class="uploader__title">点击或拖拽图片到此处</p>
              <p class="text-muted">支持 JPG / PNG，单张不超过 10MB；手机端会提示拍照</p>
            </div>
          </el-upload>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="10">
        <el-card shadow="never" class="mb-16">
          <template #header>常用食品，一键录入</template>
          <div class="tpl-grid">
            <el-button
              v-for="t in templates"
              :key="t.name"
              :loading="quickAdding === t.name"
              class="tpl-btn"
              @click="quickAdd(t)"
            >
              {{ t.icon }} {{ t.name }}
              <span class="tpl-btn__days">{{ t.days }}天</span>
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <div class="flex-between">
          <span>手动录入</span>
          <el-button link @click="resetManual">重置</el-button>
        </div>
      </template>

      <el-form label-position="top" class="manual-form">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :md="12">
            <el-form-item label="名称">
              <FoodSuggest v-model="manual.name" :category="manual.category" @select="onManualSelect" />
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6" :md="6">
            <el-form-item label="分区">
              <el-select v-model="manual.category" style="width: 100%">
                <el-option v-for="c in CATEGORIES" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="12" :sm="6" :md="6">
            <el-form-item label="数量">
              <el-input-number v-model="manual.quantity" :min="1" :max="99" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="过期日期">
          <div class="expire-row">
            <el-date-picker
              v-model="manual.expireDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择过期日期"
              style="width: 200px"
            />
            <el-button :icon="MagicStick" :loading="suggesting" @click="suggest">AI 建议</el-button>
          </div>
        </el-form-item>

        <el-form-item label="快捷保质期">
          <div class="shelf-block">
            <div class="shelf-chips">
              <el-tag
                v-for="d in [3, 7, 14, 30, 90, 180]"
                :key="d"
                class="day-chip"
                effect="plain"
                @click="manual.expireDate = addDays(d)"
              >
                {{ d }} 天
              </el-tag>
            </div>
            <div class="shelf-custom">
              <el-input-number
                v-model="shelfAmount"
                :min="1"
                :max="shelfMax"
                :step="1"
                controls-position="right"
                placeholder="自定义保质期"
                style="width: 140px"
                @keyup.enter="applyShelfLife"
              />
              <el-select v-model="shelfUnit" style="width: 92px">
                <el-option label="天" value="day" />
                <el-option label="月" value="month" />
                <el-option label="年" value="year" />
              </el-select>
              <el-button @click="applyShelfLife">计算过期日</el-button>
            </div>
          </div>
        </el-form-item>

        <el-alert v-if="suggestTip" :title="suggestTip" type="success" :closable="false" class="mb-16" />

        <el-form-item>
          <el-button type="primary" :icon="Plus" :loading="manualSaving" @click="saveManual">保存入冰箱</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="confirmVisible" title="识别结果确认" width="720px" top="6vh">
      <div class="flex-between mb-16">
        <el-text type="info" size="small">共 {{ confirmItems.length }} 件，可修改后统一保存</el-text>
        <el-tag size="small" type="info">引擎：{{ engine }}</el-tag>
      </div>

      <el-card v-for="(item, idx) in confirmItems" :key="idx" shadow="never" class="confirm-item">
        <template #header>
          <div class="flex-between">
            <span>第 {{ idx + 1 }} 件</span>
            <div class="flex-center" style="gap: 8px">
              <el-tag v-if="item.estimated" type="success" size="small" effect="plain">AI 建议保质期</el-tag>
              <el-tag v-if="(item.confidence ?? 1) < 0.6" type="warning" size="small">置信度低，请核对</el-tag>
            </div>
          </div>
        </template>

        <el-form label-width="92px" label-position="left">
          <el-form-item label="名称">
            <FoodSuggest v-model="item.name" :category="item.category" @select="s => onConfirmSelect(item, s)" />
          </el-form-item>
          <el-form-item label="生产日期">
            <el-date-picker
              v-model="item.productDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="未识别到生产日期"
              style="width: 200px"
              @change="recalcExpire(item)"
            />
          </el-form-item>
          <el-form-item label="过期日期">
            <el-date-picker
              v-model="item.expireDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 200px"
              :class="{ 'is-low-conf': (item.confidence ?? 1) < 0.6 }"
            />
          </el-form-item>
          <el-form-item label="快捷保质期">
            <div class="shelf-custom">
              <el-input-number
                v-model="item.shelfAmount"
                :min="1"
                :max="SHELF_MAX[item.shelfUnit]"
                :step="1"
                controls-position="right"
                placeholder="填写保质期"
                style="width: 140px"
                @change="recalcExpire(item)"
                @keyup.enter="recalcExpire(item)"
              />
              <el-select v-model="item.shelfUnit" style="width: 92px" @change="recalcExpire(item)">
                <el-option label="天" value="day" />
                <el-option label="月" value="month" />
                <el-option label="年" value="year" />
              </el-select>
              <span class="text-muted">
                {{
                  item.estimated
                    ? '图片未识别到保质期，已按食品种类给出建议值'
                    : '按生产日期自动计算过期日期'
                }}
              </span>
            </div>
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="数量">
                <el-input-number v-model="item.quantity" :min="1" :max="99" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="分区">
                <el-select v-model="item.category" style="width: 100%">
                  <el-option v-for="c in CATEGORIES" :key="c.value" :label="c.label" :value="c.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>

      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAll">保存入冰箱</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.uploader {
  :deep(.el-upload-dragger) {
    padding: 28px 16px;
  }
}

.uploader__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  .uploader__title {
    margin: 4px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.tpl-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tpl-btn {
  margin-left: 0;
  --el-button-hover-bg-color: var(--el-color-primary-light-9);
}

.tpl-btn__days {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.expire-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.shelf-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.shelf-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shelf-custom {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.day-chip {
  cursor: pointer;
}

.confirm-item {
  margin-bottom: 12px;
}

.manual-form {
  :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }
}

@media (max-width: 767px) {
  .expire-row {
    flex-wrap: wrap;
  }
}
</style>
