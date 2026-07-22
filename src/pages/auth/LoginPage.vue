<template>
  <div class="login-page">
    <div class="login-box">
      <div class="login-logo">🌟 Lusuoria</div>
      <div class="login-subtitle">红人管理系统</div>

      <a-form
        :model="form"
        layout="vertical"
        @finish="handleLogin"
      >
        <a-form-item
          name="username"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <a-input
            v-model:value="form.username"
            size="large"
            placeholder="用户名"
            :prefix="h(UserOutlined)"
          />
        </a-form-item>

        <a-form-item
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <a-input-password
            v-model:value="form.password"
            size="large"
            placeholder="密码"
            :prefix="h(LockOutlined)"
          />
        </a-form-item>

        <a-button
          type="primary"
          html-type="submit"
          size="large"
          block
          :loading="loading"
          style="margin-top: 8px"
        >
          登 录
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { h, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '../../store/auth'

const router    = useRouter()
const authStore = useAuthStore()
const loading   = ref(false)

const form = reactive({ username: '', password: '' })

async function handleLogin() {
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    message.success('登录成功')
    router.push('/')
  } catch {
    // error already shown by http interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1677ff 0%, #0050b3 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-box {
  background: #fff;
  border-radius: 12px;
  padding: 48px 40px;
  width: 380px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.login-logo {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #1677ff;
  margin-bottom: 4px;
}

.login-subtitle {
  text-align: center;
  font-size: 14px;
  color: #888;
  margin-bottom: 32px;
}
</style>
