<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { changePassword } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { getUser } from '@/utils/storage'

const router = useRouter()
const userStore = useUserStore()

// 管理员重置密码后登录，会带着 mustChangePassword 标记，此时弹窗不可关闭
const forced = computed(() => getUser()?.mustChangePassword === true)

const formRef = ref<FormInstance>()
const saving = ref(false)
const form = reactive({ oldPassword: '', password: '', confirm: '' })

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码需同时包含字母和数字', trigger: 'blur' }
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await changePassword({ ...form })
    ElMessage.success('密码已修改，请使用新密码重新登录')
    userStore.clear()
    router.replace('/login')
  } catch (e) {
    ElMessage.error((e as Error).message || '修改密码失败')
  } finally {
    saving.value = false
  }
}

function onClose() {
  if (forced.value) return
  router.replace(userStore.isAdmin ? '/admin' : '/')
}
</script>

<template>
  <div class="pwd-page">
    <el-dialog
      :model-value="true"
      title="修改密码"
      width="420px"
      align-center
      :show-close="!forced"
      :close-on-click-modal="false"
      :close-on-press-escape="!forced"
      @close="onClose"
    >
      <el-alert
        v-if="forced"
        type="warning"
        :closable="false"
        class="mb-16"
        title="管理员已重置你的密码，请先设置新密码再继续使用"
      />

      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent>
        <el-form-item prop="oldPassword">
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            placeholder="原密码（被重置时为管理员提供的初始密码）"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="新密码（至少 8 位，含字母和数字）"
          />
        </el-form-item>
        <el-form-item prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            show-password
            placeholder="确认新密码"
            @keyup.enter="submit"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button v-if="!forced" @click="onClose">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存并重新登录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.pwd-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}
</style>
