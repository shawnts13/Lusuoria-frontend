<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">项目订单管理</span>
      <a-space>
        <a-button @click="projectApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>
          Excel 导出
        </a-button>
        <template v-if="authStore.canWrite">
          <a-upload :before-upload="handleImport" :show-upload-list="false" accept=".xlsx,.xls">
            <a-button><template #icon><UploadOutlined /></template>Excel 导入</a-button>
          </a-upload>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>新建项目
          </a-button>
        </template>
      </a-space>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <a-select v-model:value="filters.brandId" placeholder="品牌方" style="width:150px"
        allow-clear @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</a-select-option>
      </a-select>
      <a-date-picker v-model:value="filters.projectMonthVal" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="项目月份" style="width:140px"
        @change="v => { filters.projectMonth = v; loadData() }" />
      <a-select v-model:value="filters.projectType" placeholder="项目类型" style="width:140px"
        allow-clear @change="loadData">
        <a-select-option value="OVERSEAS_INFLUENCER">海外红人</a-select-option>
        <a-select-option value="CHINA_INFLUENCER">中国红人</a-select-option>
      </a-select>
      <a-select v-model:value="filters.videoType" placeholder="项目视频类型" style="width:140px"
        allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.clientStatus" placeholder="甲方状态" style="width:150px"
        allow-clear @change="loadData">
        <a-select-option v-for="s in clientStatuses" :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.internalStatus" placeholder="内部状态" style="width:150px"
        allow-clear @change="loadData">
        <a-select-option v-for="s in internalStatuses" :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
      </a-select>
      <a-input v-model:value="filters.accountName" placeholder="红人社媒完整名字" style="width:160px"
        allow-clear @press-enter="loadData" />
      <a-select v-model:value="filters.projectManagerId" placeholder="负责人" style="width:130px"
        allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="e in employees" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
      </a-select>
      <a-input-search v-model:value="filters.keyword" placeholder="搜索项目编号/订单号"
        style="width:200px" @search="loadData" allow-clear />
      <a-button @click="resetFilters">重置</a-button>
    </div>



    <!-- Table -->
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="visibleColumns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'projectType'">
            <a-tag :color="record.projectType === 'OVERSEAS_INFLUENCER' ? 'blue' : 'green'">
              {{ record.projectTypeLabel }}
            </a-tag>
          </template>

          <template v-if="column.key === 'videoType'">
            <a-tag v-if="record.videoType" color="purple">
              {{ getLabel('video_type', record.videoType) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'clientPrice'">
            {{ record.currency }} {{ fmtNum(record.clientPrice) }}
          </template>
          <template v-if="column.key === 'rmbRevenue'">¥{{ fmtNum(record.rmbRevenue) }}</template>
          <template v-if="column.key === 'grossProfit'">
            <span :class="record.grossProfit >= 0 ? 'profit-positive' : 'profit-negative'">
              {{ fmtNum(record.grossProfit) }}
            </span>
          </template>
          <template v-if="column.key === 'companyNetProfit'">
            <span :class="record.companyNetProfit >= 0 ? 'profit-positive' : 'profit-negative'">
              {{ fmtNum(record.companyNetProfit) }}
            </span>
          </template>
          <template v-if="column.key === 'clientStatus'">
            <a-tag :color="clientStatusColor(record.clientStatus)">{{ record.clientStatusLabel }}</a-tag>
          </template>
          <template v-if="column.key === 'internalStatus'">
            <a-tag :color="internalStatusColor(record.internalStatus)">{{ record.internalStatusLabel }}</a-tag>
          </template>

          <template v-if="column.key === 'action'">
            <a-space>
              <template v-if="authStore.canApprove && record.internalStatus === 'PENDING_APPROVAL'">
                <a-popconfirm title="确认审核通过？" @confirm="handleApprove(record.id)">
                  <a style="color:#52c41a">✓ 审核通过</a>
                </a-popconfirm>
                <a-divider type="vertical" />
                <a-popconfirm title="确认驳回？" @confirm="handleReject(record.id)">
                  <a style="color:#ff4d4f">✗ 驳回</a>
                </a-popconfirm>
                <a-divider type="vertical" />
              </template>
              <template v-if="authStore.canWrite">
                <a @click="openEdit(record)">编辑</a>
                <a-divider type="vertical" />
                <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
                  <a style="color:#ff4d4f">删除</a>
                </a-popconfirm>
              </template>
              <template v-if="!authStore.canWrite && !authStore.canApprove">
                <span style="color:#bbb">只读</span>
              </template>
            </a-space>
          </template>

        </template>
      </a-table>
    </div>

    <ProjectFormModal v-model:visible="modalVisible" :record="editingRecord"
      :brands="brands" :influencers="influencers" :employees="employees"
      :can-approve="authStore.canApprove" :can-view-financials="authStore.canViewFinancials" :can-edit-commission="authStore.canEditCommission"
      @saved="loadData" />

    <a-modal v-model:open="importResultVisible" title="导入结果" :footer="null" width="600px">
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
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { projectApi, brandApi, influencerApi, employeeApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import ProjectFormModal from './ProjectFormModal.vue'

const authStore = useAuthStore()
const { getOptions, getLabel } = useOptions()
const loading   = ref(false)
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
const tableData = ref([])
const brands    = ref([])
const influencers = ref([])
const employees = ref([])
const modalVisible       = ref(false)
const editingRecord      = ref(null)
const importResultVisible = ref(false)
const importResults      = ref([])

const pagination = reactive({ current:1, pageSize:20, total:0, showTotal: t => `共 ${t} 条` })
const route     = useRoute()
const filters = reactive({
  brandId:undefined, projectMonth:undefined, projectMonthVal:undefined,
  projectType:undefined, videoType:undefined, clientStatus:undefined, internalStatus:undefined,
  accountName:undefined, projectManagerId:undefined,
  keyword:'',
  // 从红人管理页跳转时传入
  influencerId: route.query.influencerId ? Number(route.query.influencerId) : undefined
})

const clientStatuses = [
  { value:'PENDING_SUBMIT', label:'待提交' }, { value:'SUBMITTED', label:'已提交' },
  { value:'CLIENT_CONFIRMED', label:'甲方已确认' }, { value:'CLIENT_RECONCILED', label:'甲方已对账' },
  { value:'CONTRACT_SIGNED', label:'合同已签署' }, { value:'PENDING_PAYMENT', label:'待到账' },
  { value:'PARTIAL_PAYMENT', label:'部分到账' }, { value:'PAID', label:'已到账' },
  { value:'ABNORMAL', label:'异常' }
]
const internalStatuses = [
  { value:'PENDING_CALC', label:'待核算' }, { value:'CALCULATED', label:'已核算' },
  { value:'PENDING_APPROVAL', label:'待老板审核' }, { value:'CONFIRMED', label:'已确认' },
  { value:'IN_PAYROLL', label:'已进入工资' }, { value:'ARCHIVED', label:'已归档' }
]

// 全部列定义，按需求指定顺序排列，sensitive:true 的列只有 canViewFinancials 才显示
const allColumns = [
  { title:'甲方订单号',  dataIndex:'clientOrderNo',      key:'clientOrderNo',     width:140, fixed:'left' },
  { title:'月份',        dataIndex:'projectMonth',       key:'projectMonth',      width:80 },
  { title:'品牌方',      dataIndex:'brandName',          key:'brandName',         width:100 },
  { title:'类型',        key:'projectType',              width:100 },
  { title:'项目视频类型', key:'videoType',                width:110 },
  { title:'红人社媒完整名字', dataIndex:'influencerAccount',  key:'influencerAccount', width:160 },
  { title:'负责人',      dataIndex:'projectManagerName', key:'projectManagerName',width:90 },
  { title:'甲方状态',    key:'clientStatus',             width:120 },
  { title:'内部状态',    key:'internalStatus',           width:120 },
  // 敏感列（仅 ADMIN / AUDITOR）
  { title:'客户合作价格（$）', dataIndex:'clientPrice',   key:'clientPrice',       width:140, sensitive:true,
    customRender: ({ text }) => fmtNum(text) },
  { title:'红人成本',    dataIndex:'influencerCost',     key:'influencerCost',    width:110, sensitive:true,
    customRender: ({ text }) => fmtNum(text) },
  // 非敏感
  { title:'币种',        dataIndex:'currency',           key:'currency',          width:70 },
  { title:'汇率',        dataIndex:'exchangeRate',       key:'exchangeRate',      width:80,
    customRender: ({ text }) => text || '—' },
  // 敏感
  { title:'项目毛利',    key:'grossProfit',              width:120,  sensitive:true },
  { title:'公司利润（美金）', key:'companyNetProfit',     width:140,  sensitive:true },
  { title:'公司利润（人民币）', key:'rmbRevenue',         width:140,  sensitive:true },
  { title:'负责人提成',  dataIndex:'commissionAmount',   key:'commissionAmount',  width:110, sensitive:true,
    customRender: ({ text }) => fmtNum(text) },
  { title:'提成比例',    dataIndex:'commissionRate',     key:'commissionRate',    width:90,  sensitive:true,
    customRender: ({ text }) => text ? (parseFloat(text)*100).toFixed(0)+'%' : '—' },
  // 非敏感
  { title:'已到账金额',  dataIndex:'receivedAmount',     key:'receivedAmount',    width:110,
    customRender: ({ text }) => fmtNum(text) },
  { title:'内部项目编号', dataIndex:'internalProjectNo', key:'internalProjectNo', width:200 },
  { title:'操作',        key:'action',                   width:200,  fixed:'right' }
]

// 根据角色动态过滤列
const visibleColumns = computed(() =>
  allColumns.filter(col => !col.sensitive || authStore.canViewFinancials)
)

const tableScrollX = computed(() =>
  visibleColumns.value.reduce((sum, c) => sum + (c.width || 120), 0)
)

async function loadData() {
  loading.value = true
  try {
    const res = await projectApi.list({
      brandId:filters.brandId, projectMonth:filters.projectMonth,
      projectType:filters.projectType, clientStatus:filters.clientStatus,
      internalStatus:filters.internalStatus, videoType:filters.videoType,
      influencerId:filters.influencerId || undefined,
      accountName:filters.accountName?.trim() || undefined,
      projectManagerId:filters.projectManagerId || undefined,
      keyword:filters.keyword||undefined,
      page:pagination.current-1, size:pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
  } finally {
    loading.value = false
    remeasure()
  }
}

function handleTableChange(pag) {
  pagination.current=pag.current; pagination.pageSize=pag.pageSize; loadData()
}
function resetFilters() {
  Object.assign(filters, { brandId:undefined, projectMonth:undefined, projectMonthVal:undefined,
    projectType:undefined, videoType:undefined, clientStatus:undefined, internalStatus:undefined,
    accountName:undefined, projectManagerId:undefined, keyword:'' })
  pagination.current=1; loadData()
}
function openCreate() { editingRecord.value=null; modalVisible.value=true }
function openEdit(r)  { editingRecord.value=r;    modalVisible.value=true }
async function handleDelete(id) { await projectApi.delete(id); message.success('删除成功'); loadData() }
async function handleApprove(id) { await projectApi.approve(id); message.success('已审核通过'); loadData() }
async function handleReject(id)  { await projectApi.reject(id);  message.success('已驳回'); loadData() }
function handleExport() { projectApi.exportExcel(filters.projectMonth) }
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try { const res = await projectApi.importExcel(fd); importResults.value=res.data||[]; importResultVisible.value=true; loadData() } catch {}
  return false
}

function clientStatusColor(s) {
  const m={PENDING_SUBMIT:'default',SUBMITTED:'processing',CLIENT_CONFIRMED:'cyan',
    CLIENT_RECONCILED:'blue',CONTRACT_SIGNED:'purple',PENDING_PAYMENT:'orange',
    PARTIAL_PAYMENT:'gold',PAID:'green',ABNORMAL:'red'}
  return m[s]||'default'
}
function internalStatusColor(s) {
  const m={PENDING_CALC:'default',CALCULATED:'processing',PENDING_APPROVAL:'orange',
    CONFIRMED:'cyan',IN_PAYROLL:'blue',ARCHIVED:'green'}
  return m[s]||'default'
}
function fmtNum(val) {
  if (val==null) return '—'
  return parseFloat(val).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
}

onMounted(async () => {
  const [b,inf,emp] = await Promise.all([brandApi.list(),influencerApi.simple(),employeeApi.list()])
  brands.value=b.data||[]; influencers.value=inf.data||[]; employees.value=emp.data||[]
  loadData()
})
</script>
