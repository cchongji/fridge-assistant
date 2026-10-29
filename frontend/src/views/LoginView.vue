<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Food, Lock, User, Message, UserFilled, Key } from '@element-plus/icons-vue'
import { captchaImageUrl, fetchCaptcha } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

type Mode = 'login' | 'register'
const mode = ref<Mode>('login')
const loading = ref(false)
const error = ref('')
const formRef = ref<FormInstance>()

const captcha = reactive({ id: '', url: '', loading: false })

const form = reactive({
  username: '',
  password: '',
  confirm: '',
  nickname: '',
  email: '',
  captchaAnswer: ''
})

const rules = reactive<FormRules>({
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 20, message: '账号需 3-20 位字母、数字或下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位且需包含字母和数字', trigger: 'blur' }
  ],
  confirm: [{ required: true, message: '请再次输入密码', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  captchaAnswer: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
})

async function loadCaptcha() {
  captcha.loading = true
  try {
    const c = await fetchCaptcha()
    captcha.id = c.id
    captcha.url = captchaImageUrl(c)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    captcha.loading = false
  }
}

function onSegmentChange(v: string | number | boolean) {
  switchMode(String(v) as Mode)
}

function switchMode(next: Mode) {
  if (mode.value === next) return
  mode.value = next
  error.value = ''
  formRef.value?.clearValidate()
  if (next === 'register') loadCaptcha()
}

async function submit() {
  if (loading.value) return
  error.value = ''
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const isReg = mode.value === 'register'
  if (isReg && form.password !== form.confirm) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    if (isReg) {
      if (!captcha.id) {
        error.value = '验证码已失效，请点击刷新'
        return
      }
      await userStore.register({
        username: form.username,
        password: form.password,
        confirm: form.confirm,
        nickname: form.nickname,
        email: form.email.trim(),
        captchaId: captcha.id,
        captchaAnswer: form.captchaAnswer
      })
    } else {
      await userStore.login(form.username, form.password)
    }
    ElMessage.success(isReg ? '注册成功' : '登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e) {
    error.value = (e as Error).message || '操作失败'
    if (isReg) {
      form.captchaAnswer = ''
      loadCaptcha()
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCaptcha()
})
</script>

<template>
  <div class="login">
    <el-card class="login__card" shadow="always">
      <div class="login__brand">
        <div class="login__logo">
          <el-icon :size="28" color="var(--el-color-primary)"><Food /></el-icon>
        </div>
        <h1 class="login__title">冰箱剩余时间日历</h1>
        <p class="login__slogan">登录后管理你的食材保质期</p>
      </div>

      <el-segmented
        v-model="mode"
        class="login__segmented"
        :options="[
          { label: '登录', value: 'login' },
          { label: '注册', value: 'register' }
        ]"
        block
        @change="onSegmentChange"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent>
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入账号" :prefix-icon="User" maxlength="20" clearable />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
            :prefix-icon="Lock"
            maxlength="64"
          />
        </el-form-item>

        <template v-if="mode === 'register'">
          <el-form-item prop="confirm">
            <el-input
              v-model="form.confirm"
              type="password"
              show-password
              placeholder="请再次输入密码"
              :prefix-icon="Lock"
              maxlength="64"
            />
          </el-form-item>

          <el-form-item prop="nickname">
            <el-input v-model="form.nickname" placeholder="昵称（选填）" :prefix-icon="UserFilled" maxlength="20" />
          </el-form-item>

          <el-form-item prop="email">
            <el-input v-model="form.email" placeholder="邮箱（必填，用于过期提醒）" :prefix-icon="Message" maxlength="64" />
          </el-form-item>

          <el-form-item prop="captchaAnswer">
            <div class="login__captcha">
              <el-input
                v-model="form.captchaAnswer"
                placeholder="输入图中 4 位字符"
                :prefix-icon="Key"
                maxlength="6"
              />
              <div class="login__captcha-img" :class="{ 'is-loading': captcha.loading }" @click="loadCaptcha">
                <img v-if="captcha.url" :src="captcha.url" alt="验证码" />
                <span v-else>点击获取</span>
              </div>
            </div>
          </el-form-item>
          <el-text class="login__tip" size="small" type="info">
            看不清？点击右侧图片换一张（不区分大小写）
          </el-text>
        </template>
      </el-form>

      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="login__error" />

      <el-button type="primary" size="large" class="login__submit" :loading="loading" @click="submit">
        {{ mode === 'login' ? '登录' : '注册并登录' }}
      </el-button>

      <el-text class="login__footnote" size="small" type="info">
        {{
          mode === 'login'
            ? '还没有账号？切换到「注册」即可创建'
            : '账号 3-20 位字母/数字/下划线，密码至少 8 位且含字母和数字'
        }}
      </el-text>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, #eef4ff 0%, #f5f7fa 40%, #f5f7fa 100%);
}

.login__card {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  padding: 8px 4px;
}

.login__brand {
  text-align: center;
  margin-bottom: 20px;
}

.login__logo {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 14px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.login__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.login__slogan {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.login__segmented {
  margin-bottom: 18px;
}

.login__captcha {
  display: flex;
  gap: 12px;
  width: 100%;
}

.login__captcha-img {
  flex: 0 0 120px;
  height: 40px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  background: var(--el-fill-color-light);
  font-size: 12px;
  color: var(--el-text-color-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &.is-loading {
    opacity: 0.6;
  }
}

.login__tip {
  display: block;
  margin: -8px 0 8px;
}

.login__error {
  margin-bottom: 12px;
}

.login__submit {
  width: 100%;
}

.login__footnote {
  display: block;
  margin-top: 14px;
  text-align: center;
  line-height: 1.6;
}
</style>
