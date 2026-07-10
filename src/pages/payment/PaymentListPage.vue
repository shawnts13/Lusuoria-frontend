<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">红人结款管理</span>
      <a-space>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <a-button v-if="authStore.canManagePayments" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新建结款记录
        </a-button>
      </a-space>
    </div>

    <div class="filter-bar">
      <a-date-picker v-model:value="filters.settlementMonthVal"
        picker="month" format="YYYYMM" value-format="YYYYMM"
        placeholder="结算月份" style="width:140px"
        @change="v => { filters.settlementMonth = v; loadData() }" />
      <a-select v-model:value="filters.brandId" placeholder="品牌方" allow-clear show-search
        option-filter-prop="label" style="width:160px" @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队" allow-clear show-search
        option-filter-prop="label" style="width:140px" @change="loadData">
        <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.paymentStatus" placeholder="付款状态"
        style="width:120px" allow-clear @change="loadData">
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
      <a-table :columns="columns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brand'">
            {{ getBrandName(record.brandId) || '—' }}
          </template>
          <template v-if="column.key === 'team'">
            {{ getTeamName(record.teamId) || '—' }}
          </template>
          <template v-if="column.key === 'items'">
            <a @click="openItemsView(record)">查看涉及的红人视频项目</a>
          </template>
          <template v-if="column.key === 'payableAmount'">
            <strong>{{ record.currency }} {{ fmtNum(record.payableAmount) }}</strong>
          </template>
          <template v-if="column.key === 'paymentStatus'">
            <a-tag :color="record.paymentStatus === 'PAID' ? 'green' : 'orange'">
              {{ record.paymentStatus === 'PAID' ? '已付款' : '待付款' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canManagePayments">
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
      :brands="brands" :teams="teams" @saved="loadData" />

    <PaymentStatusModal
      v-model:visible="statusModalVisible"
      :record="statusModalRecord"
      @saved="loadData" />

    <PaymentItemSelectorModal
      v-model:visible="itemsViewVisible"
      mode="view"
      :existing-payment-id="itemsViewPaymentId" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ExportOutlined } from '@ant-design/icons-vue'
import { paymentApi, brandApi, influencerTeamApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { formatDate } from '../../utils/dateFormat'
import PaymentFormModal from './PaymentFormModal.vue'
import PaymentStatusModal from './PaymentStatusModal.vue'
import PaymentItemSelectorModal from './PaymentItemSelectorModal.vue'

const authStore = useAuthStore()
const loading   = ref(false)
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
const tableData = ref([])
const brands = ref([])
const teams  = ref([])
const modalVisible       = ref(false)
const editingRecord      = ref(null)
const statusModalVisible = ref(false)
const statusModalRecord  = ref(null)
const itemsViewVisible   = ref(false)
const itemsViewPaymentId = ref(null)

const pagination = reactive({ current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条` })
const filters = reactive({
  settlementMonth: undefined, settlementMonthVal: undefined,
  brandId: undefined, teamId: undefined, paymentStatus: undefined
})

const paymentStatuses = [
  { value: 'PENDING', label: '待付款' },
  { value: 'PAID',     label: '已付款' }
]

const columns = [
  { title: '结款单号',   dataIndex: 'paymentNo',       key: 'paymentNo',       width: 200 },
  { title: '品牌方',     key: 'brand', width: 120 },
  { title: '红人团队',   key: 'team', width: 120 },
  { title: '结算月份',   dataIndex: 'settlementMonth', key: 'settlementMonth', width: 90 },
  { title: '合作数量',   dataIndex: 'cooperationQuantity', key: 'qty', width: 80 },
  { title: '查看涉及的红人视频项目', key: 'items', width: 180 },
  { title: '应付金额',   key: 'payableAmount',  width: 130 },
  { title: '币种',       dataIndex: 'currency', key: 'currency', width: 70 },
  { title: '汇率',       dataIndex: 'exchangeRate', key: 'exchangeRate', width: 80,
    customRender: ({ text }) => text || '—' },
  { title: '人民币金额', dataIndex: 'rmbAmount', key: 'rmbAmount', width: 110,
    customRender: ({ text }) => text ? '¥' + fmtNum(text) : '—' },
  { title: '对账日期',   dataIndex: 'reconcileDate',       key: 'reconcileDate',       width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '预计付款日', dataIndex: 'expectedPaymentDate', key: 'expectedPaymentDate', width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '实际付款日', dataIndex: 'actualPaymentDate',   key: 'actualPaymentDate',   width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '付款状态',   key: 'paymentStatus', width: 100 },
  { title: '备注',       dataIndex: 'notes', key: 'notes', width: 160, ellipsis: true },
  { title: '操作',       key: 'action', width: 160, fixed: 'right' }
]
const tableScrollX = computed(() => columns.reduce((sum, c) => sum + (c.width || 120), 0))

function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// brand/team 关联对象在后端是 @JsonIgnore（跟"红人合作跟踪"模块同样的约定），
// 只有 brandId/teamId 会下发，名字要靠这两个本地已加载的列表自己查
function getBrandName(brandId) {
  return brands.value.find(b => b.id === brandId)?.name || ''
}
function getTeamName(teamId) {
  return teams.value.find(t => t.id === teamId)?.name || ''
}

async function loadData() {
  loading.value = true
  try {
    const res = await paymentApi.list({
      settlementMonth: filters.settlementMonth,
      brandId:         filters.brandId,
      teamId:          filters.teamId,
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
    brandId:undefined, teamId:undefined, paymentStatus:undefined })
  pagination.current = 1; loadData()
}
function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
function openStatusModal(r) { statusModalRecord.value = r; statusModalVisible.value = true }
function openItemsView(r) { itemsViewPaymentId.value = r.id; itemsViewVisible.value = true }

async function handleDelete(id) {
  await paymentApi.delete(id); message.success('删除成功'); loadData()
}
function handleExport() { paymentApi.exportExcel(filters.settlementMonth) }

onMounted(async () => {
  const [b, t] = await Promise.all([brandApi.list(), influencerTeamApi.list()])
  brands.value = b.data || []
  teams.value  = t.data || []
  loadData()
})
</script>
