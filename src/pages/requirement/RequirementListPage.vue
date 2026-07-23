<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">1. 红人需求管理</span>
      <a-space>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <a-button v-if="authStore.canWrite" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新建需求
        </a-button>
      </a-space>
    </div>

    <div class="filter-bar">
      <a-select v-model:value="filters.brandId" placeholder="品牌方" style="width:150px" allow-clear
        show-search :filter-option="(input, opt) => opt.label.includes(input)" @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队" style="width:150px" allow-clear
        show-search :filter-option="(input, opt) => opt.label.includes(input)" @change="loadData">
        <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
      </a-select>
      <a-input-search v-model:value="filters.accountName" placeholder="搜索红人社媒完整名字"
        style="width:200px" @search="loadData" allow-clear />
      <a-date-picker v-model:value="filters.requirementMonth" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="需求月份" style="width:150px"
        allow-clear @change="loadData" />
      <a-input-search v-model:value="filters.internalRequirementNo" placeholder="搜索内部需求编号"
        style="width:200px" @search="loadData" allow-clear />
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
          <template v-if="column.key === 'brandName'">{{ getBrandName(record.brandId) || '—' }}</template>
          <template v-if="column.key === 'teamName'">{{ getTeamName(record.teamId) || '—' }}</template>
          <template v-if="column.key === 'accountName'">{{ getInfluencerName(record.influencerId) || '—' }}</template>
          <template v-if="column.key === 'fullRequirementContent'">
            <a @click="viewContent(record)">查看完整需求内容</a>
          </template>
          <template v-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
          <template v-if="column.key === 'items'">
            <a @click="viewItems(record)">查看涉及的红人需求条目</a>
          </template>
          <template v-if="column.key === 'totalClientPrice'">{{ fmtNum(record.totalClientPrice) }}</template>
          <template v-if="column.key === 'totalInfluencerCost'">{{ fmtNum(record.totalInfluencerCost) }}</template>
          <template v-if="column.key === 'progress'">
            <a @click="viewProgress(record)">
              {{ record.completedCount ?? 0 }}/{{ record.totalItemCount ?? 0 }}
            </a>
          </template>
          <template v-if="column.key === 'invoiceLink'">
            <span v-if="getBrand(record.brandId)?.requiresInvoice === false" style="color:#bbb">不涉及</span>
            <a v-else-if="record.invoiceLink" :href="record.invoiceLink" target="_blank" style="font-size:12px">查看Invoice</a>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite">
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a-tooltip :title="invoiceButtonState(record).tooltip">
                <span>
                  <a-button size="small" :disabled="invoiceButtonState(record).disabled"
                    @click="openInvoiceModal(record)">上传Invoice</a-button>
                </span>
              </a-tooltip>
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

    <a-modal v-model:open="contentModalVisible" title="完整需求内容" :footer="null" width="640px">
      <div style="white-space:pre-wrap;font-size:13px;line-height:1.6" v-html="highlightContent(contentModalText)"></div>
    </a-modal>

    <RequirementFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :brands="brands"
      :influencers="influencers"
      @saved="loadData"
    />

    <RequirementItemsViewModal v-model:visible="itemsModalVisible" :requirement-id="itemsModalRequirementId" />

    <RequirementProgressModal v-model:visible="progressModalVisible" :requirement-id="progressModalRequirementId" />

    <RequirementInvoiceModal v-model:visible="invoiceModalVisible" :requirement="invoiceModalRequirement"
      @saved="loadData" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, ExportOutlined } from '@ant-design/icons-vue'
import { requirementApi, brandApi, influencerApi, influencerTeamApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { formatDateTime } from '../../utils/dateFormat'
import RequirementFormModal from './RequirementFormModal.vue'
import RequirementItemsViewModal from './RequirementItemsViewModal.vue'
import RequirementProgressModal from './RequirementProgressModal.vue'
import RequirementInvoiceModal from './RequirementInvoiceModal.vue'

const authStore = useAuthStore()
const route = useRoute()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading     = ref(false)
const tableData   = ref([])
const brands      = ref([])
const teams       = ref([])
const influencers = ref([])

const modalVisible  = ref(false)
const editingRecord = ref(null)

const contentModalVisible = ref(false)
const contentModalText    = ref('')

const itemsModalVisible = ref(false)
const itemsModalRequirementId = ref(null)

const progressModalVisible = ref(false)
const progressModalRequirementId = ref(null)

const invoiceModalVisible = ref(false)
const invoiceModalRequirement = ref(null)

const sortState = reactive({ field: 'id', order: 'descend' })
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  brandId: undefined, teamId: undefined, accountName: undefined,
  requirementMonth: undefined,
  // 支持从"进度提醒"详情等外部入口带 internalRequirementNo 跳转过来直接定位
  internalRequirementNo: route.query.internalRequirementNo || undefined
})

