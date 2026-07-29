<template>
  <div v-if="alert" class="backup-alert-section">
    <a-alert type="error" show-icon>
      <template #message>
        <span style="font-weight:600">数据库每日备份失败</span>
      </template>
      <template #description>
        <div>最近一次失败：{{ formatDateTime(alert.lastFailedAt) }}（连续失败 {{ alert.failureCount }} 次）</div>
        <div style="color:#595959;margin-top:2px">{{ alert.errorMessage }}</div>
        <div style="margin-top:10px">
          <a-button v-if="alert.authExpired" size="small" type="primary" @click="goReconnect">
            去账号管理重新连接 Google Drive
          </a-button>
          <a-button v-else size="small" type="primary" :loading="retrying" @click="handleRetry">
            重试
          </a-button>
        </div>
      </template>
    </a-alert>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { dbBackupApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'

const router = useRouter()
const alert = ref(null)
const retrying = ref(false)

async function loadAlert() {
  const res = await dbBackupApi.alert()
  alert.value = res.data || null
}

function goReconnect() {
  router.push('/users')
}

async function handleRetry() {
  retrying.value = true
  try {
    await dbBackupApi.retry()
    message.success('备份重试成功')
  } catch (e) {
    // 失败的错误提示已经由 http.js 的全局拦截器弹出来了，这里不用再弹一遍，
    // 只需要重新拉一下最新的失败次数/错误信息（重试失败也会更新 lastFailedAt/failureCount）
  } finally {
    await loadAlert()
    retrying.value = false
  }
}

onMounted(loadAlert)
</script>

<style scoped>
.backup-alert-section {
  margin-bottom: 20px;
}
</style>
