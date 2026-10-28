<template>
  <view class="suggest-wrap">
    <input
      :value="modelValue"
      class="f-input"
      :placeholder="placeholder"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <view v-if="showList && list.length" class="suggest-list">
      <view
        v-for="s in list"
        :key="s.name"
        class="suggest-item"
        @mousedown.prevent
        @tap="pick(s)"
      >
        <text class="s-name">{{ s.name }}</text>
        <text class="s-days">{{ s.days }} 天 · {{ cateLabel(s.category) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../utils/request.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '如：纯牛奶 / 小米椒' },
  category: { type: String, default: 'refrigerated' }
})
const emit = defineEmits(['update:modelValue', 'select'])

const list = ref([])
const showList = ref(false)
const cateLabels = { refrigerated: '冷藏', frozen: '冷冻', ambient: '常温' }
const cateLabel = k => cateLabels[k] || '冷藏'

let timer = null

function onInput(e) {
  const v = e.detail.value
  emit('update:modelValue', v)
  clearTimeout(timer)
  if (!v.trim()) {
    showList.value = false
    return
  }
  timer = setTimeout(async () => {
    // 联想是非关键请求：无 token 时直接跳过，避免把用户踢到登录页
    if (!uni.getStorageSync('token')) return
    try {
      const r = await api(`/foods/fuzzy?q=${encodeURIComponent(v.trim())}&category=${props.category}`)
      list.value = r.items || []
      showList.value = list.value.length > 0
    } catch (err) {
      /* 联想失败静默 */
    }
  }, 250)
}

function onFocus() {
  if (modelValueStr()) showList.value = list.value.length > 0
}
function modelValueStr() {
  return String(props.modelValue || '').trim()
}
function onBlur() {
  // 延迟关闭，保证 tap 先触发
  setTimeout(() => (showList.value = false), 200)
}

function pick(s) {
  emit('update:modelValue', s.name)
  emit('select', s)
  showList.value = false
}
</script>

<style lang="scss" scoped>
.suggest-wrap {
  flex: 1;
  position: relative;
}
.suggest-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: $card-bg;
  border-radius: 12rpx;
  box-shadow: 0 8rpx 30rpx rgba(31, 45, 43, 0.18);
  z-index: 300;
  max-height: 420rpx;
  overflow-y: auto;
  margin-top: 4rpx;
}
.suggest-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 22rpx;
  border-bottom: 1px solid #f0f4f2;
  &:last-child {
    border-bottom: none;
  }
  &:active {
    background: #eef7f1;
  }
  .s-name {
    font-size: 26rpx;
    color: $text-main;
  }
  .s-days {
    font-size: 22rpx;
    color: $primary-deep;
  }
}
</style>
