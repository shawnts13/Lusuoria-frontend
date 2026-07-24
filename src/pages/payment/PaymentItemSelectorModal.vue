<template>
  <a-modal :open="visible" :title="mode === 'view' ? '涉及的红人视频项目' : '选择涉及的红人视频项目'"
    width="1300px" :footer="null" :destroy-on-close="true" @cancel="close">
    <div v-if="mode === 'select'" class="summary-bar">
      已勾选 <strong>{{ selectedRowKeys.length }}</strong> 条，涉及金额
      <strong>{{ fmtNum(selectedAmount) }}</strong> 美元
    </div>

    <div class="filter-bar">
      <a-select v-model:value="accountFilter" placeholder="红人社媒完整名字" allow-clear show-search
        style="width:220px" :options="accountOptions" />
      <a-select v-model:value="requirementNoFilter" placeholder="内部需求编号" allow-clear show-search
        style="width:220px" :options="requirementNoOptions" />
    </div>
    <div v-if="mode === 'select'" style="font-size:12px;color:#888;margin-bottom:8px">
      提示：切换上面的筛选条件不会影响已经勾选的记录——可以先按一个需求编号筛选、勾选完，
      再切换成另一个需求编号继续勾选，之前勾的会一直保留，直到点"确定"。
    </div>

    <a-table :columns="columns" :data-source="filteredList" :loading="loading" row-key="trackingId"
      size="small" :pagination="false" :scroll="{ x: 1500, y: 480 }"
      :row-selection="mode === 'select' ? rowSelection : undefined"
      :custom-row="mode === 'select' ? customRow : undefined"
      :row-class-name="rowClassName">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'brandName'">
          <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'teamName'">
          <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'internalRequirementNo'">
          <span v-if="record.internalRequirementNo">{{ record.internalRequirementNo }}</span>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'progressLabel'">
          <a-tag v-if="record.progress" :color="collabProgressColor(record.progress)">{{ record.progressLabel || '—' }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'influencerCost'">
          {{ record.influencerCost != null ? fmtNum(record.influencerCost) : '—' }}
        </template>
        <template v-if="column.key === 'paymentProgressLabel'">
          <span v-if="record.invoiceWarning" class="invoice-warning-cell"
            title="该视频项目未提供invoice，为方便后续审计，需提醒相关负责人催促对应红人">
            <ExclamationCircleFilled />
            <a-tag :color="paymentProgressColor(record.paymentProgress)" style="margin:0 0 0 4px">
              {{ record.paymentProgressLabel || '—' }}
            </a-tag>
          </span>
          <a-tag v-else-if="record.paymentProgress" :color="paymentProgressColor(record.paymentProgress)">
            {{ record.paymentProgressLabel || '—' }}
          </a-tag>
          <span v-else>—</span>
        </template>
        <template v-if="column.key === 'publishDate'">
          <span :class="{ 'off-month-date': isOffMonth(record) }"
            :title="isOffMonth(record) ? '视频发布月份不是本次结算月份' : ''">
            {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
          </span>
        </template>
        <template v-if="column.key === 'cycleDays'">
          {{ record.cycleDays != null ? record.cycleDays + '天' : '—' }}
        </template>
        <template v-if="column.key === 'deadlineDate'">
          {{ record.deadlineDate ? formatDate(record.deadlineDate) : '—' }}
        </template>
      </template>
    </a-table>

    <div class="footer-bar">
      <a-space>
        <a-button @click="close">{{ mode === 'view' ? '关闭' : '取消' }}</a-button>
        <a-button v-if="mode === 'select'" type="primary" @click="handleConfirm">确定</a-button>
      </a-space>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleFilled } from '@ant-design/icons-vue'
import { paymentApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'
import { paymentProgressColor, collabProgressColor } from '../../utils/enumColors'
import { colorForValue } from '../../utils/tagColor'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'select' }, // 'select' | 'view'
  brandId: { type: [Number, String], default: null },
  // 品牌方名称，仅用于判断是不是"TEMU中国"（该品牌方排序/展示有专属规则，见下方 TEMU_CN 相关逻辑）
  brandName: { type: String, default: null },
  // 这次结款涉及的团队范围，元素可能是 null（代表"不选团队"也在范围内），支持跨团队合并结款
  teamIds: { type: Array, default: () => [] },
  reconcileDate: { type: String, default: null },
  // 本次结款记录的"结算月份"（格式 yyyyMM），仅 TEMU中国 用来判断候选记录是不是"当月"的
  settlementMonth: { type: String, default: null },
  existingPaymentId: { type: [Number, String], default: null },
  // 当前表单里已经确认过的勾选（即使这条结款记录还没保存），重新打开这个弹窗时要按这个恢复
  // 之前的勾选状态——不然新建时筛选一批勾上、关掉再打开一次，之前勾的就全丢了
  selectedTrackingIds: { type: Array, default: () => [] },
  // 从"涉及的内部需求编号"列双击某个具体编号打开时，预置这个筛选条件，直接定位到那一个
  // 需求下涉及的视频，不用打开弹窗后自己再手动选一次
  initialRequirementNoFilter: { type: String, default: null }
})
const emit = defineEmits(['update:visible', 'confirm'])

