import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import '@/styles/index.scss'
import App from '@/App.vue'
import router from '@/router'
import { useUserStore } from '@/stores/user'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 启动时恢复登录态（token 存在 localStorage）
useUserStore().restore()

app.mount('#app')
