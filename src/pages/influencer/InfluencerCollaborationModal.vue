<template>
  <a-modal :open="visible" :title="title" width="95%" style="top:20px" :footer="null" @cancel="close" :destroy-on-close="true">
    <div class="toolbar">
      <span class="total-hint">共 {{ pagination.total }} 条</span>
      <a-button type="primary" @click="openAll">
        <template #icon><ExportOutlined /></template>查看全部（新窗口打开红人合作跟踪）
      </a-button>
    </div>

    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="rows" :loading="loading" :pagination="pagination"
        row-key="id" size="middle" :scroll="{ x: tableScrollX }" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brand'">
            <a-tag v-if="record.brand?.name" :color="colorForValue(record.brand.name)">{{ record.brand.name }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'team'">
            <a-tag v-if="record.team?.name" :color="colorForValue(record.team.name)">{{ record.team.name }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'accountName'">
            {{ record.influencer?.accountName || '—' }}
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
            <span style="color:#262626">{{ record.projectManager?.name || '—' }}</span>
          </template>
          <template v-if="column.key === 'executor'">
            <span style="color:#262626">{{ record.executor?.name || '—' }}</span>
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
            <a-table-summary-cell>汇总</a-table-summary-cell>
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
import { ref, reactive, watch } from 'vue'
import { ExportOutlined } from '@ant-design/icons-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
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

const { getLabel } = useOptions()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading = ref(false)
const rows = ref([])
const totalInfluencerCost = ref(0)
const totalClientPrice = ref(0)
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100']
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

async function loadData() {
  if (!props.influencerId) return
  loading.value = true
  try {
    const res = await collaborationApi.byInfluencer(
      props.influencerId, props.category, pagination.current - 1, pagination.pageSize)
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
    loadData()
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
</style>