const loading = ref(false)
const list = ref([])
const selectedRowKeys = ref([])
const accountFilter = ref(undefined)
const requirementNoFilter = ref(undefined)

const columns = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190 },
  { title: '内部需求编号', key: 'internalRequirementNo', width: 190 },
  { title: '品牌方', key: 'brandName', width: 110 },
  { title: '红人团队', key: 'teamName', width: 100 },
  { title: '红人社媒完整名字', dataIndex: 'accountName', key: 'accountName', width: 150 },
  { title: '需求内容', dataIndex: 'demandContent', key: 'demandContent', width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180 },
  { title: '视频项目进度', key: 'progressLabel', width: 140 },
  { title: '红人结款进度', key: 'paymentProgressLabel', width: 170 },
  { title: '视频发布时间', key: 'publishDate', width: 110 },
  { title: '结款周期', key: 'cycleDays', width: 90 },
  { title: '最迟结款日', key: 'deadlineDate', width: 110 }
]

const selectedAmount = computed(() => {
  const set = new Set(selectedRowKeys.value)
  return list.value.filter(r => set.has(r.trackingId))
    .reduce((sum, r) => sum + (r.influencerCost != null ? +r.influencerCost : 0), 0)
})

// 按"红人社媒完整名字"筛选，方便管理层按红人扫视整批记录；不筛选时保持后端算好的默认顺序
// （也是按这个维度排序的）。筛选只影响表格展示，已勾选的状态（selectedRowKeys）不受影响，
// 切换/清空筛选后之前勾选的记录依然是选中的
const accountOptions = computed(() => {
  const names = [...new Set(list.value.map(r => r.accountName).filter(Boolean))].sort()
  return names.map(n => ({ value: n, label: n }))
})
// 内部需求编号筛选：跟红人社媒完整名字筛选同一个道理，只影响展示，不影响已勾选的记录——
// 方便先筛一个需求编号勾完，再切到另一个需求编号继续勾，一次性把多个需求的视频都选上
const requirementNoOptions = computed(() => {
  const nos = [...new Set(list.value.map(r => r.internalRequirementNo).filter(Boolean))].sort()
  return nos.map(n => ({ value: n, label: n }))
})
const filteredList = computed(() => {
  let result = list.value
  if (accountFilter.value) result = result.filter(r => r.accountName === accountFilter.value)
  if (requirementNoFilter.value) result = result.filter(r => r.internalRequirementNo === requirementNoFilter.value)
  return result
})

function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// TEMU中国排序/展示专属规则：品牌方目前没有结构化的"品类/地区"字段，只能按名称精确匹配
// （品牌方以后大概率会新增，做成枚举类不现实，直接按 Brand.name 字符串匹配）
const TEMU_CN = 'TEMU中国'

/** 取某个日期在"北京时间"下的 yyyyMM，跟结算月份（settlementMonth）的格式对齐 */
function monthKeyOf(d) {
  if (!d) return null
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit'
  }).formatToParts(new Date(d))
  const map = {}
  for (const p of parts) map[p.type] = p.value
  return `${map.year}${map.month}`
}

// 是不是"非本次结算月份"的记录：仅 TEMU中国 需要区分，其余品牌方一律不标记
function isOffMonth(record) {
  return props.brandName === TEMU_CN && !!props.settlementMonth
    && monthKeyOf(record.publishDate) !== props.settlementMonth
}
function rowClassName(record) {
  return isOffMonth(record) ? 'off-month-row' : ''
}

// TEMU中国专属排序：视频发布月份=本次结算月份的排最前；组内再按最迟结款日从近到远排
// （越紧迫越靠前，没有最迟结款日的排最后）。其余品牌方保持原有按红人社媒完整名字排序
function sortForDisplay(items) {
  if (props.brandName !== TEMU_CN) {
    return [...items].sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''))
  }
  return [...items].sort((a, b) => {
    const aCur = monthKeyOf(a.publishDate) === props.settlementMonth
    const bCur = monthKeyOf(b.publishDate) === props.settlementMonth
    if (aCur !== bCur) return aCur ? -1 : 1
    const aDeadline = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Infinity
    const bDeadline = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Infinity
    return aDeadline - bDeadline
  })
}

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: keys => { selectedRowKeys.value = keys }
}))

