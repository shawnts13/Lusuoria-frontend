<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">0. 红人管理</span>
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
          <a-button @click="router.push('/import-batches?module=INFLUENCER')" style="color:#fa8c16;border-color:#fa8c16">
            <template #icon><HistoryOutlined /></template>导入历史
          </a-button>
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
        :filter-option="(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())"
        @change="loadData">
        <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.domain" placeholder="所属领域"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
        @change="loadData">
        <a-select-option v-for="d in domains" :key="d.id" :value="d.name" :label="d.name">{{ d.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.brandId" placeholder="品牌方"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
        @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">
          {{ b.name }}
        </a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
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
      <a-auto-complete v-model:value="filters.keyword" placeholder="红人社媒完整名字（可输入搜索）"
        style="width:220px" allow-clear
        :options="accountNameOptions"
        :filter-option="(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())"
        @select="loadData" @clear="loadData" @keyup.enter="loadData" />
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
            <a-tag v-if="record.influencerType" :color="influencerTypeColor(record.influencerType)">
              {{ getLabel('influencer_type', record.influencerType) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'countryMarket'">
            <template v-if="record.countryMarket">
              <a-tag v-for="c in splitMulti(record.countryMarket)" :key="c" style="margin:2px">{{ c }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
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

          <template v-if="column.key === 'activeProjects'">
            <a v-if="projectCounts[record.id]?.activeCount > 0" @click="openCollabModal(record, 'ACTIVE')">
              查看（{{ projectCounts[record.id].activeCount }}个）
            </a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'completedProjects'">
            <a v-if="projectCounts[record.id]?.completedCount > 0" @click="openCollabModal(record, 'COMPLETED')">
              查看（{{ projectCounts[record.id].completedCount }}个）
            </a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'contacts'">
            <div v-if="record.contacts">
              <div v-for="c in parseContacts(record.contacts)" :key="c.type"
                style="font-size:12px;white-space:nowrap">
                <span style="color:#595959">{{ contactTypeLabel(c.type) }}：</span>{{ c.value }}
              </div>
            </div>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'contractLink'">
            <template v-if="influencerContracts[record.id]?.length">
              <div v-for="c in influencerContracts[record.id]" :key="c.id" class="contract-mini-card">
                <a-tag :color="colorForValue(brandNameById(c.brandId))">{{ brandNameById(c.brandId) }}</a-tag>
                <a-tag v-if="c.teamId" :color="colorForValue(teamNameById(c.teamId))">{{ teamNameById(c.teamId) }}</a-tag>
                <span v-else class="contract-no-team">不涉及团队</span>
                <div class="contract-mini-range">{{ formatDate(c.startDate) }} 至 {{ formatDate(c.endDate) }}</div>
                <a :href="c.contractLink" target="_blank">查看合同</a>
              </div>
            </template>
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
            <!-- 法务：没有整条红人记录的编辑权，只能进去维护"已签署合同"，没有删除入口 -->
            <a v-else-if="authStore.canManageInfluencerContracts" @click="openEdit(record)">维护合同</a>
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
      @saved="onInfluencerSaved"
      @domain-added="loadDomains"
    />

    <InfluencerCollaborationModal
      v-model:visible="collabModalVisible"
      :influencer-id="collabModalInfluencerId"
      :category="collabModalCategory"
      :title="collabModalTitle"
    />

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined, HistoryOutlined } from '@ant-design/icons-vue'
import { influencerApi, brandApi, domainApi, influencerTeamApi, influencerContractApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import { useReferenceData } from '../../composables/useReferenceData'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { colorForValue } from '../../utils/tagColor'
import { formatDate } from '../../utils/dateFormat'
import InfluencerFormModal from './InfluencerFormModal.vue'
import InfluencerCollaborationModal from './InfluencerCollaborationModal.vue'

const authStore = useAuthStore()
const router    = useRouter()
const route     = useRoute()
const { getOptions, getLabel } = useOptions()
const { loadInfluencersSimple, invalidateInfluencers } = useReferenceData()

const loading   = ref(false)
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
const tableData = ref([])
const brands    = ref([])
const domains   = ref([])
const teams     = ref([])
// "红人社媒完整名字"筛选下拉框的可选值来源（2026-08 新增）：系统里全量红人的
// id+accountName，不受当前这页只有20条分页数据的限制——跟"新建红人"表单选红人的方式
// 保持一致，从缓存拿最新数据，支持打字过滤
const influencerNames = ref([])
// 筛选框用 a-auto-complete（既能从上面这份缓存选，也允许直接手输任意文本去搜）：
// 缓存刷新有延迟，纯 a-select 只能选列表里已经加载到的值，手输的关键字反而搜不出来
const accountNameOptions = computed(() =>
  [...new Set(influencerNames.value.map(inf => inf.accountName))].map(name => ({ value: name })))
const modalVisible        = ref(false)
const editingRecord       = ref(null)
const projectCounts       = ref({})  // key=influencerId，value={activeCount, completedCount}
const influencerContracts = ref({})  // 已签署合同，key=influencerId，value=该红人全部合同记录数组

const collabModalVisible       = ref(false)
const collabModalInfluencerId  = ref(null)
const collabModalCategory      = ref('ACTIVE')
const collabModalTitle         = ref('')

// 排序状态
const sortState = reactive({ field: 'accountName', order: 'ascend' })

const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  influencerType: undefined, platform: undefined, countryMarket: undefined, domain: undefined,
  brandId: undefined, teamId: undefined,
  followerMin: undefined, followerMax: undefined,
  keyword: undefined
})

// 列定义（按新顺序，2026-07 重新排布宽度：标签类字段按实际最长标签留够空间就好，
// 不再统一给一个偏宽的固定值；"合作中项目"/"已完结项目"紧跟在红人社媒完整名字后面）
const allColumns = [
  { title: '品牌方-团队',   key: 'brandTeamPairs',  width: 200 },
  // 宽度按最长标签"境外红人（在华）"留够空间（tag 组件不换行，太窄会被裁切显示不全）
  { title: '红人类型',      key: 'influencerType',  width: 130, sorter: true, dataIndex: 'influencerType' },
  { title: '红人社媒完整名字', dataIndex: 'accountName', key: 'accountName', width: 160, sorter: true },
  { title: '合作中项目',    key: 'activeProjects',  width: 110 },
  { title: '已完结项目',    key: 'completedProjects', width: 110 },
  { title: '服务国家/市场', key: 'countryMarket', width: 150 },
  { title: '平台',          key: 'platform',        width: 110 },
  { title: '主页链接',      key: 'links',           width: 200 },
  { title: '所属领域',      key: 'domains',         width: 120 },
  { title: '粉丝量',        key: 'followerCount',   width: 90,  sorter: true, dataIndex: 'followerCount' },
  // 宽度按最长标签"已回复开发信"留够空间
  { title: '建联情况',      key: 'contactStatus',   width: 120, sorter: true, dataIndex: 'contactStatus' },
  { title: '跟进人',        dataIndex: 'followerPerson', key: 'followerPerson', width: 90, sorter: true },
  { title: '备注',          dataIndex: 'notes',     key: 'notes',         width: 160, ellipsis: true },
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 230, sensitive: true },
  { title: '视频投流成本（$）',           key: 'adSpendCost',    width: 140, sensitive: true },
  { title: '视频版权成本（$）',           key: 'copyrightCost',  width: 140, sensitive: true },
  { title: '红人邮箱',      dataIndex: 'email',     key: 'email',         width: 160, sorter: true },
  { title: '联系方式',      key: 'contacts',        width: 150 },
  { title: '已签署合同',    key: 'contractLink',    width: 280 },
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
// "已签署合同"列：跟编辑弹窗里的展示保持一致，需要按 id 解出品牌方/团队名字
function brandNameById(id) {
  return brands.value.find(b => b.id === id)?.name || '未知品牌'
}
function teamNameById(id) {
  return teams.value.find(t => t.id === id)?.name || ''
}

async function loadData() {
  loading.value = true
  try {
    const res = await influencerApi.list({
      influencerType: filters.influencerType,
      platform:       filters.platform,
      countryMarket:  filters.countryMarket,
      domain:         filters.domain,
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
      try {
        const contractRes = await influencerContractApi.byInfluencerIds(ids)
        influencerContracts.value = contractRes.data || {}
      } catch { influencerContracts.value = {} }
    } else { projectCounts.value = {}; influencerContracts.value = {} }
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
    influencerType:undefined, platform:undefined, countryMarket:undefined, domain:undefined,
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

function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
// InfluencerFormModal 保存成功后已经调用过 invalidateInfluencers() 清掉了共享缓存
// （红人合作跟踪/红人需求管理的"红人社媒完整名字"下拉框读的是同一份），这里额外把
// 本页自己已经加载进内存的 influencerNames 重新拉一次，不然要等下次进这个页面才会刷新
async function onInfluencerSaved() {
  loadData()
  influencerNames.value = await loadInfluencersSimple()
}
async function handleDelete(id) {
  await influencerApi.delete(id); message.success('删除成功')
  invalidateInfluencers()
  loadData(); loadDomains()
  influencerNames.value = await loadInfluencersSimple()
}
function handleExport() { influencerApi.exportExcel(filters.influencerType) }
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    await influencerApi.importExcel(fd)
    message.success('文件已上传，正在后台导入中，可以去"导入历史"查看进度和结果')
  } catch {}
  return false
}
// "合作中项目"/"已完结项目"下钻弹窗（2026-07 新增）：category 'ACTIVE' 或 'COMPLETED'
function openCollabModal(record, category) {
  collabModalInfluencerId.value = record.id
  collabModalCategory.value = category
  collabModalTitle.value = `${record.accountName} - ${category === 'COMPLETED' ? '已完结项目' : '合作中项目'}`
  collabModalVisible.value = true
}

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
function contactColor(s) {
  const m = { UNDEVELOPED:'default', REPLIED:'processing', INTERESTED:'cyan', COOPERATING:'blue', COOPERATED:'green' }
  return m[s] || 'default'
}
// 红人类型是分类，不是状态，随便挑几个能区分开的颜色
function influencerTypeColor(t) {
  const m = { OVERSEAS_INFLUENCER: 'blue', CHINA_INFLUENCER: 'volcano', FOREIGN_IN_CHINA: 'purple' }
  return m[t] || 'default'
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
  const [b, d, t, names] = await Promise.all([
    brandApi.list(), domainApi.list(), influencerTeamApi.list(), loadInfluencersSimple()
  ])
  brands.value  = b.data || []
  domains.value = d.data || []
  teams.value   = t.data || []
  influencerNames.value = names || []
  loadData()

  // "红人需求管理"的"跳转红人库上传"按钮/"该红人已有XXXX年的合同"提示点击后带 editInfluencerId
  // 跳转过来，自动定位并打开这个红人的编辑弹窗
  const editId = route.query.editInfluencerId
  if (editId) {
    try {
      const res = await influencerApi.getById(editId)
      if (res.data) openEdit(res.data)
    } catch {}
  }
})
</script>

<style scoped>
.contract-mini-card {
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
  font-size: 12px;
}
.contract-mini-card:last-child {
  margin-bottom: 0;
}
.contract-no-team {
  color: #999;
  margin-left: 2px;
}
.contract-mini-range {
  color: #595959;
  font-weight: 500;
  margin: 4px 0;
}
</style>
