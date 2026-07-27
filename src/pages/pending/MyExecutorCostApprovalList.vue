<template>
  <div v-if="list.length" class="approval-section">
    <div class="approval-title">待我审核（内部执行成本修改）</div>
    <div class="approval-list">
      <div v-for="p in list" :key="p.id" class="approval-card">
        <div class="approval-main">
          <a-tag color="purple">内部执行成本修改审核</a-tag>
          <span class="approval-text">
            {{ p.targetSummary }}（{{ p.targetInternalProjectNo }}）：
            <span style="color:#262626">{{ p.reason }}</span>
            <span style="color:#595959">，发起人 {{ p.requestedBy }}，发起时间 {{ formatDateTime(p.createdAt) }}</span>
          </span>
          <a :href="detailLink(p)" target="_blank" rel="noopener">查看详情</a>
        </div>
        <a-space>
          <a-popconfirm title="确认同意这次内部执行成本修改？同意后立即生效。" @confirm="handleApprove(p)">
            <a style="color:#52c41a">同意</a>
          </a-popconfirm>
          <a-divider type="vertical" />
          <a style="color:#ff4d4f" @click="openReject(p)">拒绝</a>
        </a-space>
      </div>
    </div>

    <a-modal v-model:open="rejectVisible" title="拒绝申请" @ok="handleReject" :confirm-loading="rejecting">
      <a-form layout="vertical">
        <a-form-item label="拒绝原因（选填）">
          <a-textarea v-model:value="rejectNote" :rows="3" placeholder="可以说明一下为什么拒绝" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { pendingApprovalApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'

const list = ref([])

const rejectVisible = ref(false)
const rejecting = ref(false)
const rejectNote = ref('')
const rejectTarget = ref(null)

function detailLink(record) {
  return `/collaborations?internalProjectNo=${encodeURIComponent(record.targetInternalProjectNo || '')}`
}

async function loadData() {
  const res = await pendingApprovalApi.myApprovals()
  list.value = res.data || []
}

async function handleApprove(record) {
  await pendingApprovalApi.approve(record.id)
  message.success('已同意，内部执行成本已更新')
  loadData()
}

function openReject(record) {
  rejectTarget.value = record
  rejectNote.value = ''
  rejectVisible.value = true
}

async function handleReject() {
  rejecting.value = true
  try {
    await pendingApprovalApi.reject(rejectTarget.value.id, rejectNote.value || null)
    message.success('已拒绝')
    rejectVisible.value = false
    loadData()
  } finally { rejecting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.approval-section {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border: 1px solid #f0f0f0;
}
.approval-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
.approval-list { display: flex; flex-direction: column; gap: 10px; }
.approval-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #eee;
  background: #fafafa;
  gap: 12px;
}
.approval-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; }
.approval-text { color: #333; }
</style>
