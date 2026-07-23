<template>
  <a-modal :open="visible" title="进度提醒详情" width="1200px" :footer="null"
    @cancel="close" :destroy-on-close="true">
    <div class="filter-bar">
      <a-select v-model:value="brandTeamFilter" placeholder="品牌方-红人团队" allow-clear
        style="width:240px" :options="brandTeamOptions" />
      <a-select v-model:value="accountNameFilter" placeholder="红人社媒完整名字" allow-clear show-search
        style="width:200px" :options="accountNameOptions" />
    </div>
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="filteredList" :loading="loading"
        row-key="id" size="middle" :pagination="false" :scroll="{ x: scrollX }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'platform'">
            {{ (record.platform || '').split('\n').join('、') || '—' }}
          </template>
          <template v-if="column.key === 'action'">
            <a @click="goToDetail(record)">查看详情</a>
            <template v-if="canAcknowledge">
              <a-divider type="vertical" />
              <a-popconfirm title="标记为已处理？下次批次前不会再提醒这条（进度有变化时会自动恢复提醒）"
                @confirm="handleAcknowledge(record)">
                <a style="color:#52c41a">标记已处理</a>
              </a-popconfirm>
            </template>
          </template>
        </template>
        <template #summary v-if="summaryCells.length">
          <a-table-summary>
            <a-table-summary-row>
              <a-table-summary-cell v-for="cell in summaryCells" :key="cell.index"
                :index="cell.index" :col-span="cell.colSpan">
                <template v-if="cell.type === 'label'">合计：{{ filteredList.length }} 笔</template>
                <template v-else-if="cell.type === 'total'">{{ fmtAmount(cell.value) }}</template>
              </a-table-summary-cell>
            </a-table-summary-row>
          </a-table-summary>
        </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { progressReminderApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { useAuthStore } from '../../store/auth'

const router = useRouter()
const authStore = useAuthStore()

const props = defineProps({
  visible: { type: Boolean, default: false },
  reminderId: { type: [Number, String], default: null },
  // 只有这3类"进度滞留/Invoice逾期"提醒支持"标记已处理"，且只对项目负责人/执行人员/财务
  // 本人生效（跟后端 acknowledge 的受众一致）——ADMIN/管理层看到的是完整视角，标记对他们
  // 自己没有意义，所以不展示这个操作
  category: { type: String, default: null }
})
const emit = defineEmits(['update:visible'])

const STALL_CATEGORIES = ['PM_EXECUTOR_PROGRESS_STALL', 'FINANCE_PROGRESS_STALL']
const ACKNOWLEDGEABLE_CATEGORIES = [...STALL_CATEGORIES, 'REQUIREMENT_INVOICE_OVERDUE']
const canAcknowledge = computed(() =>
  ACKNOWLEDGEABLE_CATEGORIES.includes(props.category) && !authStore.isAdmin && !authStore.isManagement)

const loading = ref(false)
const list = ref([])
const brandTeamFilter = ref(undefined)
const accountNameFilter = ref(undefined)
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

function fmtAmount(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 品牌方-红人团队组合筛选：选项来自当前明细列表里实际出现过的组合，没有团队的记录归到"（无团队）"
function brandTeamKey(r) {
  return `${r.brandName || '—'} - ${r.teamName || '（无团队）'}`
}
const brandTeamOptions = computed(() => {
  const keys = [...new Set(list.value.map(brandTeamKey))]
  return keys.map(k => ({ value: k, label: k }))
})

// "红人社媒完整名字"筛选：下拉选项按该红人名下最早的截止时间排序（越紧急的越靠前），
// 方便优先处理最快要逾期的红人；没有截止时间的名字排在最后
const accountNameOptions = computed(() => {
  const earliestDeadline = new Map()
  for (const r of list.value) {
    if (!r.accountName || !r.deadlineDate) continue
    const cur = earliestDeadline.get(r.accountName)
    if (!cur || new Date(r.deadlineDate) < new Date(cur)) earliestDeadline.set(r.accountName, r.deadlineDate)
  }
  const names = [...new Set(list.value.map(r => r.accountName).filter(Boolean))]
  names.sort((a, b) => {
    const da = earliestDeadline.get(a)
    const db = earliestDeadline.get(b)
    if (!da && !db) return a.localeCompare(b)
    if (!da) return 1
    if (!db) return -1
    return new Date(da) - new Date(db)
  })
  return names.map(n => ({ value: n, label: n }))
})

// 排序：先按红人社媒完整名字归组，组内再按截止时间升序（越早到期的越靠前）；
// 没有截止时间的记录排在同名分组的最后
function compareRows(a, b) {
  const nameCompare = (a.accountName || '').localeCompare(b.accountName || '')
  if (nameCompare !== 0) return nameCompare
  if (!a.deadlineDate && !b.deadlineDate) return 0
  if (!a.deadlineDate) return 1
  if (!b.deadlineDate) return -1
  return new Date(a.deadlineDate) - new Date(b.deadlineDate)
}

const filteredList = computed(() => {
  let result = list.value
  if (brandTeamFilter.value) result = result.filter(r => brandTeamKey(r) === brandTeamFilter.value)
  if (accountNameFilter.value) result = result.filter(r => r.accountName === accountNameFilter.value)
  return [...result].sort(compareRows)
})

// 汇总合计的金额列：老类目/进度滞留两类是"红人视频制作与发布成本"，Invoice逾期是"总成本"——
// 字段名一样（influencerCost），语义按类别不同，这里统一按这个字段求和即可。
// "客户合作价格（$）"是单独一列的合计，两个金额不相加，各自在自己的列下面显示
const totalCost = computed(() =>
  filteredList.value.reduce((sum, r) => sum + (r.influencerCost != null ? +r.influencerCost : 0), 0))
const totalClientPrice = computed(() =>
  filteredList.value.reduce((sum, r) => sum + (r.clientPrice != null ? +r.clientPrice : 0), 0))

// 老类目（COLLAB_PAYMENT_DUE）列定义，保持不变
const PAYMENT_DUE_COLUMNS = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      dataIndex: 'teamName',            key: 'teamName',            width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '需求内容',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '红人视频制作与发布成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 180,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '视频项目进度',  dataIndex: 'progressLabel',       key: 'progressLabel',       width: 140,
    customRender: ({ text }) => text || '—' },
  { title: '视频发布时间',  dataIndex: 'publishDate',         key: 'publishDate',         width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '结款周期',      dataIndex: 'cycleDays',           key: 'cycleDays',           width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '最迟结款日',    dataIndex: 'deadlineDate',        key: 'deadlineDate',        width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// 进度滞留（项目负责人/财务视角）：只保留红人合作跟踪本身相关的字段，去掉"结款周期"/
// "最迟结款日"/"视频发布时间"这些跟结款相关、对滞留提醒没有意义的字段；字段顺序尽量
// 跟"红人合作跟踪"列表页保持一致
const STALL_COLUMNS = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      dataIndex: 'teamName',            key: 'teamName',            width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '合作平台',      key: 'platform',                  width: 130 },
  { title: '需求内容',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '视频项目进度',  dataIndex: 'progressLabel',       key: 'progressLabel',       width: 140,
    customRender: ({ text }) => text || '—' },
  { title: '项目视频类型',  dataIndex: 'videoTypeLabel',      key: 'videoTypeLabel',      width: 120,
    customRender: ({ text }) => text || '—' },
  { title: '红人视频制作与发布成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 180,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '客户合作价格（$）', dataIndex: 'clientPrice',     key: 'clientPrice',         width: 140,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '内部执行人员（可选）', dataIndex: 'executorName', key: 'executorName',        width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '提醒阈值（工作日）', dataIndex: 'cycleDays',      key: 'cycleDays',            width: 130,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// Invoice逾期：这一类是按"需求"整体展示的，不是单条视频，展示需求维度的汇总字段
const INVOICE_OVERDUE_COLUMNS = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 200,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      dataIndex: 'teamName',            key: 'teamName',            width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '需求条目总数',  dataIndex: 'cycleDays',           key: 'cycleDays',           width: 110,
    customRender: ({ text }) => text != null ? text : '—' },
  { title: '客户合作总价格（$）', dataIndex: 'clientPrice',   key: 'clientPrice',         width: 160,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '红人视频制作与发布总成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 200,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

const columns = computed(() => {
  if (STALL_CATEGORIES.includes(props.category)) return STALL_COLUMNS
  if (props.category === 'REQUIREMENT_INVOICE_OVERDUE') return INVOICE_OVERDUE_COLUMNS
  return PAYMENT_DUE_COLUMNS
})
const scrollX = computed(() => columns.value.reduce((sum, c) => sum + (c.width || 120), 0))

// 汇总行要展示合计的列：目前是"红人视频制作与发布成本（$）"和"客户合作价格（$）"，两列各自
// 独立求和（不相加）。按列在当前 columns 里的实际位置排序，中间/前后空隙用空白单元格补齐，
// 这样不管哪个类别的列顺序如何（进度滞留是成本在前价格在后，Invoice逾期反过来），都能对齐
const summaryCells = computed(() => {
  const targets = []
  const costIdx = columns.value.findIndex(c => c.key === 'influencerCost')
  if (costIdx >= 0) targets.push({ index: costIdx, value: totalCost.value })
  const priceIdx = columns.value.findIndex(c => c.key === 'clientPrice')
  if (priceIdx >= 0) targets.push({ index: priceIdx, value: totalClientPrice.value })
  if (!targets.length) return []
  targets.sort((a, b) => a.index - b.index)

  const cells = []
  let cursor = 0
  targets.forEach((t, i) => {
    const gap = t.index - cursor
    if (gap > 0) cells.push({ index: cursor, colSpan: gap, type: i === 0 ? 'label' : 'blank' })
    cells.push({ index: t.index, colSpan: 1, type: 'total', value: t.value })
    cursor = t.index + 1
  })
  const trailing = columns.value.length - cursor
  if (trailing > 0) cells.push({ index: cursor, colSpan: trailing, type: 'blank' })
  return cells
})

async function load() {
  if (!props.reminderId) return
  loading.value = true
  try {
    const res = await progressReminderApi.details(props.reminderId)
    list.value = res.data || []
    brandTeamFilter.value = undefined
    accountNameFilter.value = undefined
    remeasure()
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }

// Invoice逾期提醒的明细行没有单一对应的合作跟踪记录，跳转到"红人需求管理"按内部需求编号定位；
// 其余几类（临近结款/进度滞留）跳转到"红人合作跟踪"按内部项目编号定位
function goToDetail(record) {
  if (record.internalRequirementNo) {
    router.push({ path: '/requirements', query: { internalRequirementNo: record.internalRequirementNo } })
  } else {
    router.push({ path: '/collaborations', query: { internalProjectNo: record.internalProjectNo } })
  }
}

async function handleAcknowledge(record) {
  const targetId = props.category === 'REQUIREMENT_INVOICE_OVERDUE' ? record.requirementId : record.trackingId
  await progressReminderApi.acknowledge(props.category, targetId)
  message.success('已标记为已处理，进度有变化前不会再提醒这条')
  list.value = list.value.filter(r => r.id !== record.id)
}
</script>

<style scoped>
.filter-bar { margin-bottom: 12px; }
</style>