// 列顺序按需求描述：内部需求编号、需求月份、品牌方、红人团队、服务国家/市场、红人社媒完整名字、
// 完整需求内容、创建时间、查看涉及的红人需求条目、需求条目总数、客户合作总价格、
// 红人视频制作与发布总成本、需求完成进度
const columns = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 200, sorter: true },
  { title: '需求月份', dataIndex: 'requirementMonth', key: 'requirementMonth', width: 110, sorter: true },
  { title: '品牌方', key: 'brandName', width: 130 },
  { title: '红人团队', key: 'teamName', width: 110 },
  { title: '服务国家/市场', dataIndex: 'countryMarket', key: 'countryMarket', width: 120 },
  { title: '红人社媒完整名字', key: 'accountName', width: 150 },
  { title: '完整需求内容', key: 'fullRequirementContent', width: 150 },
  { title: '创建时间', key: 'createdAt', width: 160, sorter: true },
  { title: '涉及的红人需求条目', key: 'items', width: 160 },
  { title: '需求条目总数', dataIndex: 'totalItemCount', key: 'totalItemCount', width: 120, sorter: true },
  { title: '客户合作总价格（$）', key: 'totalClientPrice', width: 160, sorter: true },
  { title: '红人视频制作与发布总成本（$）', key: 'totalInfluencerCost', width: 200, sorter: true },
  { title: '需求完成进度', key: 'progress', width: 120 },
  { title: '备注', dataIndex: 'notes', key: 'notes', width: 160, ellipsis: true },
  { title: 'Invoice链接', key: 'invoiceLink', width: 110 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' }
]
const tableScrollX = computed(() => columns.reduce((sum, c) => sum + (c.width || 120), 0))

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
// "查看完整需求内容"弹窗高亮：原文是自由文本，不是结构化字段，用正则给已知标签/金额上色，
// 方便一眼看出重要信息。先转义再上色，避免用户自由文本里带 <> 之类字符被当成 HTML 注入
function highlightContent(text) {
  if (!text) return ''
  let html = escapeHtml(text)
  // 客户/红人价格类标签（含"合作价格"这种不带前缀的不规范写法）用蓝色加粗强调
  html = html.replace(/(客户价格|客户合作价格|红人成本|红人合作成本|合作价格)(（[^）]*）)?([：:])/g,
    '<span style="color:#1677ff;font-weight:600">$1$2$3</span>')
  // 其余常见标签弱化成灰色，降低视觉噪音，衬托真正重要的价格/金额信息
  html = html.replace(/(红人区域|红人完整名字|红人社媒完整名字|红人TEMU系统ID|下单条数|下单机构|投流期限|版权)([：:])/g,
    '<span style="color:#888">$1$2</span>')
  // "其他权益"小标题
  html = html.replace(/(其他权益)/g, '<span style="color:#666;font-weight:600">$1</span>')
  // USD 金额单独标红加粗，是全文最需要一眼看到的数字
  html = html.replace(/([\d.]+\s*USD)/g, '<span style="color:#c00000;font-weight:600">$1</span>')
  return html
}
function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function getBrand(id) { return brands.value.find(b => b.id === id) }
function getBrandName(id) { return getBrand(id)?.name }

// "上传Invoice"按钮的禁用状态+悬浮提示：品牌方不涉及invoice上传 优先于 "需求未实施完成"
function invoiceButtonState(record) {
  const brand = getBrand(record.brandId)
  if (brand && brand.requiresInvoice === false) {
    return { disabled: true, tooltip: '该品牌方不涉及Invoice上传' }
  }
  const total = record.totalItemCount ?? 0
  const done = total > 0 && (record.completedCount ?? 0) >= total
  return done
    ? { disabled: false, tooltip: null }
    : { disabled: true, tooltip: '该需求尚未实施完成，还无需上传Invoice' }
}
function getTeamName(id) { return teams.value.find(t => t.id === id)?.name }
function getInfluencerName(id) { return influencers.value.find(i => i.id === id)?.accountName }

async function loadData() {
  loading.value = true
  try {
    const res = await requirementApi.list({
      brandId: filters.brandId,
      teamId: filters.teamId,
      accountName: filters.accountName?.trim() || undefined,
      requirementMonth: filters.requirementMonth?.trim() || undefined,
      internalRequirementNo: filters.internalRequirementNo?.trim() || undefined,
      sortBy: sortState.field,
      sortDir: sortState.order === 'descend' ? 'desc' : 'asc',
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

function handleTableChange(pag, _filters, sorter) {
  pagination.current  = pag.current
  pagination.pageSize = pag.pageSize
  if (sorter && sorter.field) {
    sortState.field = sorter.field
    sortState.order = sorter.order || 'ascend'
  }
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    brandId: undefined, teamId: undefined, accountName: undefined,
    requirementMonth: undefined, internalRequirementNo: undefined
  })
  pagination.current = 1
  sortState.field = 'id'
  sortState.order = 'descend'
  loadData()
}

function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
async function handleDelete(id) {
  try {
    await requirementApi.delete(id)
    message.success('删除成功')
    loadData()
  } catch (e) {
    message.error(e?.response?.data?.message || '删除失败')
  }
}
function handleExport() {
  requirementApi.exportExcel({
    brandId: filters.brandId,
    teamId: filters.teamId,
    accountName: filters.accountName,
    requirementMonth: filters.requirementMonth,
    internalRequirementNo: filters.internalRequirementNo
  })
}
function viewContent(record) {
  contentModalText.value = record.fullRequirementContent || '（空）'
  contentModalVisible.value = true
}
function viewItems(record) {
  itemsModalRequirementId.value = record.id
  itemsModalVisible.value = true
}
function viewProgress(record) {
  progressModalRequirementId.value = record.id
  progressModalVisible.value = true
}
function openInvoiceModal(record) {
  invoiceModalRequirement.value = record
  invoiceModalVisible.value = true
}

onMounted(async () => {
  const [b, t, i] = await Promise.all([brandApi.list(), influencerTeamApi.list(), influencerApi.simple()])
  brands.value      = b.data || []
  teams.value       = t.data || []
  influencers.value = i.data || []
  loadData()
})
</script>
