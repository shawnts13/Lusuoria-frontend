<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">红人合作跟踪</span>
      <a-space>
        <a-button @click="collaborationApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <template v-if="authStore.canWrite">
          <a-upload :before-upload="handleImport" :show-upload-list="false" accept=".xlsx,.xls">
            <a-button><template #icon><UploadOutlined /></template>Excel 导入</a-button>
          </a-upload>
          <a-button @click="router.push('/import-batches')" style="color:#fa8c16;border-color:#fa8c16">
            <template #icon><HistoryOutlined /></template>导入历史
          </a-button>
          <a-button type="primary" @click="batchCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>新建跟踪
          </a-button>
          <a-button @click="legacyLinkModalVisible = true">
            <template #icon><LinkOutlined /></template>存量记录关联需求
          </a-button>
        </template>
        <a-popconfirm v-if="authStore.isAdmin"
          title="重新计算所有记录的项目毛利/可分配利润/提成/公司利润？用于数据库里的原始金额被绕过系统直接改动后的善后，正常使用不需要点这个。"
          @confirm="handleRecomputeProfits">
          <a-button :loading="recomputing">重新计算利润</a-button>
        </a-popconfirm>
      </a-space>
    </div>

    <!-- 筛选条件 -->
    <div class="filter-bar">
      <a-select v-model:value="filters.brandId" placeholder="品牌方"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.countryMarket" placeholder="服务国家/市场"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.value.includes(input)"
        @change="loadData">
        <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-input v-model:value="filters.accountName" placeholder="红人社媒完整名字" style="width:160px"
        allow-clear @press-enter="loadData" />
      <a-select v-model:value="filters.platform" placeholder="合作平台"
        style="width:120px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-tooltip :title="filters.progress ? getLabel('collab_progress', filters.progress) : ''">
        <a-select v-model:value="filters.progress" placeholder="视频项目进度"
          style="width:140px" allow-clear @change="loadData">
          <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </a-tooltip>
      <a-select v-model:value="filters.videoType" placeholder="项目视频类型"
        style="width:140px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-date-picker v-model:value="filters.videoMonthVal" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="项目视频发布月份" style="width:140px"
        @change="v => { filters.videoMonth = v; loadData() }" />
      <a-input v-model:value="filters.clientOrderId" placeholder="客户方的项目订单" style="width:150px"
        allow-clear @press-enter="loadData" />
      <a-input v-model:value="filters.internalProjectNo" placeholder="内部项目编号" style="width:180px"
        allow-clear @press-enter="loadData" />
      <a-input v-model:value="filters.clientPaymentBatch" placeholder="客户方付款批次" style="width:150px"
        allow-clear @press-enter="loadData" />
      <a-select v-model:value="filters.projectManagerId" placeholder="项目负责人"
        style="width:130px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="e in projectManagerCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="loadData">查询</a-button>
      <a-button @click="resetFilters">重置</a-button>
    </div>

    <!-- 表格 -->
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="visibleColumns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'brand'">
            <a-tag v-if="getBrandName(record.brandId)" :color="colorForValue(getBrandName(record.brandId))">
              {{ getBrandName(record.brandId) }}
            </a-tag>
            <span v-else>—</span>
          </template>

          <template v-if="column.key === 'platform'">
            <template v-if="record.platform">
              <a-tag v-for="p in splitMulti(record.platform)" :key="p" :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'publishLink'">
            <a v-if="record.publishLink" :href="record.publishLink" target="_blank"
              style="font-size:12px;word-break:break-all">{{ record.publishLink }}</a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'accountName'">
            {{ getInfluencerName(record.influencerId) || '—' }}
          </template>

          <template v-if="column.key === 'team'">
            <a-tag v-if="getTeamName(record.teamId)" :color="colorForValue(getTeamName(record.teamId))">
              {{ getTeamName(record.teamId) }}
            </a-tag>
            <span v-else>—</span>
          </template>

          <template v-if="column.key === 'notes'">
            <span v-if="record.notes" style="color:#ff4d4f">{{ record.notes }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'publishDate'">
            {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
          </template>

          <template v-if="column.key === 'createdAt'">
            {{ record.createdAt ? formatDateTime(record.createdAt) : '—' }}
          </template>

          <template v-if="column.key === 'progress'">
            <a-tag v-if="record.progress" :color="progressColor(record.progress)">
              {{ getLabel('collab_progress', record.progress) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'influencerPaymentProgress'">
            <a-tag v-if="record.influencerPaymentProgress" :color="paymentProgressColor(record.influencerPaymentProgress)">
              {{ getLabel('influencer_payment_progress', record.influencerPaymentProgress) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'videoType'">
            <a-tag v-if="record.videoType" :color="videoTypeColor(record.videoType)">
              {{ getLabel('video_type', record.videoType) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'projectManager'">
            {{ getEmployeeName(record.projectManagerId) || '—' }}
          </template>

          <template v-if="column.key === 'executor'">
            {{ getEmployeeName(record.executorId) || '—' }}
          </template>

          <template v-if="column.key === 'influencerCost'">
            {{ record.influencerCost != null ? fmtNum(record.influencerCost) : '—' }}
          </template>
          <template v-if="column.key === 'clientPrice'">
            {{ record.clientPrice != null ? fmtNum(record.clientPrice) : '—' }}
          </template>

          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite">
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a @click="openStatusModal(record)">状态流转</a>
              <span v-if="record.hasPendingRollbackRequest" style="color:#faad14;font-size:12px">（倒退审核中）</span>
              <a-divider type="vertical" />
              <span v-if="record.hasPendingDeleteRequest" style="color:#faad14">审核中</span>
              <a v-else style="color:#ff4d4f" @click="openDeleteReason(record)">删除</a>
            </a-space>
            <span v-else style="color:#bbb">只读</span>
          </template>

        </template>
      </a-table>
    </div>

    <CollaborationStatusModal
      v-model:visible="statusModalVisible"
      :record="statusModalRecord"
      @saved="loadData"
      @need-executor-cost="openExecutorCostModal" />

    <CollaborationExecutorCostModal
      v-model:visible="executorCostModalVisible"
      :record="executorCostModalRecord"
      :employees="employees"
      @saved="loadData" />

    <a-modal v-model:open="deleteReasonVisible" title="删除申请" @ok="handleDeleteConfirm" :confirm-loading="deleting">
      <p style="color:#888;font-size:13px">删除红人合作跟踪记录需要管理员审核，请填写删除原因。</p>
      <a-form layout="vertical">
        <a-form-item label="删除原因" required>
          <a-textarea v-model:value="deleteReason" :rows="3" placeholder="请说明删除原因" />
        </a-form-item>
      </a-form>
    </a-modal>

    <CollaborationFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :can-view-financials="authStore.canViewFinancials"
      :can-view-baseline-financials="authStore.canViewBaselineFinancials"
      :can-edit-commission="authStore.canEditCommission"
      :can-edit-publish-date="authStore.isAdmin"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      @saved="loadData"
      @need-executor-cost="openExecutorCostModal"
    />

    <CollaborationBatchCreateModal
      v-model:visible="batchCreateModalVisible"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      :can-view-baseline-financials="authStore.canViewBaselineFinancials"
      @saved="loadData"
    />

    <LegacyRequirementLinkModal
      v-model:visible="legacyLinkModalVisible"
      :influencers="influencers"
      @linked="loadData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined, HistoryOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { collaborationApi, brandApi, influencerApi, influencerTeamApi, employeeApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { formatDate, formatDateTime } from '../../utils/dateFormat'
import { colorForValue } from '../../utils/tagColor'
import { paymentProgressColor } from '../../utils/enumColors'
import CollaborationFormModal from './CollaborationFormModal.vue'
import CollaborationStatusModal from './CollaborationStatusModal.vue'
import CollaborationExecutorCostModal from './CollaborationExecutorCostModal.vue'
import CollaborationBatchCreateModal from './CollaborationBatchCreateModal.vue'
import LegacyRequirementLinkModal from '../requirement/LegacyRequirementLinkModal.vue'

const authStore = useAuthStore()
const { getOptions, getLabel } = useOptions()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading     = ref(false)
const tableData   = ref([])
const brands      = ref([])
const teams       = ref([])
const influencers = ref([])
const employees   = ref([])
// 负责人筛选只能选"项目负责人"或"管理层"角色的员工（跟表单里的规则一致）
const projectManagerCandidates = computed(() =>
  employees.value.filter(e => e.role === '项目负责人' || e.role === '管理层'))
const modalVisible        = ref(false)
const editingRecord       = ref(null)
const batchCreateModalVisible = ref(false)
const legacyLinkModalVisible = ref(false)
const statusModalVisible  = ref(false)
const statusModalRecord   = ref(null)
const executorCostModalVisible = ref(false)
const executorCostModalRecord  = ref(null)
const deleteReasonVisible = ref(false)
const deleteReason        = ref('')
const deleteTarget        = ref(null)
const deleting            = ref(false)
const recomputing         = ref(false)

const route = useRoute()
const router = useRouter()

const sortState = reactive({ field: 'id', order: 'descend' })
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  brandId: undefined, teamId: undefined, countryMarket: undefined,
  accountName: route.query.accountName || undefined,
  platform: undefined, progress: undefined, videoType: undefined,
  videoMonth: undefined, videoMonthVal: undefined,
  internalProjectNo: route.query.internalProjectNo || undefined,
  clientOrderId: undefined, clientPaymentBatch: undefined, projectManagerId: undefined
})

const allColumns = [
  { title: '内部项目编号',  dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 200, sorter: true },
  { title: '品牌方',        key: 'brand',          width: 120 },
  { title: '红人团队',      key: 'team',            width: 100 },
  { title: '服务国家/市场', dataIndex: 'countryMarket', key: 'countryMarket', width: 120, sorter: true },
  { title: '红人社媒完整名字', key: 'accountName', width: 160, sorter: true },
  { title: '合作平台',      key: 'platform',       width: 120 },
  { title: '需求内容',      dataIndex: 'demandContent', key: 'demandContent', width: 160, ellipsis: true },
  { title: '视频发布链接',  key: 'publishLink',    width: 220 },
  { title: '视频发布时间',  key: 'publishDate',    width: 110, sorter: true },
  { title: '创建时间',      key: 'createdAt',      width: 150, sorter: true },
  // 宽度按各自最长的标签留够空间（tag 组件内部不换行，太窄会被裁切显示不全）：
  // 视频项目进度最长"已加入客户未结算列表"，红人结款进度最长"已纳入红人结款批次（缺少invoice）"
  { title: '视频项目进度',  key: 'progress',       width: 180, sorter: true },
  { title: '红人结款进度',  key: 'influencerPaymentProgress', width: 260 },
  { title: '项目视频类型',  key: 'videoType',      width: 120, sorter: true },
  { title: '采买旧视频的原链接', dataIndex: 'oldMaterialSourceLink', key: 'oldMaterialSourceLink', width: 200, ellipsis: true },
  { title: '项目负责人',    key: 'projectManager', width: 100 },
  { title: '内部执行人员（可选）',  key: 'executor',        width: 100 },
  { title: '备注',          dataIndex: 'notes',     key: 'notes',      width: 160, ellipsis: true },
  { title: '客户方的项目订单', dataIndex: 'clientOrderId', key: 'clientOrderId', width: 150, sorter: true },
  { title: '客户方付款批次',   dataIndex: 'clientPaymentBatch', key: 'clientPaymentBatch', width: 150, sorter: true },
  // 这两个字段是"基础财务字段"，GUEST 之外所有角色都能看，不受 canViewFinancials（仅 ADMIN/AUDITOR）限制
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180, baseline: true },
  { title: '客户合作价格（$）',           key: 'clientPrice',    width: 140, baseline: true },
  // 以下列 2026-07 从"项目订单"模块迁移过来。汇率/其他外部成本/内部执行成本不标 sensitive
  // （按行脱敏：项目负责人/执行人员只能看到自己相关的行，其余显示"—"，由后端按行返回决定，
  // 不是角色整体限制，所以不能靠前端 sensitive 整列隐藏，拿到什么就显示什么，跟原项目订单列表一致）
  { title: '汇率', dataIndex: 'exchangeRate', key: 'exchangeRate', width: 80,
    customRender: ({ text }) => text || '—' },
  { title: '其他外部成本（人民币）', dataIndex: 'otherExternalCost', key: 'otherExternalCost', width: 160,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '外部成本备注', dataIndex: 'otherExternalCostNote', key: 'otherExternalCostNote', width: 180, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '内部执行成本（人民币）', dataIndex: 'internalExecutionCost', key: 'internalExecutionCost', width: 160,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '项目毛利',        dataIndex: 'grossProfit', key: 'grossProfit', width: 120, sensitive: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '可分配利润',      dataIndex: 'distributableProfit', key: 'distributableProfit', width: 120, sensitive: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '提成比例',        dataIndex: 'commissionRate', key: 'commissionRate', width: 90, sensitive: true,
    customRender: ({ text }) => text ? (parseFloat(text) * 100).toFixed(0) + '%' : '—' },
  { title: '负责人提成',      dataIndex: 'commissionAmount', key: 'commissionAmount', width: 120, sensitive: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '公司利润（美金）', dataIndex: 'companyNetProfit', key: 'companyNetProfit', width: 140, sensitive: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '公司利润（人民币）', dataIndex: 'rmbRevenue', key: 'rmbRevenue', width: 140, sensitive: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '操作', key: 'action', width: 120, fixed: 'right' }
]

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const visibleColumns = computed(() =>
  allColumns.filter(col => col.baseline ? authStore.canViewBaselineFinancials : (!col.sensitive || authStore.canViewFinancials)))
const tableScrollX = computed(() =>
  visibleColumns.value.reduce((sum, c) => sum + (c.width || 120), 0))

function getBrandName(brandId) {
  if (!brandId) return ''
  const b = brands.value.find(b => b.id === brandId)
  return b ? b.name : ''
}
function getEmployeeName(employeeId) {
  if (!employeeId) return ''
  const e = employees.value.find(e => e.id === employeeId)
  return e ? e.name : ''
}
function getInfluencerName(influencerId) {
  if (!influencerId) return ''
  const inf = influencers.value.find(i => i.id === influencerId)
  return inf ? inf.accountName : ''
}
function getTeamName(teamId) {
  if (!teamId) return ''
  const t = teams.value.find(t => t.id === teamId)
  return t ? t.name : ''
}
function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
// 沿着"待客户出brief → ... → 客户已结算"这条流水线渐进上色：早期阶段用中性色，
// 越接近完成越暖/越亮，"客户已结算"是终态用绿色，"折损"是异常终态用红色
function progressColor(p) {
  const m = {
    PENDING_CLIENT_BRIEF: 'default', CONTRACT_SENT: 'default', INFLUENCER_ORDERED: 'purple',
    SHOOTING_GUIDE_SENT: 'purple',
    PENDING_DRAFT: 'default', PENDING_PUBLISH: 'orange', PENDING_REVISION: 'gold',
    PUBLISHED_UNSETTLED: 'blue', JOINED_CLIENT_UNSETTLED_LIST: 'cyan',
    SETTLED: 'green', DELAYED: 'red'
  }
  return m[p] || 'default'
}

// 项目视频类型是分类，不是状态，随便挑几个能区分开的颜色
function videoTypeColor(t) {
  const m = {
    REAL_SHOT_NEW: 'blue', REAL_SHOT_NEW_PHOTO: 'cyan',
    AI_NEW_MATERIAL: 'purple', OLD_MATERIAL_REPOST: 'default'
  }
  return m[t] || 'default'
}

async function loadData() {
  loading.value = true
  try {
    const res = await collaborationApi.list({
      brandId:            filters.brandId,
      teamId:             filters.teamId      || undefined,
      countryMarket:      filters.countryMarket,
      accountName:        filters.accountName?.trim() || undefined,
      platform:           filters.platform,
      progress:           filters.progress,
      videoType:          filters.videoType,
      videoMonth:         filters.videoMonth,
      internalProjectNo:  filters.internalProjectNo?.trim() || undefined,
      clientOrderId:      filters.clientOrderId?.trim() || undefined,
      clientPaymentBatch: filters.clientPaymentBatch?.trim() || undefined,
      projectManagerId:   filters.projectManagerId,
      sortBy:  sortState.field,
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

function handleTableChange(pag, _f, sorter) {
  pagination.current  = pag.current
  pagination.pageSize = pag.pageSize
  if (sorter && sorter.field) {
    sortState.field = sorter.field
    sortState.order = sorter.order || 'descend'
  }
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    brandId:undefined, teamId:undefined, countryMarket:undefined,
    accountName:undefined, platform:undefined, progress:undefined, videoType:undefined,
    videoMonth:undefined, videoMonthVal:undefined, internalProjectNo:undefined,
    clientOrderId:undefined, clientPaymentBatch:undefined, projectManagerId:undefined
  })
  pagination.current = 1
  sortState.field = 'id'; sortState.order = 'descend'
  loadData()
}

function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
function openStatusModal(r) {
  statusModalRecord.value = {
    ...r,
    accountName: getInfluencerName(r.influencerId),
    executorName: getEmployeeName(r.executorId)
  }
  statusModalVisible.value = true
}
function openExecutorCostModal(r) {
  executorCostModalRecord.value = {
    ...r,
    accountName: getInfluencerName(r.influencerId),
    executorName: getEmployeeName(r.executorId)
  }
  executorCostModalVisible.value = true
}
function openDeleteReason(r) { deleteTarget.value = r; deleteReason.value = ''; deleteReasonVisible.value = true }
async function handleDeleteConfirm() {
  if (!deleteReason.value?.trim()) { message.warning('请填写删除原因'); return }
  deleting.value = true
  try {
    await collaborationApi.requestDelete(deleteTarget.value.id, deleteReason.value.trim())
    message.success('已提交删除申请，等待管理员审核')
    deleteReasonVisible.value = false
    loadData()
  } finally { deleting.value = false }
}
function handleExport() { collaborationApi.exportExcel(filters) }

async function handleRecomputeProfits() {
  recomputing.value = true
  try {
    const res = await collaborationApi.recomputeProfits()
    message.success(res.data || '重新计算完成')
    loadData()
  } finally { recomputing.value = false }
}
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    await collaborationApi.importExcel(fd)
    message.success('文件已上传，正在后台导入中，可以去"导入历史"查看进度和结果')
  } catch {}
  return false
}

onMounted(async () => {
  const [b, t, inf, emp] = await Promise.all([
    brandApi.list(), influencerTeamApi.list(), influencerApi.simple(), employeeApi.list()
  ])
  brands.value      = b.data || []
  teams.value       = t.data || []
  influencers.value = inf.data || []
  employees.value   = emp.data || []
  loadData()
})
</script>
