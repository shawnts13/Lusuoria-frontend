<template>
  <div class="reminder-section">
    <div class="reminder-header">
      <span class="reminder-title">进度提醒</span>
      <a-space v-if="authStore.isManagement">
        <a-button size="small" :loading="recomputing" @click="handleRecompute">结款后更新提示内容</a-button>
        <a-button size="small" :loading="recomputingProjectFlow" @click="handleRecomputeProjectFlow">
          {{ recomputingProjectFlow ? '正在后台计算中…' : '项目流转后更新提示内容' }}
        </a-button>
      </a-space>
    </div>
    <ProgressReminderCardList :reminders="reminders" :loading="loading"
      @view-detail="openDetail" />

    <ProgressReminderDetailModal v-model:visible="detailVisible" :reminder-id="detailReminderId"
      :category="detailCategory" :urgency="detailUrgency" :overdue-urgency="detailOverdueUrgency" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
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
const detailUrgency = ref(null)
const detailOverdueUrgency = ref(null)

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
  detailUrgency.value = r.urgency
  detailOverdueUrgency.value = r.overdueUrgency
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

// "项目流转后更新提示内容"（2026-08-21 改成异步）：这个操作是全表扫描，数据量越大越慢，
// 之前同步等待连120秒超时都不够用，改成"触发后台计算 + 轮询状态"，不再用一次 await 死等
// 到底。POLL_INTERVAL_MS 定时器句柄存在组件作用域，方便离开页面时清掉，避免残留定时器
const POLL_INTERVAL_MS = 3000
let recomputePollTimer = null

function stopRecomputePolling() {
  if (recomputePollTimer) {
    clearInterval(recomputePollTimer)
    recomputePollTimer = null
  }
}

/** 轮询一次后台计算状态；跑完了（running=false）就停止轮询、刷新提醒列表、给出提示 */
async function pollRecomputeStatus() {
  const res = await progressReminderApi.recomputeProjectFlowStatus()
  const status = res.data || {}
  if (status.running) return // 还在跑，继续等下一次轮询
  stopRecomputePolling()
  recomputingProjectFlow.value = false
  if (status.error) {
    message.error('重新计算失败：' + status.error)
  } else {
    message.success('已重新生成最新的进度提醒')
  }
  await loadData() // 不管成功/失败都刷新一次列表，失败时至少展示上一次的有效数据
}

async function handleRecomputeProjectFlow() {
  if (recomputingProjectFlow.value) return // 已经在轮询中，避免重复点击又发起一次触发请求
  recomputingProjectFlow.value = true
  try {
    const res = await progressReminderApi.recomputeProjectFlow()
    // started=false 表示已经有一次在后台跑（比如另一个管理层账号也点了这个按钮）——不算
    // 错误，照样进入轮询等待，只是不是"我"触发的这一次
    if (res.data && res.data.started === false) {
      message.info('已经有一次计算正在后台进行，将持续等待其完成')
    }
    stopRecomputePolling()
    recomputePollTimer = setInterval(pollRecomputeStatus, POLL_INTERVAL_MS)
  } catch (e) {
    recomputingProjectFlow.value = false
    throw e
  }
}

/** 页面刚加载时，先查一次有没有上次遗留（比如刚才离开页面时还没跑完）还在跑的后台计算，
 *  有的话直接接上轮询，不然按钮会显示成"可以点"，实际后台还在算，容易让人误以为没生效 */
async function checkRecomputeStatusOnMount() {
  const res = await progressReminderApi.recomputeProjectFlowStatus()
  if (res.data && res.data.running) {
    recomputingProjectFlow.value = true
    recomputePollTimer = setInterval(pollRecomputeStatus, POLL_INTERVAL_MS)
  }
}

onMounted(() => {
  loadData()
  if (authStore.isManagement) checkRecomputeStatusOnMount()
})
onUnmounted(stopRecomputePolling)
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
