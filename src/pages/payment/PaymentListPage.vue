<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">红人结款管理</span>
      <a-space>
        <a-button @click="paymentApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <template v-if="authStore.canWrite">
          <a-upload :before-upload="handleImport" :show-upload-list="false" accept=".xlsx,.xls">
            <a-button><template #icon><UploadOutlined /></template>Excel 导入</a-button>
          </a-upload>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>新建结款记录
          </a-button>
        </template>
      </a-space>
    </div>

    <div class="filter-bar">
      <a-date-picker v-model:value="filters.settlementMonthVal"
        picker="month" format="YYYYMM" value-format="YYYYMM"
        placeholder="结算月份" style="width:140px"
        @change="v => { filters.settlementMonth = v; loadData() }" />
      <a-select v-model:value="filters.influencerId" placeholder="红人"
        style="width:180px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
        @change="loadData">
        <a-select-option v-for="inf in influencers" :key="inf.id" :value="inf.id"
          :label="inf.accountName">
          {{ inf.teamNames ? `[${inf.teamNames.split(',')[0]}] ` : '' }}{{ inf.accountName }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.paymentStatus" placeholder="付款状态"
        style="width:140px" allow-clear @change="loadData">
        <a-select-option v-for="s in paymentStatuses" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-select-option>
      </a-select>
      <a-button @click="resetFilters">重置</a-button>
    </div>

    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="visibleColumns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'payableAmount'">
            <strong>{{ record.currency }} {{ fmtNum(record.payableAmount) }}</strong>
          </template>
          <template v-if="column.key === 'paymentStatus'">
            <a-tag :color="statusColor(record.paymentStatus)">
              {{ record.paymentStatus ? statusLabel(record.paymentStatus) : '—' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite">
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a @click="openStatusModal(record)">状态流转</a>
              <a-divider type="vertical" />
              <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
                <a style="color:#ff4d4f">删除</a>
              </a-popconfirm>
            </a-space>
            <span v-else style="color:#bbb">只读</span>
          </template>
        </template>
      </a-table>
    </div>

    <PaymentFormModal v-model:visible="modalVisible" :record="editingRecord"
      :influencers="influencers" @saved="loadData" />

    <PaymentStatusModal
      v-model:visible="statusModalVisible"
      :record="statusModalRecord"
      @saved="loadData" />

    <!-- 导入结果 -->
    <a-modal v-model:open="importResultVisible" title="导入结果" :footer="null" width="560px">
      <a-list :data-source="importResults" size="small"
        :pagination="importResults.length > 10 ? { pageSize: 10 } : false">
        <template #renderItem="{ item, index }">
          <a-list-item>
            <span :style="index === 0 ? 'font-weight:600;color:#1677ff'
              : (item.includes('失败') ? 'color:#ff4d4f' : '')">{{ item }}</span>
          </a-list-item>
        </template>
      </a-list>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { paymentApi, influencerApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import PaymentFormModal from './PaymentFormModal.vue'
import PaymentStatusModal from './PaymentStatusModal.vue'

const authStore = useAuthStore()
const loading   = ref(false)
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
const tableData = ref([])
const influencers = ref([])
const modalVisible       = ref(false)
const editingRecord      = ref(null)
const statusModalVisible = ref(false)
const statusModalRecord  = ref(null)
const importResultVisible = ref(false)
const importResults      = ref([])

const pagination = reactive({ current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条` })
const filters = reactive({
  settlementMonth: undefined, settlementMonthVal: undefined,
  influencerId: undefined, paymentStatus: undefined
})

const paymentStatuses = [
  { value: 'PENDING_RECONCILE', label: '待对账' },
  { value: 'RECONCILED',        label: '已对账' },
  { value: 'PENDING_PAYMENT',   label: '待付款' },
  { value: 'PARTIAL_PAYMENT',   label: '部分付款' },
  { value: 'PAID',              label: '已付款' },
  { value: 'ABNORMAL',          label: '异常' }
]

// 敏感列：应付金额、人民币金额、已付金额
const allColumns = [
  { title: '结款单号',   dataIndex: 'paymentNo',       key: 'paymentNo',       width: 180 },
  { title: '结算月份',   dataIndex: 'settlementMonth', key: 'settlementMonth', width: 90 },
  { title: '红人团队',   key: 'team',   width: 120,
    customRender: ({ record }) => record.influencer?.teamNames?.split(',')[0] || '—' },
  { title: '红人社媒完整名字', key: 'account', width: 160,
    customRender: ({ record }) => record.influencer?.accountName || '—' },
  { title: '合作内容',   dataIndex: 'cooperationContent',  key: 'cooperationContent',  width: 120 },
  { title: '合作数量',   dataIndex: 'cooperationQuantity', key: 'qty',                 width: 80 },
  { title: '红人单价',   dataIndex: 'influencerUnitPrice', key: 'influencerUnitPrice', width: 110,
    customRender: ({ text }) => fmtNum(text) },
  // 敏感列
  { title: '应付金额',   key: 'payableAmount',  width: 130 },
  { title: '币种',       dataIndex: 'currency', key: 'currency', width: 70 },
  { title: '汇率',       dataIndex: 'exchangeRate', key: 'exchangeRate', width: 80,
    customRender: ({ text }) => text || '—' },
  { title: '人民币金额', dataIndex: 'rmbAmount', key: 'rmbAmount', width: 110,
    customRender: ({ text }) => text ? '¥' + fmtNum(text) : '—' },
  { title: '对账日期',   dataIndex: 'reconcileDate',       key: 'reconcileDate',       width: 110 },
  { title: '预计付款日', dataIndex: 'expectedPaymentDate', key: 'expectedPaymentDate', width: 110 },
  { title: '实际付款日', dataIndex: 'actualPaymentDate',   key: 'actualPaymentDate',   width: 110 },
  { title: '付款状态',   key: 'paymentStatus',             width: 100 },
  { title: '已付金额',   dataIndex: 'paidAmount', key: 'paidAmount', width: 110,
    customRender: ({ text }) => fmtNum(text) },
  { title: '操作',       key: 'action', width: 120, fixed: 'right' }
]

const visibleColumns = computed(() =>
  allColumns.filter(col => !col.sensitive || authStore.canViewFinancials)
)
const tableScrollX = computed(() =>
  visibleColumns.value.reduce((sum, c) => sum + (c.width || 120), 0)
)

function statusColor(s) {
  const m = { PENDING_RECONCILE:'default', RECONCILED:'processing',
    PENDING_PAYMENT:'orange', PARTIAL_PAYMENT:'gold', PAID:'green', ABNORMAL:'red' }
  return m[s] || 'default'
}
function statusLabel(s) {
  const m = { PENDING_RECONCILE:'待对账', RECONCILED:'已对账',
    PENDING_PAYMENT:'待付款', PARTIAL_PAYMENT:'部分付款', PAID:'已付款', ABNORMAL:'异常' }
  return m[s] || s
}
function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function loadData() {
  loading.value = true
  try {
    const res = await paymentApi.list({
      settlementMonth: filters.settlementMonth,
      influencerId:    filters.influencerId,
      paymentStatus:   filters.paymentStatus,
      page: pagination.current - 1,
      size: pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
  } finally {
    loading.value = false
    remeasure()
  }
}

function handleTableChange(pag) {
  pagination.current = pag.current; pagination.pageSize = pag.pageSize; loadData()
}
function resetFilters() {
  Object.assign(filters, { settlementMonth:undefined, settlementMonthVal:undefined,
    influencerId:undefined, paymentStatus:undefined })
  pagination.current = 1; loadData()
}
function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
function openStatusModal(r) { statusModalRecord.value = r; statusModalVisible.value = true }

async function handleDelete(id) {
  await paymentApi.delete(id); message.success('删除成功'); loadData()
}
function handleExport() { paymentApi.exportExcel(filters.settlementMonth) }

async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    const res = await paymentApi.importExcel(fd)
    importResults.value = res.data || []; importResultVisible.value = true; loadData()
  } catch {}
  return false
}

onMounted(async () => {
  const inf = await influencerApi.simple()
  influencers.value = inf.data || []
  loadData()
})
</script>
