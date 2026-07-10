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
    </div>

    <a-table :columns="columns" :data-source="filteredList" :loading="loading" row-key="trackingId"
      size="small" :pagination="false" :scroll="{ x: 1500, y: 480 }"
      :row-selection="mode === 'select' ? rowSelection : undefined"
      :custom-row="mode === 'select' ? customRow : undefined">
      <template #bodyCell="{ column, record }">
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
          {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
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
import { paymentProgressColor } from '../../utils/enumColors'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'select' }, // 'select' | 'view'
  brandId: { type: [Number, String], default: null },
  // 这次结款涉及的团队范围，元素可能是 null（代表"不选团队"也在范围内），支持跨团队合并结款
  teamIds: { type: Array, default: () => [] },
  reconcileDate: { type: String, default: null },
  existingPaymentId: { type: [Number, String], default: null },
  // 当前表单里已经确认过的勾选（即使这条结款记录还没保存），重新打开这个弹窗时要按这个恢复
  // 之前的勾选状态——不然新建时筛选一批勾上、关掉再打开一次，之前勾的就全丢了
  selectedTrackingIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'confirm'])

const loading = ref(false)
const list = ref([])
const selectedRowKeys = ref([])
const accountFilter = ref(undefined)

const columns = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190 },
  { title: '品牌方', dataIndex: 'brandName', key: 'brandName', width: 110 },
  { title: '红人团队', dataIndex: 'teamName', key: 'teamName', width: 100,
    customRender: ({ text }) => text || '—' },
  { title: '红人社媒完整名字', dataIndex: 'accountName', key: 'accountName', width: 150 },
  { title: '需求内容', dataIndex: 'demandContent', key: 'demandContent', width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180 },
  { title: '视频项目进度', dataIndex: 'progressLabel', key: 'progressLabel', width: 140,
    customRender: ({ text }) => text || '—' },
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
const filteredList = computed(() => {
  if (!accountFilter.value) return list.value
  return list.value.filter(r => r.accountName === accountFilter.value)
})

function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  try {
    if (props.mode === 'view') {
      const res = await paymentApi.items(props.existingPaymentId)
      list.value = res.data || []
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
    // 合并后重新按红人社媒完整名字排序一遍——上面 existingItems 排在前面会打乱顺序，
    // 默认（不筛选）就该是按这个维度排序，跟后端 candidates/items 接口的默认顺序保持一致
    items.sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''))

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
</style>
