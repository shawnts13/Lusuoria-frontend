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
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>新建跟踪
          </a-button>
        </template>
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
      <a-select v-model:value="filters.teamName" placeholder="红人团队"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.value.includes(input)"
        @change="loadData">
        <a-select-option v-for="t in teams" :key="t.name" :value="t.name">{{ t.name }}</a-select-option>
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
      <a-select v-model:value="filters.progress" placeholder="进度"
        style="width:140px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.videoType" placeholder="项目视频类型"
        style="width:140px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-date-picker v-model:value="filters.videoMonthVal" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="项目视频月份" style="width:140px"
        @change="v => { filters.videoMonth = v; loadData() }" />
      <a-input v-model:value="filters.clientOrderId" placeholder="客户方的项目订单" style="width:150px"
        allow-clear @press-enter="loadData" />
      <a-input v-model:value="filters.clientPaymentBatch" placeholder="客户方付款批次" style="width:150px"
        allow-clear @press-enter="loadData" />
      <a-select v-model:value="filters.projectManagerId" placeholder="项目负责人"
        style="width:130px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="e in employees" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
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
            {{ getBrandName(record.brandId) || '—' }}
          </template>

          <template v-if="column.key === 'platform'">
            <template v-if="record.platform">
              <a-tag v-for="p in splitMulti(record.platform)" :key="p" style="margin:2px">{{ p }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'publishLink'">
            <a v-if="record.publishLink" :href="record.publishLink" target="_blank"
              style="font-size:12px;word-break:break-all">{{ record.publishLink }}</a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'publishDate'">
            {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
          </template>

          <template v-if="column.key === 'progress'">
            <a-tag v-if="record.progress" :color="progressColor(record.progress)">
              {{ getLabel('collab_progress', record.progress) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'videoType'">
            <a-tag v-if="record.videoType" color="purple">
              {{ getLabel('video_type', record.videoType) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'projectManager'">
            {{ getEmployeeName(record.projectManagerId) || '—' }}
          </template>

          <template v-if="column.key === 'influencerCost'">
            <span :style="isRemark(record.influencerCost) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.influencerCost || '—' }}
            </span>
          </template>
          <template v-if="column.key === 'clientPrice'">
            <span :style="isRemark(record.clientPrice) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.clientPrice || '—' }}
            </span>
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

    <CollaborationStatusModal
      v-model:visible="statusModalVisible"
      :record="statusModalRecord"
      @saved="loadData" />

    <CollaborationFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :can-view-financials="authStore.canViewFinancials"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      @saved="loadData"
    />

    <a-modal v-model:open="importResultVisible" title="导入结果" :footer="null" width="600px">
      <a-list :data-source="importResults" size="small" :pagination="importListPagination">
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
import { collaborationApi, brandApi, influencerApi, influencerTeamApi, employeeApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import CollaborationFormModal from './CollaborationFormModal.vue'
import CollaborationStatusModal from './CollaborationStatusModal.vue'

const authStore = useAuthStore()
const { getOptions, getLabel } = useOptions()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading     = ref(false)
const tableData   = ref([])
const brands      = ref([])
const teams       = ref([])
const influencers = ref([])
const employees   = ref([])
const modalVisible        = ref(false)
const editingRecord       = ref(null)
const statusModalVisible  = ref(false)
const statusModalRecord   = ref(null)
const importResultVisible = ref(false)
const importResults       = ref([])

const importListState = reactive({ current: 1, pageSize: 10 })
const importListPagination = computed(() => {
  if (importResults.value.length <= 10) return false
  return {
    current: importListState.current,
    pageSize: importListState.pageSize,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small',
    onChange: (p, s) => { importListState.current = p; importListState.pageSize = s },
    onShowSizeChange: (p, s) => { importListState.current = 1; importListState.pageSize = s }
  }
})

const sortState = reactive({ field: 'id', order: 'descend' })
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  brandId: undefined, teamName: undefined, countryMarket: undefined,
  accountName: undefined, platform: undefined, progress: undefined, videoType: undefined,
  videoMonth: undefined, videoMonthVal: undefined,
  clientOrderId: undefined, clientPaymentBatch: undefined, projectManagerId: undefined
})

const allColumns = [
  { title: '内部项目编号',  dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 200 },
  { title: '品牌方',        key: 'brand',          width: 120 },
  { title: '红人团队',      dataIndex: 'teamName', key: 'teamName',      width: 120 },
  { title: '服务国家/市场', dataIndex: 'countryMarket', key: 'countryMarket', width: 120 },
  { title: '红人社媒完整名字', dataIndex: 'accountName', key: 'accountName', width: 160, sorter: true },
  { title: '合作平台',      key: 'platform',       width: 120 },
  { title: '需求内容',      dataIndex: 'demandContent', key: 'demandContent', width: 160, ellipsis: true },
  { title: '视频发布链接',  key: 'publishLink',    width: 220 },
  { title: '发布时间',      key: 'publishDate',    width: 110, sorter: true },
  { title: '进度',          key: 'progress',       width: 130 },
  { title: '项目视频类型',  key: 'videoType',      width: 120 },
  { title: '项目负责人',    key: 'projectManager', width: 100 },
  { title: '客户方的项目订单', dataIndex: 'clientOrderId', key: 'clientOrderId', width: 150 },
  { title: '客户方付款批次',   dataIndex: 'clientPaymentBatch', key: 'clientPaymentBatch', width: 150 },
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180, sensitive: true },
  { title: '客户合作价格（$）',           key: 'clientPrice',    width: 140, sensitive: true },
  { title: '操作', key: 'action', width: 120, fixed: 'right' }
]

const visibleColumns = computed(() =>
  allColumns.filter(col => !col.sensitive || authStore.canViewFinancials))
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
function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function progressColor(p) {
  const m = {
    PENDING_DRAFT: 'default', PENDING_PUBLISH: 'orange', PENDING_REVISION: 'gold',
    PUBLISHED_UNSETTLED: 'blue', DELAYED: 'red', SETTLED: 'green'
  }
  return m[p] || 'default'
}
function isRemark(value) {
  if (!value || !value.trim()) return false
  return isNaN(parseFloat(value.trim()))
}

async function loadData() {
  loading.value = true
  try {
    const res = await collaborationApi.list({
      brandId:            filters.brandId,
      teamName:           filters.teamName    || undefined,
      countryMarket:      filters.countryMarket,
      accountName:        filters.accountName?.trim() || undefined,
      platform:           filters.platform,
      progress:           filters.progress,
      videoType:          filters.videoType,
      videoMonth:         filters.videoMonth,
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
    brandId:undefined, teamName:undefined, countryMarket:undefined,
    accountName:undefined, platform:undefined, progress:undefined, videoType:undefined,
    videoMonth:undefined, videoMonthVal:undefined,
    clientOrderId:undefined, clientPaymentBatch:undefined, projectManagerId:undefined
  })
  pagination.current = 1
  sortState.field = 'id'; sortState.order = 'descend'
  loadData()
}

function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
function openStatusModal(r) { statusModalRecord.value = r; statusModalVisible.value = true }
async function handleDelete(id) {
  await collaborationApi.delete(id); message.success('删除成功'); loadData()
}
function handleExport() { collaborationApi.exportExcel(filters) }
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    const res = await collaborationApi.importExcel(fd)
    importResults.value = res.data || []
    importListState.current = 1
    importResultVisible.value = true
    loadData()
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
