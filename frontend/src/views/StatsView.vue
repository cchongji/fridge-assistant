<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { Bell, Download, Refresh, Upload } from '@element-plus/icons-vue'
import { fetchMe, updateMe } from '@/api/auth'
import {
  exportData,
  fetchMonthlyStats,
  fetchSettings,
  importData,
  saveSettings,
  scanRemind,
  sendTestEmail
} from '@/api/misc'
import type { ScanResult } from '@/api/misc'
import type { MeInfo, MonthlyStats, RemindConfig } from '@/api/types'

const stats = reactive<MonthlyStats>({ month: '', eaten: 0, expired: 0, inStock: 0 })
const remind = reactive<RemindConfig>({ d3: true, d1: true, d0: true, expired: true })
const me = reactive<Partial<MeInfo>>({ username: '', nickname: '', email: '', smtpAuthSet: false })
const emailDraft = ref('')
const loading = ref(false)
const testing = ref(false)
const scanning = ref(false)
const scanResult = ref<ScanResult | null>(null)
const scanVisible = ref(false)

const remindOptions: Array<{ key: keyof RemindConfig; label: string; desc: string }> = [
  { key: 'd3', label: '提前 3 天提醒', desc: '临期预警，留出消耗时间' },
  { key: 'd1', label: '提前 1 天提醒', desc: '明天过期' },
  { key: 'd0', label: '过期当天提醒', desc: '今天必须处理' },
  { key: 'expired', label: '过期后持续提醒', desc: '直到标记吃完或删除' }
]

const total = computed(() => stats.eaten + stats.expired)
const pct = (n: number) => Math.min(100, Math.round((n / Math.max(total.value, 1)) * 100))

const summary = computed(() => {
  if (total.value === 0) return '本月暂无消耗记录'
  if (stats.expired === 0) return '零浪费！全部吃光，太棒了'
  return '节约提示：减少囤货、先吃临期食品'
})

const emailValid = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

