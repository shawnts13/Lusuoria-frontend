<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">待处理</span>
    </div>

    <div class="filter-bar">
      <a-select v-model:value="filters.category" placeholder="类别" style="width:160px"
        allow-clear @change="loadData">
        <a-select-option value="DELETE_REQUEST">删除审核</a-select-option>
      </a-select>
      <a-button @click="loadData">刷新</a-button>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading"
        row-key="id" size="middle" :pagination="pagination" @change="onTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'category'">
            <a-tag color="orange">{{ categoryLabel(record.category) }}</a-tag>
          </template>
          <template v-if="column.key === 'targetModule'">
            {{ moduleLabel(record.targetModule) }}
          </template>
          <template v-if="column.key === 'detail'">
            <a :href="detailLink(record)" target="_blank" rel="noopener">查看详情</a>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-popconfirm title="确认同意这条删除申请？同意后将真正执行删除。" @confirm="handleApprove(record)">
                <a style="color:#52c41a">同意</a>
              </a-popconfirm>
              <a-divider type="vertical" />
              <a style="color:#ff4d4f" @click="openReject(record)">拒绝</a>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal v-model:open="rejectVisible" title="拒绝删除申请" @ok="handleReject" :confirm-loading="rejecting">
      <a-form layout="vertical">
        <a-form-item label="拒绝原因（选填）">
          <a-textarea v-model:value="rejectNote" :rows="3" placeholder="可以说明一下为什么拒绝" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { pendingApprovalApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'

const loading = ref(false)
const list = ref([])
const filters = reactive({ category: undefined })
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })

const rejectVisible = ref(false)
const rejecting = ref(false)
const rejectNote = ref('')
const rejectTarget = ref(null)

const columns = [
  { title: '类别',       key: 'category',   width: 100 },
  { title: '所属模块',   key: 'targetModule', width: 120 },
  { title: '摘要',       dataIndex: 'targetSummary', key: 'targetSummary', width: 200 },
  { title: '内部项目编号', dataIndex: 'targetInternalProjectNo', key: 'targetInternalProjectNo', width: 200 },
  { title: '删除原因',   dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '发起人',     dataIndex: 'requestedBy', key: 'requestedBy', width: 100 },
  { title: '发起时间',   dataIndex: 'createdAt', key: 'createdAt', width: 160,
    customRender: ({ text }) => text ? formatDateTime(text) : '—' },
  { title: '查看详情',   key: 'detail', width: 90 },
  { title: '操作',       key: 'action', width: 120 }
]

function categoryLabel(c) { return c === 'DELETE_REQUEST' ? '删除审核' : c }
function moduleLabel(m) { return m === 'PROJECT_ORDER' ? '项目订单' : m === 'COLLABORATION_TRACKING' ? '红人合作跟踪' : m }

function detailLink(record) {
  const path = record.targetModule === 'PROJECT_ORDER' ? '/projects' : '/collaborations'
  return `${path}?internalProjectNo=${encodeURIComponent(record.targetInternalProjectNo || '')}`
}

async function loadData() {
  loading.value = true
  try {
    const res = await pendingApprovalApi.list(filters.category, pagination.current - 1, pagination.pageSize)
    list.value = res.data?.content || []
    pagination.total = res.data?.totalElements || 0
  } finally { loading.value = false }
}

function onTableChange(p) {
  pagination.current = p.current
  pagination.pageSize = p.pageSize
  loadData()
}

async function handleApprove(record) {
  await pendingApprovalApi.approve(record.id)
  message.success('已同意，删除已执行')
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
