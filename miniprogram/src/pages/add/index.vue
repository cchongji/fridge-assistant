<template>
  <view class="page">
    <NavBar title="添加食品" />

    <!-- 识别中 -->
    <view v-if="recognizing" class="recognizing">
      <view class="spinner" />
      <text class="rec-text">正在识别保质期…</text>
      <text class="rec-sub">通常需要 10~30 秒，请稍候</text>
    </view>

    <!-- 主入口 -->
    <block v-else>
      <view class="hero">
        <text class="hero-icon">📸</text>
        <text class="hero-title">拍下食品包装</text>
        <text class="hero-sub">AI 自动识别名称与保质期，确认后入冰箱</text>
      </view>

      <view class="btn-row">
        <button class="main-btn" @tap="chooseAndRecognize('camera')">
          📷 拍照识别
        </button>
        <button class="main-btn alt" @tap="chooseAndRecognize('album')">
          🖼️ 相册选图
        </button>
      </view>

      <view class="divider"><text>或手动录入</text></view>

      <!-- 常用模板 -->
      <view class="tpl-title">常用食品，一键录入</view>
      <view class="tpl-grid">
        <view v-for="t in templates" :key="t.name" class="tpl-chip" @tap="quickAdd(t)">
          {{ t.icon }} {{ t.name }}
        </view>
      </view>
    </block>

    <!-- 确认弹窗 -->
    <view v-if="showConfirm" class="mask" @tap.self="closeConfirm">
      <scroll-view scroll-y class="confirm-panel">
        <view class="confirm-head">
          <text class="confirm-title">识别结果确认</text>
          <text class="confirm-engine">引擎：{{ engine }}</text>
        </view>

        <view v-for="(item, idx) in confirmItems" :key="idx" class="confirm-item">
          <view class="item-head">
            <text>第 {{ idx + 1 }} 件</text>
            <text v-if="item.confidence < 0.6" class="low-conf">⚠️ 置信度低，请核对</text>
          </view>

          <view class="field">
            <text class="f-label">名称</text>
            <FoodSuggest
              v-model="item.name"
              :category="item.category"
              @select="s => onConfirmSelect(item, s)"
            />
          </view>
          <view class="field">
            <text class="f-label">过期日期</text>
            <picker mode="date" :value="item.expireDate" @change="e => (item.expireDate = e.detail.value)">
              <view class="f-input" :class="{ low: item.confidence < 0.6 }">{{ item.expireDate || '请选择' }}</view>
            </picker>
          </view>
          <view class="field half-row">
            <view class="half">
              <text class="f-label">数量</text>
              <input v-model="item.quantity" type="digit" class="f-input" />
            </view>
            <view class="half">
              <text class="f-label">分区</text>
              <picker :range="cateLabels" :value="cateIdx(item.category)" @change="e => (item.category = cateKeys[e.detail.value])">
                <view class="f-input">{{ cateLabel(item.category) }}</view>
              </picker>
            </view>
          </view>
        </view>

        <view class="confirm-actions">
          <button class="ghost-btn" @tap="closeConfirm">取消</button>
          <button class="primary-btn" :loading="saving" @tap="saveAll">保存入冰箱</button>
        </view>
      </scroll-view>
    </view>

    <!-- 手动录入弹窗 -->
    <view v-if="showManual" class="mask" @tap.self="showManual = false">
      <view class="confirm-panel manual">
        <view class="confirm-head">
          <text class="confirm-title">手动录入</text>
        </view>
        <view class="field">
          <text class="f-label">名称</text>
          <FoodSuggest
            v-model="manual.name"
            :category="manual.category"
            @select="onManualSelect"
          />
        </view>
        <view class="field half-row">
          <view class="half">
            <text class="f-label">数量</text>
            <input v-model="manual.quantity" type="digit" class="f-input" />
          </view>
          <view class="half">
            <text class="f-label">分区</text>
            <picker :range="cateLabels" :value="cateIdx(manual.category)" @change="e => (manual.category = cateKeys[e.detail.value])">
              <view class="f-input">{{ cateLabel(manual.category) }}</view>
            </picker>
          </view>
        </view>
        <view class="field">
          <text class="f-label">过期日期</text>
          <picker mode="date" :value="manual.expireDate" @change="e => (manual.expireDate = e.detail.value)">
            <view class="f-input">{{ manual.expireDate || '请选择' }}</view>
          </picker>
          <button class="suggest-btn" size="mini" :loading="suggesting" @tap="suggest">
            🤖 AI 建议
          </button>
        </view>
        <view v-if="suggestTip" class="suggest-tip">💡 {{ suggestTip }}</view>
        <view class="tpl-title" style="margin-top: 12rpx">快捷保质期（从今天算）</view>
        <view class="tpl-grid">
          <view v-for="d in [3, 7, 14, 30, 90, 180]" :key="d" class="tpl-chip" @tap="setManualDays(d)">
            {{ d }} 天
          </view>
        </view>
        <view class="confirm-actions">
          <button class="ghost-btn" @tap="showManual = false">取消</button>
          <button class="primary-btn" :loading="saving" @tap="saveManual">保存</button>
        </view>
      </view>
    </view>

    <view class="manual-entry" @tap="openManual">
      <text>✏️ 手动录入 / 无图添加</text>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { api } from '../../utils/request.js'
