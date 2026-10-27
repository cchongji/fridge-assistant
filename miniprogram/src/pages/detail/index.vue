<template>
  <view class="page" v-if="food">
    <NavBar title="食品详情" />

    <!-- 倒计时卡片 -->
    <view class="hero" :style="{ background: heroBg }">
      <text class="hero-name">{{ food.name }}</text>
      <text class="hero-days">{{ daysText }}</text>
      <text class="hero-expire">{{ food.expire_date }} 到期 · {{ cateLabel(food.category) }}</text>
    </view>

    <!-- 信息 -->
    <view class="card" v-if="!editing">
      <view class="row"><text class="k">录入时间</text><text class="v">{{ food.added_at }}</text></view>
      <view class="row"><text class="k">数量</text><text class="v">{{ food.quantity }}{{ food.unit }}</text></view>
      <view class="row" v-if="food.opened_date"><text class="k">开封日期</text><text class="v">{{ food.opened_date }}</text></view>
      <view class="row" v-if="food.note"><text class="k">备注</text><text class="v">{{ food.note }}</text></view>
      <view class="row"><text class="k">状态</text><text class="v">{{ statusLabel }}</text></view>
    </view>

    <!-- 编辑表单 -->
    <view class="card" v-else>
      <view class="field">
        <text class="k">名称</text>
        <input v-model="edit.name" class="input" />
      </view>
      <view class="field">
        <text class="k">过期日期</text>
        <picker mode="date" :value="edit.expireDate" @change="e => (edit.expireDate = e.detail.value)">
          <view class="input">{{ edit.expireDate }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="k">开封日期</text>
        <picker mode="date" :value="edit.openedDate" @change="e => (edit.openedDate = e.detail.value)">
          <view class="input">{{ edit.openedDate || '未开封' }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="k">数量</text>
        <input v-model="edit.quantity" type="digit" class="input" />
      </view>
      <view class="field">
        <text class="k">分区</text>
        <picker :range="cateLabels" :value="cateIdx(edit.category)" @change="e => (edit.category = cateKeys[e.detail.value])">
          <view class="input">{{ cateLabel(edit.category) }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="k">备注</text>
        <input v-model="edit.note" class="input" />
      </view>
    </view>

    <!-- 操作 -->
    <view class="actions" v-if="!editing && food.status === 'stock'">
      <button class="act-btn ghost" @tap="startEdit">✏️ 编辑</button>
      <button class="act-btn green" @tap="markEaten">😋 吃完了</button>
      <button class="act-btn red" @tap="remove">🗑️ 删除</button>
    </view>
    <view class="actions" v-else-if="editing">
      <button class="act-btn ghost" @tap="editing = false">取消</button>
      <button class="act-btn green" @tap="save">保存修改</button>
    </view>
    <view class="actions" v-else>
      <button class="act-btn ghost" @tap="restore">↩️ 恢复在库</button>
      <button class="act-btn red" @tap="remove">🗑️ 删除</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../utils/request.js'
import { daysLeftText, freshness, FRESHNESS_COLOR } from '../../utils/date.js'
import NavBar from '../../components/NavBar.vue'

const food = ref(null)
const editing = ref(false)
const edit = reactive({})
const cateKeys = ['refrigerated', 'frozen', 'ambient']
const cateLabels = ['冷藏', '冷冻', '常温']
const cateLabel = k => cateLabels[cateKeys.indexOf(k)] || '冷藏'
const cateIdx = k => Math.max(0, cateKeys.indexOf(k))
const statusMap = { stock: '在库', eaten: '已吃完', expired: '已过期' }
const statusLabel = computed(() => statusMap[food.value?.status] || '')
const daysText = computed(() => daysLeftText(food.value.expire_date))
const heroBg = computed(() => {
  const c = FRESHNESS_COLOR[freshness(food.value.expire_date)]
  return `linear-gradient(135deg, ${c}, ${c}CC)`
})

async function load() {
  const all = await api('/foods?status=all')
  food.value = all.find(f => f.id === +getCurrentId()) || null
  if (!food.value) uni.showToast({ title: '食品不存在', icon: 'none' })
}
function getCurrentId() {
  const pages = getCurrentPages()
  return pages[pages.length - 1].options?.id || pages[pages.length - 1].$page?.options?.id
}

function startEdit() {
  Object.assign(edit, {
    name: food.value.name,
    expireDate: food.value.expire_date,
    openedDate: food.value.opened_date || '',
    quantity: food.value.quantity,
    category: food.value.category,
    note: food.value.note
  })
  editing.value = true
}

async function save() {
  try {
    food.value = await api(`/foods/${food.value.id}`, {
      method: 'PUT',
      data: {
        name: edit.name.trim(),
        expireDate: edit.expireDate,
        openedDate: edit.openedDate || null,
        quantity: +edit.quantity || 1,
        category: edit.category,
        note: edit.note
      }
    })
    editing.value = false
    uni.showToast({ title: '已保存 ✓', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' })
  }
}

async function markEaten() {
  await api(`/foods/${food.value.id}/eat`, { method: 'POST' })
  uni.showToast({ title: '已标记吃完 😋', icon: 'none' })
  setTimeout(() => uni.navigateBack(), 500)
}

async function restore() {
  food.value = await api(`/foods/${food.value.id}`, { method: 'PUT', data: { status: 'stock' } })
  uni.showToast({ title: '已恢复在库', icon: 'none' })
}

function remove() {
  uni.showModal({
    title: '删除确认',
    content: `确定删除「${food.value.name}」？`,
    success: async r => {
      if (r.confirm) {
        await api(`/foods/${food.value.id}`, { method: 'DELETE' })
        uni.navigateBack()
      }
    }
  })
}

onLoad(load)
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx 24rpx 60rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.hero {
  border-radius: 24rpx;
  padding: 48rpx 36rpx;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 24rpx;
  .hero-name { font-size: 40rpx; font-weight: 700; }
  .hero-days { font-size: 56rpx; font-weight: 800; }
  .hero-expire { font-size: 24rpx; opacity: 0.9; }
}
.card {
  background: $card-bg;
  border-radius: $radius;
  box-shadow: $card-shadow;
  padding: 12rpx 28rpx;
  margin-bottom: 28rpx;
}
.row,
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1px solid #f0f4f2;
  &:last-child { border-bottom: none; }
  .k { color: $text-sub; font-size: 26rpx; }
  .v { font-size: 26rpx; }
  .input {
    text-align: right;
    font-size: 26rpx;
    background: $bg;
    border-radius: 10rpx;
    padding: 10rpx 16rpx;
    min-width: 320rpx;
  }
}
.actions {
  display: flex;
  gap: 16rpx;
}
.act-btn {
  flex: 1;
  border-radius: 20rpx;
  font-size: 27rpx;
  &.ghost { background: $card-bg; color: $text-sub; box-shadow: $card-shadow; }
  &.green { background: linear-gradient(135deg, $primary, $primary-deep); color: #fff; }
  &.red { background: #fff1f0; color: $expired; }
}
</style>
