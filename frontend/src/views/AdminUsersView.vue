<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Key, Lock, Refresh, Unlock } from '@element-plus/icons-vue'
import { fetchAdminUsers, resetUserPassword, setUserStatus } from '@/api/admin'
import type { AdminUser } from '@/api/types'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const myId = computed(() => Number(userStore.user?.uid || 0))

const users = ref<AdminUser[]>([])
const loading = ref(false)
const resettingId = ref<number | null>(null)
const statusChangingId = ref<number | null>(null)

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const disabledCount = computed(() => users.value.filter(u => u.status === 'disabled').length)
const stockTotal = computed(() => users.value.reduce((n, u) => n + (u.stock_count || 0), 0))

function fmtTime(s?: string) {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 16)
}

function nameOf(row: AdminUser) {
  return row.username || row.nickname || `#${row.id}`
}

async function load() {
  loading.value = true
  try {
    const { users: list } = await fetchAdminUsers()
    users.value = list
  } catch (e) {
    ElMessage.error((e as Error).message || '加载账号列表失败')
  } finally {
    loading.value = false
  }
}

/** 重置密码：需输入目标账号名二次确认 */
async function onReset(row: AdminUser) {
  const name = nameOf(row)
  try {
    await ElMessageBox.prompt(`请输入账号「${name}」以确认重置密码（重置为 123456，原密码立即失效）：`, '重置密码确认', {
      type: 'warning',
      confirmButtonText: '确认重置',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
      inputPlaceholder: name,
      inputValidator: (v: string) => (v || '').trim() === name || '输入的账号不一致'
    })
  } catch {
    return // 取消
  }

  resettingId.value = row.id
  try {
    const res = await resetUserPassword(row.id)
    ElMessage.success(`账号「${res.username || name}」的密码已重置为 ${res.password}，该账号已登录设备需重新登录`)
  } catch (e) {
    ElMessage.error((e as Error).message || '重置密码失败')
  } finally {
    resettingId.value = null
  }
}

/** 停用 / 启用账号 */
async function onToggleStatus(row: AdminUser) {
  const name = nameOf(row)
  const disable = row.status !== 'disabled'
  try {
    await ElMessageBox.confirm(
      disable
        ? `确定停用账号「${name}」吗？停用后该账号将立即退出登录且无法再登录。`
        : `确定启用账号「${name}」吗？启用后该账号可正常登录。`,
      disable ? '停用账号确认' : '启用账号确认',
      {
        type: 'warning',
        confirmButtonText: disable ? '确认停用' : '确认启用',
        cancelButtonText: '取消',
        confirmButtonClass: disable ? 'el-button--danger' : ''
      }
    )
  } catch {
    return
  }

  statusChangingId.value = row.id
  try {
    const res = await setUserStatus(row.id, disable ? 'disabled' : 'active')
    row.status = res.status
    ElMessage.success(`账号「${name}」已${disable ? '停用' : '启用'}`)
  } catch (e) {
    ElMessage.error((e as Error).message || '更新账号状态失败')
  } finally {
    statusChangingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="app-page" v-loading="loading">
    <div class="app-page__head">
      <div>
        <h2 class="app-page__title">账号管理</h2>
        <p class="app-page__desc">
          共 {{ users.length }} 个账号（管理员 {{ adminCount }} 个，已停用 {{ disabledCount }} 个），在库食品合计
          {{ stockTotal }} 件
        </p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="users" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="66" />
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="100" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="96">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small" effect="plain">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'disabled' ? 'info' : 'success'" size="small" effect="plain">
              {{ row.status === 'disabled' ? '已停用' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="食品" width="110">
          <template #default="{ row }">{{ row.stock_count }} / {{ row.food_count }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-tooltip :disabled="row.id !== myId" content="不能重置自己的密码，请使用「修改密码」" placement="top">
                <span>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :icon="Key"
                    :disabled="row.id === myId"
                    :loading="resettingId === row.id"
                    @click="onReset(row as AdminUser)"
                  >
                    重置密码
                  </el-button>
                </span>
              </el-tooltip>
              <el-tooltip :disabled="row.id !== myId" content="不能停用自己的账号" placement="top">
                <span>
                  <el-button
                    size="small"
                    :type="row.status === 'disabled' ? 'success' : 'warning'"
                    plain
                    :icon="row.status === 'disabled' ? Unlock : Lock"
                    :disabled="row.id === myId"
                    :loading="statusChangingId === row.id"
                    @click="onToggleStatus(row as AdminUser)"
                  >
                    {{ row.status === 'disabled' ? '启用' : '停用' }}
                  </el-button>
                </span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <p class="text-muted admin-tip">
      安全提示：重置密码、停用账号会立即使该账号的登录令牌失效；这两种操作都会写入管理员操作日志。
    </p>
  </div>
</template>

<style scoped lang="scss">
.admin-tip {
  margin-top: 12px;
  font-size: 13px;
}

.row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}
</style>