async function load() {
  loading.value = true
  try {
    Object.assign(stats, await fetchMonthlyStats())
    const s = await fetchSettings()
    Object.assign(remind, s.remind)
    Object.assign(me, await fetchMe())
    emailDraft.value = me.email || ''
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function toggleRemind() {
  try {
    await saveSettings({ ...remind })
    ElMessage.success('提醒设置已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function saveEmail() {
  const email = emailDraft.value.trim()
  if (!emailValid(email)) return ElMessage.warning('邮箱格式不正确')
  try {
    await updateMe({ email })
    me.email = email
    ElMessage.success(email ? '邮箱已保存' : '已清除邮箱')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function testEmail() {
  testing.value = true
  try {
    const r = await sendTestEmail()
    ElMessage.success(`测试邮件已发送至 ${r.to}`)
  } catch (e) {
    ElMessage.error({ message: (e as Error).message, duration: 4000 })
  } finally {
    testing.value = false
  }
}

async function doExport() {
  try {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fridge-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    ElMessage.success('已导出备份')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function onImportChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return
  try {
    const text = await raw.text()
    const r = await importData(JSON.parse(text))
    ElMessage.success(`导入 ${r.imported} 件`)
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败，请检查 JSON 格式')
  }
}

async function manualScan() {
  scanning.value = true
  try {
    scanResult.value = await scanRemind()
    scanVisible.value = true
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    scanning.value = false
  }
}

const scanLines = computed(() => {
  const r = scanResult.value
  if (!r) return []
  const lines = [`扫描在库 ${r.scanned ?? 0} 件，命中提醒 ${r.matched ?? 0} 条，成功发送 ${r.sent ?? 0} 条`]
  const skipped = r.skipped ? [...new Set(r.skipped.map(s => s.reason).filter(Boolean))] : []
  if (skipped.length) lines.push('', '未发送原因：', ...skipped.slice(0, 3).map(s => `· ${s}`))
  if ((r.matched ?? 0) === 0) lines.push('', '（今天没有到期/临期食品，或提醒开关已关闭）')
  return lines
})

onMounted(load)
</script>

<template>
  <div class="app-page" v-loading="loading">
    <div class="app-page__head">
      <div>
        <h2 class="app-page__title">统计与设置</h2>
        <p class="app-page__desc">消耗概览、邮件提醒与数据备份</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-card shadow="never" class="mb-16">
      <template #header>本月统计（{{ stats.month }}）</template>

      <el-row :gutter="12" class="mb-16">
        <el-col :xs="8" :sm="8">
          <el-statistic title="吃掉" :value="stats.eaten" value-style="color: var(--el-color-success)" />
        </el-col>
        <el-col :xs="8" :sm="8">
          <el-statistic title="浪费" :value="stats.expired" value-style="color: var(--el-color-danger)" />
        </el-col>
        <el-col :xs="8" :sm="8"><el-statistic title="在库" :value="stats.inStock" /></el-col>
      </el-row>

      <div class="bar-row">
        <span class="bar-row__label">吃掉</span>
        <el-progress :percentage="pct(stats.eaten)" :stroke-width="10" status="success" :show-text="false" />
        <span class="bar-row__num">{{ stats.eaten }}</span>
      </div>
      <div class="bar-row">
        <span class="bar-row__label">浪费</span>
        <el-progress :percentage="pct(stats.expired)" :stroke-width="10" status="exception" :show-text="false" />
        <span class="bar-row__num">{{ stats.expired }}</span>
      </div>

      <el-alert :title="summary" type="info" :closable="false" class="mt-16" />
    </el-card>

    <el-card shadow="never" class="mb-16">
      <template #header>
        <div class="flex-between">
          <span>提醒设置</span>
          <el-tag size="small" type="info">邮件提醒</el-tag>
        </div>
      </template>

      <div v-for="opt in remindOptions" :key="opt.key" class="setting-row">
        <div>
          <div class="setting-row__label">{{ opt.label }}</div>
          <div class="text-muted">{{ opt.desc }}</div>
        </div>
        <el-switch v-model="remind[opt.key]" @change="toggleRemind" />
      </div>

      <el-alert
        type="warning"
        :closable="false"
        class="mt-16"
        title="Web 端不支持微信订阅消息，提醒通过邮件发送；需在下方绑定邮箱并配置 SMTP 授权码"
      />
    </el-card>

    <el-card shadow="never" class="mb-16">
      <template #header>账号</template>

      <el-descriptions :column="1" border>
        <el-descriptions-item label="昵称 / 账号">
          {{ me.nickname || me.username || '—' }}
          <el-tag v-if="me.username" size="small" type="info" effect="plain" class="ml-8">{{ me.username }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="绑定邮箱">{{ me.email || '未绑定' }}</el-descriptions-item>
        <el-descriptions-item label="SMTP 授权码">
          <el-tag :type="me.smtpAuthSet ? 'success' : 'info'" size="small" effect="plain">
            {{ me.smtpAuthSet ? '已配置' : '未配置' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <div class="email-row mt-16">
        <el-input v-model="emailDraft" placeholder="输入新邮箱，保存后用于接收提醒" maxlength="64" clearable />
        <el-button type="primary" @click="saveEmail">保存邮箱</el-button>
        <el-button :icon="Bell" :loading="testing" @click="testEmail">发测试邮件</el-button>
      </div>
      <p class="text-muted mt-8">邮箱为空时不会发送任何提醒邮件。</p>
    </el-card>

    <el-card shadow="never">
      <template #header>数据管理</template>
      <div class="flex-center" style="flex-wrap: wrap">
        <el-button :icon="Download" @click="doExport">导出数据</el-button>
        <el-upload :auto-upload="false" :show-file-list="false" accept=".json" :on-change="onImportChange">
          <el-button :icon="Upload">导入数据</el-button>
        </el-upload>
        <el-button :icon="Refresh" :loading="scanning" @click="manualScan">立即扫描提醒</el-button>
      </div>
    </el-card>

    <el-dialog v-model="scanVisible" title="扫描结果" width="520px">
      <pre class="scan-result">{{ scanLines.join('\n') }}</pre>
      <template #footer>
        <el-button type="primary" @click="scanVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;

  :deep(.el-progress) {
    flex: 1;
  }
}

.bar-row__label {
  flex: 0 0 40px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.bar-row__num {
  flex: 0 0 28px;
  text-align: right;
  font-weight: 600;
  font-size: 13px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-of-type {
    border-bottom: none;
  }
}

.setting-row__label {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.email-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ml-8 {
  margin-left: 8px;
}

.scan-result {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  font-family: inherit;
}

@media (max-width: 767px) {
  .email-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
