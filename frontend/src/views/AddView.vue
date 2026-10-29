<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { Camera, MagicStick, Picture, Plus } from '@element-plus/icons-vue'
import FoodSuggest from '@/components/FoodSuggest.vue'
import { createFood, createFoods, suggestFood } from '@/api/foods'
import { recognizeImage } from '@/api/recognize'
import type { Category, FoodPayload, FuzzyItem } from '@/api/types'
import { addDays, toDateString } from '@/utils/date'

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
  expireDate: string
  confidence?: number
}
const confirmItems = ref<ConfirmItem[]>([])

async function onFileChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return
  recognizing.value = true
  try {
    const data = await recognizeImage(raw)
    engine.value = data.engine === 'codebuddy' ? 'CodeBuddy 视觉' : '智谱视觉'
    confirmItems.value = (data.items || []).map(it => ({
      name: it.name,
      category: it.category || 'refrigerated',
      quantity: it.quantity || 1,
      expireDate: it.expireDate || addDays(it.days || 7),
      confidence: it.confidence
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
          <div class="flex-center" style="flex-wrap: wrap">
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
            <el-tag v-if="(item.confidence ?? 1) < 0.6" type="warning" size="small">置信度低，请核对</el-tag>
          </div>
        </template>

        <el-form label-width="76px" label-position="left">
          <el-form-item label="名称">
            <FoodSuggest v-model="item.name" :category="item.category" @select="s => onConfirmSelect(item, s)" />
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

.day-chip {
  cursor: pointer;
  margin-right: 8px;
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
