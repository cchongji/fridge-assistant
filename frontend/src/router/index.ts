import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getToken, getUser } from '@/utils/storage'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/change-password',
    name: 'change-password',
    component: () => import('@/views/ChangePasswordView.vue'),
    meta: { title: '修改密码' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '冰箱', tab: 'home' } },
      { path: 'calendar', name: 'calendar', component: () => import('@/views/CalendarView.vue'), meta: { title: '日历', tab: 'calendar' } },
      { path: 'add', name: 'add', component: () => import('@/views/AddView.vue'), meta: { title: '添加食品', tab: 'add' } },
      { path: 'stats', name: 'stats', component: () => import('@/views/StatsView.vue'), meta: { title: '统计', tab: 'stats' } },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminUsersView.vue'),
        meta: { title: '账号管理', tab: 'admin', admin: true }
      },
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

  const user = getUser()
  // 管理员重置密码后，必须先修改密码才能进入其他页面
  if (logged && user?.mustChangePassword === true && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  const isAdmin = user?.role === 'admin'
  if (to.name === 'login' && logged) return { name: isAdmin ? 'admin' : 'home' }
  // 账号管理页仅管理员可访问
  if (to.meta.admin && !isAdmin) return { name: 'home' }
  return true
})

router.afterEach(to => {
  const title = (to.meta.title as string) || '冰箱剩余时间'
  document.title = `${title} · 冰箱剩余时间`
})

export default router
