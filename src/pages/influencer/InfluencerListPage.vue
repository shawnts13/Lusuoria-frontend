<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">红人管理</span>
      <a-space>
        <a-button @click="influencerApi.downloadTemplate()">
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
            <template #icon><PlusOutlined /></template>新建红人
          </a-button>
        </template>
      </a-space>
    </div>

    <!-- 筛选条件 -->
    <div class="filter-bar">
      <a-select v-model:value="filters.influencerType" placeholder="红人类型"
        style="width:160px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('influencer_type')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.platform" placeholder="平台"
        style="width:130px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.countryMarket" placeholder="服务国家/市场"
        style="width:160px" allow-clear show-search
        :filter-option="(input, opt) => opt.value.includes(input)"
        @change="loadData">
        <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.brandId" placeholder="品牌方"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">
          {{ b.name }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
      </a-select>
      <!-- 粉丝量区间 -->
      <a-input-number v-model:value="filters.followerMin" placeholder="粉丝量下限"
        style="width:120px" :min="0" :formatter="fmtNum" :parser="v => v.replace(/,/g,'')"
        @change="loadData" />
      <span style="color:#bbb">—</span>
      <a-input-number v-model:value="filters.followerMax" placeholder="粉丝量上限"
        style="width:120px" :min="0" :formatter="fmtNum" :parser="v => v.replace(/,/g,'')"
        @change="loadData" />
      <a-input-search v-model:value="filters.keyword" placeholder="搜索红人社媒完整名字"
        style="width:200px" @search="loadData" allow-clear />
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

          <template v-if="column.key === 'brandTeamPairs'">
            <template v-if="record.brandTeamPairs && record.brandTeamPairs.length">
              <a-tag v-for="(p, idx) in record.brandTeamPairs" :key="idx"
                :color="colorForValue(p.brandName + '|' + (p.teamName || ''))" style="margin:2px">
                {{ p.brandName }}{{ p.teamName ? '/' + p.teamName : '' }}
              </a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'influencerType'">
            {{ getLabel('influencer_type', record.influencerType) }}
          </template>

          <template v-if="column.key === 'platform'">
            <template v-if="record.platform">
              <a-tag v-for="p in splitMulti(record.platform)" :key="p" :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'links'">
            <div v-if="record.links">
              <a v-for="(link, idx) in splitMulti(record.links)" :key="idx"
                :href="link" target="_blank" style="display:block;font-size:12px;word-break:break-all">
                {{ link }}
              </a>
            </div>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'domains'">
            <template v-if="record.domains">
              <a-tag v-for="d in splitMulti(record.domains)" :key="d" style="margin:2px">{{ d }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'followerCount'">
            {{ fmtFollower(record.followerCount) }}
          </template>

          <template v-if="column.key === 'contactStatus'">
            <a-tag v-if="record.contactStatus" :color="contactColor(record.contactStatus)">
              {{ getLabel('contact_status', record.contactStatus) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'influencerCost'">
            <span :style="isRemark(record.influencerCost) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.influencerCost || '—' }}
            </span>
          </template>
          <template v-if="column.key === 'adSpendCost'">
            <span :style="isRemark(record.adSpendCost) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.adSpendCost || '—' }}
            </span>
          </template>
          <template v-if="column.key === 'copyrightCost'">
            <span :style="isRemark(record.copyrightCost) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.copyrightCost || '—' }}
            </span>
          </template>

          <template v-if="column.key === 'projects'">
            <a v-if="projectCounts[record.id] > 0" @click="goToProjects(record.accountName)">
              查看（{{ projectCounts[record.id] }}个）
            </a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'casesLinks'">
            <div v-if="record.casesLinks">
              <a v-for="(link, idx) in splitMulti(record.casesLinks)" :key="idx"
                :href="link" target="_blank" style="display:block;font-size:12px;word-break:break-all">
                {{ link }}
              </a>
            </div>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'contacts'">
            <div v-if="record.contacts">
              <div v-for="c in parseContacts(record.contacts)" :key="c.type"
                style="font-size:12px;white-space:nowrap">
                <span style="color:#888">{{ contactTypeLabel(c.type) }}：</span>{{ c.value }}
              </div>
            </div>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'contractLink'">
            <a v-if="record.contractLink" :href="record.contractLink" target="_blank" style="font-size:12px">
              查看合同
            </a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite">
              <a @click="openEdit(record)">编辑</a>
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

    <InfluencerFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :can-view-financials="authStore.canViewBaselineFinancials"
      :brands="brands"
      :domains="domains"
      :teams="teams"
      @saved="loadData"
      @domain-added="loadDomains"
      @team-added="loadTeams"
    />

    <a-modal v-model:open="importResultVisible" title="导入结果" :footer="null" width="560px">
      <a-list :data-source="importResults" size="small"
        :pagination="importListPagination">
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
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { influencerApi, brandApi, domainApi, influencerTeamApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { colorForValue } from '../../utils/tagColor'
import InfluencerFormModal from './InfluencerFormModal.vue'

const authStore = useAuthStore()
const router    = useRouter()
const { getOptions, getLabel } = useOptions()

const loading   = ref(false)
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
const tableData = ref([])
const brands    = ref([])
const domains   = ref([])
const teams     = ref([])
const modalVisible        = ref(false)
const editingRecord       = ref(null)
const importResultVisible = ref(false)
const importResults       = ref([])
const projectCounts       = ref({})

// 导入结果弹窗列表分页（独立状态，支持切换每页条数）
const importListState = reactive({ current: 1, pageSize: 10 })
const importListPagination = computed(() => {
  if (importResults.value.length <= 10) return false
  return {
    current: importListState.current,
    pageSize: importListState.pageSize,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small',
    onChange: (page, size) => {
      importListState.current = page
      importListState.pageSize = size
    },
    onShowSizeChange: (page, size) => {
      importListState.current = 1
      importListState.pageSize = size
    }
  }
})

// 排序状态
const sortState = reactive({ field: 'accountName', order: 'ascend' })

const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  influencerType: undefined, platform: undefined, countryMarket: undefined,
  brandId: undefined, teamId: undefined,
  followerMin: undefined, followerMax: undefined,
  keyword: undefined
})

// 列定义（按新顺序）
const allColumns = [
  { title: '品牌方-团队',   key: 'brandTeamPairs',  width: 220 },
  // 宽度按最长标签"境外红人（在华）"留够空间（tag 组件不换行，太窄会被裁切显示不全）
  { title: '红人类型',      key: 'influencerType',  width: 150 },
  { title: '红人社媒完整名字', dataIndex: 'accountName', key: 'accountName', width: 160, sorter: true },
  { title: '服务国家/市场', dataIndex: 'countryMarket', key: 'countryMarket', width: 120, sorter: true },
  { title: '平台',          key: 'platform',        width: 120 },
  { title: '主页链接',      key: 'links',           width: 220 },
  { title: '所属领域',      key: 'domains',         width: 130 },
  { title: '粉丝量',        key: 'followerCount',   width: 90,  sorter: true, dataIndex: 'followerCount' },
  // 宽度按最长标签"已回复开发信"留够空间
  { title: '建联情况',      key: 'contactStatus',   width: 140 },
  { title: '跟进人',        dataIndex: 'followerPerson', key: 'followerPerson', width: 90 },
  { title: '备注',          dataIndex: 'notes',     key: 'notes',         width: 160, ellipsis: true },
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180, sensitive: true },
  { title: '视频投流成本（$）',           key: 'adSpendCost',    width: 150, sensitive: true },
  { title: '视频版权成本（$）',           key: 'copyrightCost',  width: 150, sensitive: true },
  { title: '合作项目',      key: 'projects',        width: 100 },
  { title: '合作案例',      key: 'casesLinks',      width: 220 },
  { title: '红人邮箱',      dataIndex: 'email',     key: 'email',         width: 160 },
  { title: '联系方式',      key: 'contacts',        width: 160 },
  { title: '已签署合同',    key: 'contractLink',    width: 100 },
  { title: '付款周期',      dataIndex: 'paymentCycle', key: 'paymentCycle', width: 90 },
  { title: '操作',          key: 'action',          width: 120, fixed: 'right' }
]

const visibleColumns = computed(() =>
  allColumns.filter(col => !col.sensitive || authStore.canViewBaselineFinancials)
)
const tableScrollX = computed(() =>
  visibleColumns.value.reduce((sum, c) => sum + (c.width || 120), 0)
)

function parseContacts(json) {
  if (!json) return []
  try { return JSON.parse(json) } catch { return [] }
}
function contactTypeLabel(type) {
  const m = { phone:'电话', whatsapp:'WhatsApp', line:'Line', telegram:'Telegram' }
  return m[type] || type
}

async function loadData() {
  loading.value = true
  try {
    const res = await influencerApi.list({
      influencerType: filters.influencerType,
      platform:       filters.platform,
      countryMarket:  filters.countryMarket,
      brandId:        filters.brandId,
      teamId:         filters.teamId      || undefined,
      followerMin:    filters.followerMin || undefined,
      followerMax:    filters.followerMax || undefined,
      keyword:        filters.keyword?.trim() || undefined,
      sortBy:  sortState.field,
      sortDir: sortState.order === 'descend' ? 'desc' : 'asc',
      page: pagination.current - 1,
      size: pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
    if (tableData.value.length > 0) {
      const ids = tableData.value.map(inf => inf.id)
      try {
        const countRes = await influencerApi.projectCounts(ids)
        projectCounts.value = countRes.data || {}
      } catch { projectCounts.value = {} }
    } else { projectCounts.value = {} }
  } finally {
    loading.value = false
    remeasure()  // 数据变化后表格宽度可能变化，重新同步顶部滚动条
  }
}

function handleTableChange(pag, _filters, sorter) {
  pagination.current  = pag.current
  pagination.pageSize = pag.pageSize
  // 处理列头排序
  if (sorter && sorter.field) {
    sortState.field = sorter.field
    sortState.order = sorter.order || 'ascend'
  }
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    influencerType:undefined, platform:undefined, countryMarket:undefined,
    brandId:undefined, teamId:undefined, followerMin:undefined, followerMax:undefined, keyword:undefined
  })
  pagination.current = 1
  sortState.field = 'accountName'
  sortState.order = 'ascend'
  loadData()
}

async function loadDomains() {
  const res = await domainApi.list()
  domains.value = res.data || []
}
async function loadTeams() {
  const res = await influencerTeamApi.list()
  teams.value = res.data || []
}

function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
async function handleDelete(id) {
  await influencerApi.delete(id); message.success('删除成功'); loadData(); loadDomains()
}
function handleExport() { influencerApi.exportExcel(filters.influencerType) }
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    const res = await influencerApi.importExcel(fd)
    importResults.value = res.data || []
    importListState.current = 1   // 每次新导入结果从第1页开始展示
    importResultVisible.value = true
    loadData(); loadDomains(); loadTeams()
  } catch {}
  return false
}
function goToProjects(accountName) {
  // "项目订单"模块已废弃，改为跳转到红人合作跟踪列表；那边的筛选只支持"红人社媒完整名字"
  // 文本搜索（没有按 influencerId 精确筛选的参数），所以这里传账号名而不是 id
  router.push({ path: '/collaborations', query: { accountName } })
}

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
function contactColor(s) {
  const m = { UNDEVELOPED:'default', REPLIED:'processing', INTERESTED:'cyan', COOPERATING:'blue', COOPERATED:'green' }
  return m[s] || 'default'
}
function fmtFollower(v) {
  if (!v) return '—'
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000)    return (v / 1000).toFixed(1) + 'K'
  return String(v)
}
function fmtNum(v) {
  return v ? Number(v).toLocaleString() : ''
}
function isRemark(value) {
  if (!value || !value.trim()) return false
  return isNaN(parseFloat(value.trim()))
}

onMounted(async () => {
  const [b, d, t] = await Promise.all([brandApi.list(), domainApi.list(), influencerTeamApi.list()])
  brands.value  = b.data || []
  domains.value = d.data || []
  teams.value   = t.data || []
  loadData()
})
</script>