// 点击行内任意位置也能勾选/取消勾选，不用非得精准点中前面那个小方框——方便先横向滑到最右边
// 看完信息再选的操作习惯
function toggleRow(record) {
  const idx = selectedRowKeys.value.indexOf(record.trackingId)
  selectedRowKeys.value = idx === -1
    ? [...selectedRowKeys.value, record.trackingId]
    : selectedRowKeys.value.filter(k => k !== record.trackingId)
}
function customRow(record) {
  return {
    style: { cursor: 'pointer' },
    onClick: (e) => {
      // 点在勾选框本身上时，勾选框自己的 change 已经处理过了，这里不要再触发一次，
      // 不然会跟勾选框的状态互相抵消
      if (e.target.closest('.ant-checkbox-wrapper')) return
      toggleRow(record)
    }
  }
}

async function load() {
  loading.value = true
  accountFilter.value = undefined
  requirementNoFilter.value = props.initialRequirementNoFilter || undefined
  try {
    if (props.mode === 'view') {
      const res = await paymentApi.items(props.existingPaymentId)
      list.value = sortForDisplay(res.data || [])
      return
    }

    // teamIds 里的真实团队 id 用逗号拼成一个字符串传给后端（数组会被 axios 序列化成
    // teamIds[]=1&teamIds[]=2 这种带方括号的格式，Spring 的 List<Long> 绑定不了），
    // "不选团队"单独用 includeNoTeam 这个布尔值表示，不能塞进同一个逗号字符串里
    const realTeamIds = props.teamIds.filter(id => id != null)
    const includeNoTeam = props.teamIds.includes(null)
    const candidatesRes = await paymentApi.candidates({
      brandId: props.brandId,
      teamIds: realTeamIds.length ? realTeamIds.join(',') : undefined,
      includeNoTeam,
      reconcileDate: props.reconcileDate || undefined
    })
    let items = candidatesRes.data || []

    let existingItems = []
    if (props.existingPaymentId) {
      const existingRes = await paymentApi.items(props.existingPaymentId)
      existingItems = existingRes.data || []
    }

    // 候选列表本身已经排除了"已纳入批次"的记录，编辑态下当前这条结款记录已勾选的
    // 条目需要单独查出来合并进来（默认勾选），避免编辑时"看不到自己已经选过的项目"
    const existingIds = new Set(existingItems.map(i => i.trackingId))
    items = [...existingItems, ...items.filter(i => !existingIds.has(i.trackingId))]
    // 合并后重新排序一遍——上面 existingItems 排在前面会打乱顺序。默认（不筛选）就该按
    // sortForDisplay() 的规则排：TEMU中国按"结算月份优先+最迟结款日紧迫性"，其余品牌方
    // 保持原来按红人社媒完整名字排序，跟后端 candidates/items 接口的默认顺序保持一致
    items = sortForDisplay(items)

    list.value = items
    // 已勾选状态取三者的并集：符合自动勾选规则的、已经落库关联到这条结款记录的、
    // 以及表单里已经确认过但还没保存的（关掉弹窗重开一次不应该丢失之前勾好的记录）
    const previouslySelectedIds = new Set(props.selectedTrackingIds)
    selectedRowKeys.value = items.filter(i =>
      i.defaultChecked || existingIds.has(i.trackingId) || previouslySelectedIds.has(i.trackingId)
    ).map(i => i.trackingId)
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }

function handleConfirm() {
  const set = new Set(selectedRowKeys.value)
  const selected = list.value.filter(r => set.has(r.trackingId))
  if (selected.length === 0) return

  const warningItems = selected.filter(r => r.invoiceWarning)
  if (warningItems.length > 0) {
    const amount = warningItems.reduce((sum, r) => sum + (r.influencerCost != null ? +r.influencerCost : 0), 0)
    Modal.confirm({
      title: '确认包含未提供invoice的记录？',
      content: `本次结款记录勾选了"待红人发送invoice"的记录共${warningItems.length}条，涉及金额${fmtNum(amount)}美元，您是否要这么做？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => doConfirm(selected)
    })
    return
  }
  doConfirm(selected)
}

function doConfirm(selected) {
  emit('confirm', selected)
  close()
}
</script>

<style scoped>
.summary-bar { margin-bottom: 12px; font-size: 14px; }
.filter-bar { margin-bottom: 12px; }
.footer-bar { margin-top: 16px; text-align: right; }
.invoice-warning-cell {
  display: inline-block;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
  border-radius: 4px;
  padding: 1px 6px;
}
.off-month-date {
  display: inline-block;
  border: 1px solid #faad14;
  border-radius: 4px;
  padding: 0 6px;
}
</style>

<style>
/* 仅 TEMU中国：视频发布月份不是本次结算月份的行，整行标浅灰，跟当月记录做区分
   （不能用 scoped，antd a-table 的行是通过 :row-class-name 渲染到组件外层的 DOM 上的） */
.off-month-row > td {
  background: #fafafa !important;
}
</style>
