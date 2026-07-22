<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">导入历史{{ moduleLabel ? '（' + moduleLabel + '）' : '' }}</span>
      <a-space>
        <a-button @click="loadData"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button @click="router.back()">返回</a-button>
      </a-space>
    </div>

    <a-table :columns="columns" :data-source="tableData" :loading="loading" row-key="id"
      :pagination="pagination" @change="handleTableChange" size="middle">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag v-if="record.status === 'PROCESSING'" color="processing">处理中</a-tag>
          <a-tag v-else-if="record.status === 'COMPLETED'" color="success">已完成</a-tag>
          <a-tag v-else-if="record.status === 'FAILED'" color="error">失败</a-tag>
        </template>
        <template v-if="column.key === 'summary'">
          <div v-if="record.status === 'PROCESSING'">
            <a-progress v-if="record.totalRows"
              :percent="Math.round((record.processedCount || 0) / record.totalRows * 100)"
              size="small" style="max-width:220px" />
            <span style="color:#1677ff; font-size:12px">
              {{ record.totalRows ? `${record.processedCount ?? 0} / ${record.totalRows} 行` : '正在读取文件…' }}
            </span>
          </div>
          <span v-else-if="record.status === 'FAILED'" style="color:#ff4d4f">{{ record.errorMessage || '导入失败' }}</span>
          <span v-else>
            新增 {{ record.successCount ?? 0 }}，更新 {{ record.updateCount ?? 0 }}，
            失败 {{ record.failCount ?? 0 }}（共 {{ record.totalRows ?? 0 }} 行）
          </span>
        </template>
        <template v-if="column.key === 'action'">
          <a @click="openDetail(record)">查看详情</a>
          <a-popconfirm v-if="authStore.canDeleteImportBatch"
            title="确定删除这条导入历史记录吗？（只删记录本身，不影响这次导入已经写入的数据）"
            @confirm="handleDelete(record)">
            <a style="margin-left:12px;color:#ff4d4f">删除</a>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="detailVisible" title="导入详情" :footer="null" width="600px">
      <div style="margin-bottom:12px; color:#888; font-size:13px" v-if="detailRecord">
        {{ detailRecord.fileName }}　上传人：{{ detailRecord.uploadedByName }}
      </div>
      <a-list v-if="detailRecord?.status === 'COMPLETED'"
        :data-source="(detailRecord.resultDetail || '').split('\n')" size="small">
        <template #renderItem="{ item, index }">
          <a-list-item>
            <span :style="index === 0 ? 'font-weight:600;color:#1677ff'
              : (item.includes('失败') ? 'color:#ff4d4f' : '')">{{ item }}</span>
          </a-list-item>
        </template>
      </a-list>
      <div v-else-if="detailRecord?.status === 'FAILED'" style="color:#ff4d4f">
        {{ detailRecord.errorMessage || '导入失败，没有具体错误信息' }}
      </div>
      <div v-else style="color:#999">还在处理中，请稍后再查看</div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { importBatchApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '../../store/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 从路由带的 ?module= 决定看哪个模块的导入历史，不传就是原来的红人合作跟踪
// （保持向后兼容，老的跳转链接不用改）
const MODULE_LABELS = { COLLABORATION_TRACKING: '红人合作跟踪', INFLUENCER: '红人管理' }
const currentModule = computed(() => route.query.module || 'COLLABORATION_TRACKING')
const moduleLabel = computed(() => MODULE_LABELS[currentModule.value] || '')

const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })

const columns = [
  { title: '文件名',   dataIndex: 'fileName',       key: 'fileName',   width: 220, ellipsis: true },
  { title: '上传人',   dataIndex: 'uploadedByName', key: 'uploadedByName', width: 100 },
  { title: '开始时间', key: 'startedAt', width: 160,
    customRender: ({ record }) => record.startedAt ? formatDateTime(record.startedAt) : '—' },
  { title: '完成时间', key: 'completedAt', width: 160,
    customRender: ({ record }) => record.completedAt ? formatDateTime(record.completedAt) : '—' },
  { title: '状态',     key: 'status',  width: 100 },
  { title: '结果摘要', key: 'summary' },
  { title: '操作',     key: 'action',  width: 90 }
]

const detailVisible = ref(false)
const detailRecord  = ref(null)
function openDetail(r) { detailRecord.value = r; detailVisible.value = true }

let pollTimer = null

async function loadData() {
  loading.value = true
  try {
    const res = await importBatchApi.list({
      module: currentModule.value,
      page: pagination.current - 1, size: pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
  } finally {
    loading.value = false
  }
}

async function handleDelete(record) {
  await importBatchApi.remove(record.id)
  message.success('已删除')
  loadData()
}

function handleTableChange(pag) {
  pagination.current = pag.current; pagination.pageSize = pag.pageSize
  loadData()
}

onMounted(() => {
  loadData()
  // 只要列表里还有"处理中"的批次，就每隔几秒自动刷新一次，省得手动点刷新；
  // 离开这个页面就停止轮询
  pollTimer = setInterval(() => {
    if (tableData.value.some(b => b.status === 'PROCESSING')) loadData()
  }, 5000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>