import FoodSuggest from '../../components/FoodSuggest.vue'
import NavBar from '../../components/NavBar.vue'

const recognizing = ref(false)
const saving = ref(false)
const showConfirm = ref(false)
const showManual = ref(false)
const confirmItems = ref([])
const engine = ref('')
const suggesting = ref(false)
const suggestTip = ref('')

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

const cateKeys = ['refrigerated', 'frozen', 'ambient']
const cateLabels = ['冷藏', '冷冻', '常温']
const cateLabel = k => cateLabels[cateKeys.indexOf(k)] || '冷藏'
const cateIdx = k => Math.max(0, cateKeys.indexOf(k))

const manual = reactive({ name: '', quantity: 1, category: 'refrigerated', expireDate: '' })

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function chooseAndRecognize(source) {
  uni.chooseImage({
    count: 1,
    sourceType: [source],
    success: res => recognizeImage(res.tempFilePaths[0]),
    fail: () => {}
  })
}

function recognizeImage(filePath) {
  recognizing.value = true
  if (!uni.getStorageSync('token')) {
    recognizing.value = false
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }
  let baseUrl = '/api'
  // #ifndef H5
  baseUrl = 'http://localhost:3300/api'
  // #endif
  uni.uploadFile({
    url: `${baseUrl}/recognize`,
    filePath,
    name: 'image',
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: res => {
      recognizing.value = false
      try {
        const data = JSON.parse(res.data)
        if (res.statusCode >= 300 || data.error) throw new Error(data.error || '识别失败')
        engine.value = data.engine === 'codebuddy' ? 'CodeBuddy CLI' : '智谱视觉'
        confirmItems.value = (data.items || []).map(it => ({
          name: it.name,
          expireDate: it.expireDate || addDays(it.shelfLifeDays || 7),
          quantity: it.quantity || 1,
          category: 'refrigerated',
          confidence: it.confidence
        }))
        if (!confirmItems.value.length) {
          uni.showToast({ title: '未识别出食品，请手动录入', icon: 'none' })
          return
        }
        showConfirm.value = true
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    fail: err => {
      recognizing.value = false
      uni.showToast({ title: '上传失败：' + (err.errMsg || ''), icon: 'none' })
    }
  })
}

async function saveAll() {
  for (const item of confirmItems.value) {
    if (!item.name.trim()) return uni.showToast({ title: '名称不能为空', icon: 'none' })
    if (!item.expireDate) return uni.showToast({ title: '请选择过期日期', icon: 'none' })
  }
  saving.value = true
  try {
    await api('/foods', {
      method: 'POST',
      data: confirmItems.value.map(it => ({
        name: it.name.trim(),
        category: it.category,
        quantity: +it.quantity || 1,
        expireDate: it.expireDate
      }))
    })
    uni.showToast({ title: '已入冰箱 ✓', icon: 'success' })
    closeConfirm()
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    saving.value = false
  }
}

function closeConfirm() {
  showConfirm.value = false
  confirmItems.value = []
}

function openManual() {
  Object.assign(manual, { name: '', quantity: 1, category: 'refrigerated', expireDate: '' })
  suggestTip.value = ''
  showManual.value = true
}

/** 词典联想选中：填充名称并按所选分区采纳建议天数 */
function onManualSelect(s) {
  manual.category = s.category
  manual.expireDate = addDays(s.days)
  suggestTip.value = `已按词典填充：${s.name}，${cateLabel(s.category)}建议 ${s.days} 天`
}

function onConfirmSelect(item, s) {
  item.category = s.category
  item.expireDate = addDays(s.days)
}

/** AI 推荐保质期：名称填写后手动触发或失焦自动触发 */
async function autoSuggest() {
  if (manual.name.trim() && !manual.expireDate) {
    suggest()
  }
}

async function suggest() {
  if (!manual.name.trim()) {
    return uni.showToast({ title: '请先填写食品名称', icon: 'none' })
  }
  suggesting.value = true
  suggestTip.value = ''
  try {
    const r = await api('/foods/suggest', {
      method: 'POST',
      data: { name: manual.name.trim(), category: manual.category }
    })
    manual.expireDate = r.expireDate
    suggestTip.value = `AI 建议：${cateLabel(manual.category)}约 ${r.days} 天（至 ${r.expireDate}）${r.tip ? '，' + r.tip : ''}`
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    suggesting.value = false
  }
}
function setManualDays(d) {
  manual.expireDate = addDays(d)
}
async function saveManual() {
  if (!manual.name.trim()) return uni.showToast({ title: '请填写名称', icon: 'none' })
  if (!manual.expireDate) return uni.showToast({ title: '请选择过期日期', icon: 'none' })
  saving.value = true
  try {
    await api('/foods', {
      method: 'POST',
      data: { name: manual.name.trim(), category: manual.category, quantity: +manual.quantity || 1, expireDate: manual.expireDate }
    })
    uni.showToast({ title: '已入冰箱 ✓', icon: 'success' })
    showManual.value = false
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function quickAdd(t) {
  try {
    await api('/foods', {
      method: 'POST',
      data: { name: t.name, quantity: 1, expireDate: addDays(t.days) }
    })
    uni.showToast({ title: `${t.name} 已入冰箱 ✓`, icon: 'none' })
    setTimeout(() => uni.navigateBack(), 500)
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 40rpx 32rpx 60rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 40rpx;
  gap: 12rpx;
  .hero-icon { font-size: 110rpx; }
  .hero-title { font-size: 38rpx; font-weight: 700; color: $text-main; }
  .hero-sub { font-size: 24rpx; color: $text-sub; }
}
.btn-row {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}
.main-btn {
  flex: 1;
  background: linear-gradient(135deg, $primary, $primary-deep);
  color: #fff;
  border-radius: 24rpx;
  font-size: 30rpx;
  font-weight: 600;
  padding: 8rpx 0;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
  &.alt {
    background: $card-bg;
    color: $primary-deep;
    box-shadow: $card-shadow;
  }
}
.divider {
  text-align: center;
  color: $text-sub;
  font-size: 22rpx;
  margin: 44rpx 0 24rpx;
  position: relative;
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 30%;
    height: 1px;
    background: #e3e9e6;
  }
  &::before { left: 0; }
  &::after { right: 0; }
}
.tpl-title {
  font-size: 26rpx;
  color: $text-sub;
  margin-bottom: 16rpx;
}
.tpl-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.tpl-chip {
  padding: 14rpx 26rpx;
  background: $card-bg;
  border-radius: 40rpx;
  font-size: 26rpx;
  box-shadow: $card-shadow;
  &:active { background: #eef7f1; }
}
.recognizing {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
  gap: 20rpx;
  .spinner {
    width: 90rpx;
    height: 90rpx;
    border: 8rpx solid #e3e9e6;
    border-top-color: $primary;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .rec-text { font-size: 30rpx; font-weight: 600; }
  .rec-sub { font-size: 22rpx; color: $text-sub; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(31, 45, 43, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.confirm-panel {
  width: 100%;
  max-height: 82vh;
  background: $card-bg;
  border-radius: 32rpx 32rpx 0 0;
  padding: 36rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  &.manual {
    max-height: none;
  }
}
.confirm-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
  .confirm-title { font-size: 34rpx; font-weight: 700; }
  .confirm-engine { font-size: 22rpx; color: $text-sub; }
}
.confirm-item {
  border: 1px solid #eef2f0;
  border-radius: $radius;
  padding: 20rpx;
  margin-bottom: 20rpx;
}
.item-head {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: $text-sub;
  margin-bottom: 16rpx;
  .low-conf { color: $urgent; }
}
.field {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.half-row { align-items: flex-start; }
.half {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.f-label {
  width: 120rpx;
  font-size: 24rpx;
  color: $text-sub;
  flex-shrink: 0;
}
.f-input {
  flex: 1;
  background: $bg;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  &.low {
    background: #fef7e6;
    border: 1px solid $soon;
  }
}
.confirm-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}
.ghost-btn {
  flex: 1;
  background: $bg;
  color: $text-sub;
  border-radius: 24rpx;
}
.primary-btn {
  flex: 2;
  background: linear-gradient(135deg, $primary, $primary-deep);
  color: #fff;
  border-radius: 24rpx;
  font-weight: 600;
}
.suggest-btn {
  flex-shrink: 0;
  background: #eef7f1;
  color: $primary-deep;
  border-radius: 12rpx;
  font-size: 22rpx;
  padding: 0 16rpx;
  line-height: 56rpx;
}
.suggest-tip {
  font-size: 22rpx;
  color: $primary-deep;
  background: #eef7f1;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
  margin-bottom: 16rpx;
  line-height: 1.6;
}
.manual-entry {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(20rpx + env(safe-area-inset-bottom));
  text-align: center;
  color: $text-sub;
  font-size: 24rpx;
  padding: 12rpx;
}
</style>
