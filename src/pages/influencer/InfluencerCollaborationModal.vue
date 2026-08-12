<template>
  <a-modal :open="visible" :title="title" width="95%" style="top:20px" :footer="null" @cancel="close" :destroy-on-close="true">
    <div class="toolbar">
      <span class="total-hint">共 {{ pagination.total }} 条</span>
      <a-button type="primary" @click="openAll">
        <template #icon><ExportOutlined /></template>查看全部（新窗口打开红人合作跟踪）
      </a-button>
    </div>

    <div class="filter-bar">
      <!-- "合作中项目"：品牌方/红人团队排最前面；"已完结项目"：品牌方/红人团队排在项目视频
           发布月份后面——两个类别的筛选项顺序不一样，分开两段写，不用一串零散的 v-if 交错
           拼顺序，容易看错 -->
      <template v-if="category === 'ACTIVE'">
        <a-select v-model:value="filters.brandId" placeholder="品牌方"
          style="width:150px" allow-clear show-search
          :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
          @change="applyFilters">
          <a-select-option v-for="b in brandFilterOptions" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.teamId" placeholder="红人团队"
          style="width:150px" allow-clear show-search
          :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
          @change="applyFilters">
          <a-select-option v-for="t in teamFilterOptions" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.platform" placeholder="合作平台"
          style="width:120px" allow-clear @change="applyFilters">
          <a-select-option v-for="o in platformFilterOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.videoType" placeholder="项目视频类型"
          style="width:140px" allow-clear @change="applyFilters">
          <a-select-option v-for="o in videoTypeFilterOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
        <a-tooltip :title="filters.progress ? getLabel('collab_progress', filters.progress) : ''">
          <a-select v-model:value="filters.progress" placeholder="视频项目进度"
            style="width:140px" allow-clear @change="applyFilters">
            <a-select-option v-for="o in progressFilterOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
          </a-select>
        </a-tooltip>
      </template>
      <template v-else>
        <a-date-picker v-model:value="filters.videoMonthVal" picker="month"
          format="YYYYMM" value-format="YYYYMM" placeholder="项目视频发布月份" style="width:140px"
          @change="v => { filters.videoMonth = v; applyFilters() }" />
        <a-select v-model:value="filters.brandId" placeholder="品牌方"
          style="width:150px" allow-clear show-search
          :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
          @change="applyFilters">
          <a-select-option v-for="b in brandFilterOptions" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.teamId" placeholder="红人团队"
          style="width:150px" allow-clear show-search
          :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
          @change="applyFilters">
          <a-select-option v-for="t in teamFilterOptions" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.platform" placeholder="合作平台"
          style="width:120px" allow-clear @change="applyFilters">
          <a-select-option v-for="o in platformFilterOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.videoType" placeholder="项目视频类型"
          style="width:140px" allow-clear @change="applyFilters">
          <a-select-option v-for="o in videoTypeFilterOptions" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </template>
      <a-select v-model:value="filters.projectManagerId" placeholder="项目负责人"
        style="width:130px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
        @change="applyFilters">
        <a-select-option v-for="pm in projectManagerFilterOptions" :key="pm.id" :value="pm.id" :label="pm.name">{{ pm.name }}</a-select-option>
      </a-select>
      <a-button @click="resetFilters">重置筛选</a-button>
    </div>

    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="rows" :loading="loading" :pagination="pagination"
        row-key="id" size="middle" :scroll="{ x: tableScrollX }" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brand'">
            <a-tag v-if="getBrandName(record.brandId)" :color="colorForValue(getBrandName(record.brandId))">
              {{ getBrandName(record.brandId) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'team'">
            <a-tag v-if="getTeamName(record.teamId)" :color="colorForValue(getTeamName(record.teamId))">
              {{ getTeamName(record.teamId) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'accountName'">
            <span style="color:#262626">{{ getInfluencerName(record.influencerId) || '—' }}</span>
          </template>
          <template v-if="column.key === 'platform'">
            <template v-if="record.platform">
              <a-tag v-for="p in splitMulti(record.platform)" :key="p" :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'demandContent'">
            <span v-if="record.demandContent" style="color:#262626">{{ record.demandContent }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'videoType'">
            <a-tag v-if="record.videoType" :color="videoTypeColor(record.videoType)">
              {{ getLabel('video_type', record.videoType) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'publishLink'">
            <a v-if="record.publishLink" :href="record.publishLink" target="_blank" style="word-break:break-all">
              {{ record.publishLink }}
            </a>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'publishDate'">
            {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
          </template>
          <template v-if="column.key === 'progress'">
            <a-tag v-if="record.progress" :color="collabProgressColor(record.progress)">
              {{ getLabel('collab_progress', record.progress) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'projectManager'">
            <span style="color:#262626">{{ getEmployeeName(record.projectManagerId) || '—' }}</span>
          </template>
          <template v-if="column.key === 'executor'">
            <span style="color:#262626">{{ getEmployeeName(record.executorId) || '—' }}</span>
          </template>
          <template v-if="column.key === 'clientOrderId'">
            <span style="color:#262626">{{ record.clientOrderId || '—' }}</span>
          </template>
          <template v-if="column.key === 'clientPaymentBatch'">
            <span style="color:#262626">{{ record.clientPaymentBatch || '—' }}</span>
          </template>
          <template v-if="column.key === 'influencerCost'">
            <span style="color:#262626">{{ record.influencerCost != null ? fmtNum(record.influencerCost) : '—' }}</span>
          </template>
          <template v-if="column.key === 'clientPrice'">
            <span style="color:#262626">{{ record.clientPrice != null ? fmtNum(record.clientPrice) : '—' }}</span>
          </template>
          <template v-if="column.key === 'action'">
            <a @click="openDetail(record)">查看详情</a>
          </template>
        </template>
        <template #summary>
          <a-table-summary-row v-if="rows.length">
            <a-table-summary-cell>汇总（共 {{ pagination.total }} 条）</a-table-summary-cell>
            <a-table-summary-cell v-for="i in 13" :key="i" />
            <a-table-summary-cell><b>{{ fmtNum(totalInfluencerCost) }}</b></a-table-summary-cell>
            <a-table-summary-cell><b>{{ fmtNum(totalClientPrice) }}</b></a-table-summary-cell>
            <a-table-summary-cell />
          </a-table-summary-row>
        </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ExportOutlined } from '@ant-design/icons-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { useReferenceData } from '../../composables/useReferenceData'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { formatDate } from '../../utils/dateFormat'
import { colorForValue } from '../../utils/tagColor'
import { collabProgressColor, videoTypeColor } from '../../utils/enumColors'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '合作记录明细' },
  influencerId: { type: [Number, String], default: null },
  // 'ACTIVE'（合作中项目）或 'COMPLETED'（已完结项目）
  category: { type: String, required: true }
})
const emit = defineEmits(['update:visible'])

const { getOptions, getLabel } = useOptions()
const { loadBrands, loadTeams, loadEmployees, loadInfluencersSimple } = useReferenceData()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading = ref(false)
const rows = ref([])
const totalInfluencerCost = ref(0)
const totalClientPrice = ref(0)
// 品牌方/红人团队/员工/红人 这几个字段后端返回的是 CollaborationTracking 原始实体，
// brand/team/influencer/projectManager/executor 关联对象都是 @JsonIgnore（跟"红人合作跟踪"
// 列表页同一套约定），前端只拿得到 brandId/teamId/influencerId/projectManagerId/executorId，
// 名字要靠这几个本地加载的引用列表自己查（之前直接读 record.brand?.name 这类嵌套对象，
// 永远是 undefined，这就是"品牌方/红人团队/红人社媒完整名字/项目负责人/内部执行人员都显示
// -"这个 bug 的根因）
const brands = ref([])
const teams = ref([])
const employees = ref([])
const influencers = ref([])
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100']
})

// 筛选下拉的可选值范围（2026-07 新增）：只列出这个红人在该类别下实际出现过的品牌方/团队/
// 合作平台/项目视频类型/视频项目进度/项目负责人，而不是系统里全部的候选值——跟"待处理"里
// 提醒详情弹窗的筛选项同一个思路（ProgressReminderDetailModal.vue 按 list.value 实际出现过的
// 值算选项）。optionSourceRows 是不带任何筛选条件、size=200 单独拉的一份"全量"（同一个红人
// 在这个类别下的记录量不会超过这个上限），只用来算下拉选项，不影响表格本身的数据——表格还是
// 走 loadData() 的分页+筛选查询，两者互不干扰。这份全量只在弹窗打开时拉一次，不随筛选条件
// 变化重新拉，否则选项会跟着筛选结果一起收窄，用户没法看到"还有哪些其他值可以切换筛选"。
const optionSourceRows = ref([])

async function loadOptionSource() {
  try {
    const res = await collaborationApi.byInfluencer(props.influencerId, props.category, 0, 200, {})
    optionSourceRows.value = res.data?.page?.content || []
  } catch (e) {
    optionSourceRows.value = []
  }
}

const brandFilterOptions = computed(() => {
  const ids = [...new Set(optionSourceRows.value.map(r => r.brandId).filter(id => id != null))]
  return ids.map(id => ({ id, name: getBrandName(id) }))
    .filter(o => o.name)
    .sort((a, b) => a.name.localeCompare(b.name))
})
const teamFilterOptions = computed(() => {
  const ids = [...new Set(optionSourceRows.value.map(r => r.teamId).filter(id => id != null))]
  return ids.map(id => ({ id, name: getTeamName(id) }))
    .filter(o => o.name)
    .sort((a, b) => a.name.localeCompare(b.name))
})
const platformFilterOptions = computed(() => {
  const values = new Set()
  for (const r of optionSourceRows.value) {
    for (const p of splitMulti(r.platform)) values.add(p)
  }
  return [...values].sort().map(v => ({ value: v, label: v }))
})
const videoTypeFilterOptions = computed(() => {
  const values = [...new Set(optionSourceRows.value.map(r => r.videoType).filter(Boolean))]
  return values.map(v => ({ value: v, label: getLabel('video_type', v) }))
})
const progressFilterOptions = computed(() => {
  const values = [...new Set(optionSourceRows.value.map(r => r.progress).filter(Boolean))]
  return values.map(v => ({ value: v, label: getLabel('collab_progress', v) }))
})
const projectManagerFilterOptions = computed(() => {
  const ids = [...new Set(optionSourceRows.value.map(r => r.projectManagerId).filter(id => id != null))]
  return ids.map(id => ({ id, name: getEmployeeName(id) }))
    .filter(o => o.name)
    .sort((a, b) => a.name.localeCompare(b.name))
})

// 筛选条件（2026-07 新增，都是可选的，可以同时生效）：videoMonth 只在"已完结项目"展示，
// progress 只在"合作中项目"展示，brandId/teamId/platform/videoType/projectManagerId
// 两个类别都展示（顺序不同，见模板）
const filters = reactive({
  brandId: undefined,
  teamId: undefined,
  platform: undefined,
  videoType: undefined,
  progress: undefined,
  projectManagerId: undefined,
  videoMonth: undefined,
  videoMonthVal: undefined
})

const columns = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 200 },
  { title: '品牌方', key: 'brand', width: 120 },
  { title: '红人团队', key: 'team', width: 140 },
  { title: '红人社媒完整名字', key: 'accountName', width: 160 },
  { title: '合作平台', key: 'platform', width: 130 },
  { title: '需求内容', key: 'demandContent', width: 200, ellipsis: true },
  { title: '项目视频类型', key: 'videoType', width: 130 },
  { title: '视频发布链接', key: 'publishLink', width: 220 },
  { title: '视频发布时间', key: 'publishDate', width: 120 },
  { title: '视频项目进度', key: 'progress', width: 150 },
  { title: '项目负责人', key: 'projectManager', width: 100 },
  { title: '内部执行人员', key: 'executor', width: 100 },
  { title: '客户方的项目订单', key: 'clientOrderId', width: 160 },
  { title: '客户方付款批次', key: 'clientPaymentBatch', width: 150 },
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180 },
  { title: '客户合作价格（$）', key: 'clientPrice', width: 150 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' }
]
const tableScrollX = columns.reduce((sum, c) => sum + (c.width || 120), 0)

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
function fmtNum(v) {
  if (v == null) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getBrandName(brandId) {
  return brands.value.find(b => b.id === brandId)?.name || ''
}
function getTeamName(teamId) {
  return teams.value.find(t => t.id === teamId)?.name || ''
}
function getEmployeeName(employeeId) {
  if (!employeeId) return ''
  return employees.value.find(e => e.id === employeeId)?.name || ''
}
function getInfluencerName(influencerId) {
  if (!influencerId) return ''
  return influencers.value.find(i => i.id === influencerId)?.accountName || ''
}

async function loadReferenceData() {
  const [b, t, e, i] = await Promise.all([loadBrands(), loadTeams(), loadEmployees(), loadInfluencersSimple()])
  brands.value = b || []
  teams.value = t || []
  employees.value = e || []
  influencers.value = i || []
}

async function loadData() {
  if (!props.influencerId) return
  loading.value = true
  try {
    const [res] = await Promise.all([
      collaborationApi.byInfluencer(props.influencerId, props.category, pagination.current - 1, pagination.pageSize, {
        brandId: filters.brandId || undefined,
        teamId: filters.teamId || undefined,
        platform: filters.platform || undefined,
        videoType: filters.videoType || undefined,
        progress: filters.progress || undefined,
        projectManagerId: filters.projectManagerId || undefined,
        videoMonth: filters.videoMonth || undefined
      }),
      loadReferenceData()
    ])
    const data = res.data || {}
    rows.value = data.page?.content || []
    pagination.total = data.page?.totalElements || 0
    totalInfluencerCost.value = data.totalInfluencerCost || 0
    totalClientPrice.value = data.totalClientPrice || 0
  } finally {
    loading.value = false
    remeasure()
  }
}

// 筛选条件变化后回到第一页再查（命中记录数变了，留在原页码可能翻到空白页）
function applyFilters() {
  pagination.current = 1
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    brandId: undefined, teamId: undefined, platform: undefined, videoType: undefined,
    progress: undefined, projectManagerId: undefined,
    videoMonth: undefined, videoMonthVal: undefined
  })
  applyFilters()
}

function handleTableChange(pag) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadData()
}

function openDetail(record) {
  window.open(`/collaborations?internalProjectNo=${encodeURIComponent(record.internalProjectNo || '')}`, '_blank')
}
function openAll() {
  const query = props.category === 'COMPLETED'
    ? `influencerId=${props.influencerId}&progress=SETTLED`
    : `influencerId=${props.influencerId}&onlyIncomplete=true`
  window.open(`/collaborations?${query}`, '_blank')
}

function close() { emit('update:visible', false) }

watch(() => props.visible, v => {
  if (v) {
    pagination.current = 1
    Object.assign(filters, {
      brandId: undefined, teamId: undefined, platform: undefined, videoType: undefined,
      progress: undefined, projectManagerId: undefined,
      videoMonth: undefined, videoMonthVal: undefined
    })
    loadData()
    loadOptionSource()
  }
})
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.total-hint {
  color: #595959;
  font-size: 13px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
