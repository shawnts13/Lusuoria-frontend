<template>
  <div class="reminder-section">
    <div class="reminder-header">
      <span class="reminder-title">进度提醒</span>
      <a-space v-if="authStore.isManagement">
        <a-button size="small" :loading="recomputing" @click="handleRecompute">结款后更新提示内容</a-button>
        <a-button size="small" :loading="recomputingProjectFlow" @click="handleRecomputeProjectFlow">
          项目流转后更新提示内容
        </a-button>
      </a-space>
    </div>
    <ProgressReminderCardList :reminders="reminders" :loading="loading"
      @view-detail="openDetail" />

    <ProgressReminderDetailModal v-model:visible="detailVisible" :reminder-id="detailReminderId"
      :category="detailCategory" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { progressReminderApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import ProgressReminderCardList from './ProgressReminderCardList.vue'
import ProgressReminderDetailModal from './ProgressReminderDetailModal.vue'

const authStore = useAuthStore()
const loading = ref(false)
const reminders = ref([])
const recomputing = ref(false)
const recomputingProjectFlow = ref(false)
const detailVisible = ref(false)
const detailReminderId = ref(null)
const detailCategory = ref(null)

async function loadData() {
  loading.value = true
  try {
    const res = await progressReminderApi.list()
    reminders.value = res.data || []
  } finally {
    loading.value = false
  }
}

function openDetail(r) {
  detailReminderId.value = r.id
  detailCategory.value = r.category
  detailVisible.value = true
}

async function handleRecompute() {
  recomputing.value = true
  try {
    const res = await progressReminderApi.recompute()
    reminders.value = res.data || []
    message.success('已重新生成最新的进度提醒')
  } finally {
    recomputing.value = false
  }
}

async function handleRecomputeProjectFlow() {
  recomputingProjectFlow.value = true
  try {
    const res = await progressReminderApi.recomputeProjectFlow()
    reminders.value = res.data || []
    message.success('已重新生成最新的进度提醒')
  } finally {
    recomputingProjectFlow.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.reminder-section {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border: 1px solid #f0f0f0;
}
.reminder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.reminder-title { font-size: 16px; font-weight: 600; }
</style>
