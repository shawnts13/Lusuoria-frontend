<template>
  <a-modal :open="visible" title="进度提醒" width="640px" :closable="false" :mask-closable="false">
    <ProgressReminderCardList :reminders="reminders" :show-detail-button="false" />
    <template #footer>
      <a-button @click="handleDismiss">我知道了</a-button>
      <a-button type="primary" @click="handleGoToPending">跳转至待处理页面</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { progressReminderApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import ProgressReminderCardList from './ProgressReminderCardList.vue'

const authStore = useAuthStore()
const router = useRouter()

const visible = ref(false)
const reminders = ref([])

async function checkAndMaybeShow() {
  // 2026-07 起不再局限于管理层——后端 shouldShowPopup()/list() 已经按当前登录账号的身份
  // （ADMIN/管理层看全部，项目负责人/执行人员/财务看各自范围）返回正确的子集，这里只挡访客
  if (authStore.isGuest) return
  try {
    const res = await progressReminderApi.popupCheck()
    if (!res.data?.shouldShow) return
    const listRes = await progressReminderApi.list()
    reminders.value = listRes.data || []
    // 进度提醒本身都没有的话，弹一个空窗没有意义，直接静默标记为已看过
    if (!reminders.value.length) {
      await progressReminderApi.popupDismiss()
      return
    }
    visible.value = true
  } catch (e) { /* 弹窗检查失败不影响正常使用，静默忽略 */ }
}

async function dismiss() {
  visible.value = false
  try { await progressReminderApi.popupDismiss() } catch (e) { /* ignore */ }
}

function handleDismiss() { dismiss() }
function handleGoToPending() {
  dismiss()
  router.push('/pending')
}

onMounted(checkAndMaybeShow)
</script>
