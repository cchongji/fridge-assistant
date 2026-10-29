import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getToken } from '@/utils/storage'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '冰箱', tab: 'home' } },
      { path: 'calendar', name: 'calendar', component: () => import('@/views/CalendarView.vue'), meta: { title: '日历', tab: 'calendar' } },
      { path: 'add', name: 'add', component: () => import('@/views/AddView.vue'), meta: { title: '添加食品', tab: 'add' } },
      { path: 'stats', name: 'stats', component: () => import('@/views/StatsView.vue'), meta: { title: '统计', tab: 'stats' } },
      { path: 'food/:id', name: 'detail', component: () => import('@/views/DetailView.vue'), meta: { title: '食品详情' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(to => {
  const logged = !!getToken()
  if (!to.meta.public && !logged) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.name === 'login' && logged) return { name: 'home' }
  return true
})

router.afterEach(to => {
  const title = (to.meta.title as string) || '冰箱剩余时间'
  document.title = `${title} · 冰箱剩余时间`
})

export default router
