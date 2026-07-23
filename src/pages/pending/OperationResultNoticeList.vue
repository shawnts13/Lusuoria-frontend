<template>
  <div v-if="list.length" class="notice-section">
    <div class="notice-title">处理结果通知</div>
    <div class="notice-list">
      <div v-for="n in list" :key="n.id" class="notice-card">
        <div class="notice-main">
          <a-tag :color="n.category === 'PROGRESS_ROLLBACK' ? 'gold' : 'red'">
            {{ categoryLabel(n.category) }}
          </a-tag>
          <span class="notice-text">
            {{ n.targetSummary }}（{{ n.targetInternalProjectNo }}）：
            <span :style="{ color: n.status === 'APPROVED' ? '#237804' : '#cf1322', fontWeight: 600 }">
              {{ n.status === 'APPROVED' ? '已同意' : '已拒绝' }}
            </span>
            <span v-if="n.status === 'REJECTED' && n.resolutionNote" style="color:#888">
              （原因：{{ n.resolutionNote }}）
            </span>
            <span style="color:#888">，处理时间 {{ formatDateTime(n.resolvedAt) }}</span>
          </span>
        </div>
        <a-popconfirm title="确认删除这条通知吗？" @confirm="handleDismiss(n)">
          <a style="color:#ff4d4f">确认删除</a>
        </a-popconfirm>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { pendingApprovalApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'

const list = ref([])

function categoryLabel(c) {
  if (c === 'DELETE_REQUEST') return '删除审核'
  if (c === 'PROGRESS_ROLLBACK') return '视频项目进度倒退审核'
  return c
}

async function loadData() {
  const res = await pendingApprovalApi.myNotifications()
  list.value = res.data || []
}

async function handleDismiss(n) {
  await pendingApprovalApi.dismiss(n.id)
  list.value = list.value.filter(x => x.id !== n.id)
}

onMounted(loadData)
</script>

<style scoped>
.notice-section {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border: 1px solid #f0f0f0;
}
.notice-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
.notice-list { display: flex; flex-direction: column; gap: 10px; }
.notice-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #eee;
  background: #fafafa;
  gap: 12px;
}
.notice-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; }
.notice-text { color: #333; }
</style>
