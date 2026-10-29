<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Calendar, DataLine, Food, House, Plus, SwitchButton, User } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const tabs = [
  { name: 'home', path: '/', label: '冰箱', icon: House },
  { name: 'calendar', path: '/calendar', label: '日历', icon: Calendar },
  { name: 'add', path: '/add', label: '添加', icon: Plus },
  { name: 'stats', path: '/stats', label: '统计', icon: DataLine }
]

const activeTab = computed(() => (route.meta.tab as string) || 'home')

async function onCommand(cmd: string) {
  if (cmd === 'logout') {
    await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
    await userStore.logout()
    router.replace('/login')
    return
  }
  if (cmd === 'stats') router.push('/stats')
}
</script>

<template>
  <div class="layout">
    <header class="layout__header">
      <div class="layout__inner">
        <div class="layout__brand" @click="router.push('/')">
          <el-icon class="layout__logo" :size="20" color="var(--el-color-primary)"><Food /></el-icon>
          <span class="layout__name">冰箱剩余时间</span>
        </div>

        <el-menu
          class="layout__menu"
          mode="horizontal"
          router
          :default-active="activeTab"
          :ellipsis="false"
        >
          <el-menu-item v-for="t in tabs" :key="t.name" :index="t.name" :route="t.path">
            <el-icon><component :is="t.icon" /></el-icon>
            <span>{{ t.label }}</span>
          </el-menu-item>
        </el-menu>

        <el-dropdown trigger="click" @command="onCommand">
          <span class="layout__user">
            <el-avatar :size="28" :icon="User" />
            <span class="layout__username">{{ userStore.nickname || '未登录' }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="stats">账号与提醒设置</el-dropdown-item>
              <el-dropdown-item command="logout" divided :icon="SwitchButton">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="layout__main">
      <router-view />
    </main>

    <nav class="layout__tabbar">
      <router-link v-for="t in tabs" :key="t.name" :to="t.path" class="layout__tab" :class="{ active: activeTab === t.name }">
        <el-icon :size="20"><component :is="t.icon" /></el-icon>
        <span>{{ t.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.layout__header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
}

.layout__inner {
  max-width: var(--app-max-width);
  margin: 0 auto;
  height: var(--app-header-h);
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.layout__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 0 0 auto;
}

.layout__logo {
  font-size: 20px;
}

.layout__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.layout__menu {
  flex: 1;
  border-bottom: none;
  --el-menu-horizontal-height: var(--app-header-h);
}

.layout__user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  outline: none;
}

.layout__username {
  font-size: 14px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout__main {
  flex: 1;
}

.layout__tabbar {
  display: none;
}

@media (max-width: 767px) {
  .layout__menu {
    display: none;
  }

  .layout__inner {
    justify-content: space-between;
    gap: 12px;
  }

  .layout__username {
    display: none;
  }

  .layout__tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: #fff;
    border-top: 1px solid var(--el-border-color-light);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .layout__tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 0 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    &.active {
      color: var(--el-color-primary);
    }
  }
}
</style>
