<template>
  <a-modal :open="visible" title="需求完成进度详情" :footer="null" width="1100px" @cancel="close">
    <div class="filter-bar">
      <a-select v-model:value="itemIndexFilter" placeholder="需求条目" allow-clear
        style="width:160px" :options="itemIndexOptions" />
    </div>
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="filteredRecords" :loading="loading" :pagination="false"
        size="small" row-key="trackingId" :scroll="{ x: scrollX }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'itemIndex'">
          <a-tag v-if="record.itemIndex != null" :color="colorForValue(String(record.itemIndex))">条目{{ record.itemIndex }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'videoType'">
          <a-tag v-if="record.videoType" :color="videoTypeColor(record.videoType)">{{ record.videoTypeLabel || '—' }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'platform'">
          <template v-if="record.platform">
            <a-tag v-for="p in record.platform.split('\n').filter(Boolean)" :key="p"
              :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
          </template>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'demandContent'">{{ record.demandContent || '—' }}</template>
        <template v-if="column.key === 'influencerUnitCostPrice'">
          {{ record.influencerUnitCostPrice != null ? fmtNum(record.influencerUnitCostPrice) : '—' }}
        </template>
        <template v-if="column.key === 'clientUnitPrice'">
          {{ record.clientUnitPrice != null ? fmtNum(record.clientUnitPrice) : '—' }}
        </template>
        <template v-if="column.key === 'publishDate'">
          {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
        </template>
        <template v-if="column.key === 'progress'">
          <a-tag v-if="record.progress" :color="collabProgressColor(record.progress)">{{ record.progressLabel || '—' }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'action'">
          <a @click="goToTracking(record)">查看详情</a>
        </template>
      </template>
      <template #summary>
        <a-table-summary-row v-if="filteredRecords.length">
          <a-table-summary-cell :col-span="columns.length">
            共 <b>{{ filteredRecords.length }}</b> 条记录，其中已完成（视频项目进度已发布/已结算/折损）
            <b>{{ completedCount }}</b> 条；红人视频制作与发布成本合计 <b>{{ fmtNum(totalInfluencerCost) }}</b>，
            客户合作价格合计 <b>{{ fmtNum(totalClientPrice) }}</b>
          </a-table-summary-cell>
        </a-table-summary-row>
      </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { requirementApi } from '../../api/index'
import { colorForValue } from '../../utils/tagColor'
import { videoTypeColor, collabProgressColor } from '../../utils/enumColors'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirementId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])
const router = useRouter()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading = ref(false)
const records = ref([])
const itemIndexFilter = ref(undefined)

// 筛选项按需求里实际出现过的条目编号排序，方便按顺序挑
const itemIndexOptions = computed(() => {
  const indexes = [...new Set(records.value.map(r => r.itemIndex).filter(i => i != null))].sort((a, b) => a - b)
  return indexes.map(i => ({ value: i, label: `条目${i}` }))
})
const filteredRecords = computed(() => {
  if (itemIndexFilter.value == null) return records.value
  return records.value.filter(r => r.itemIndex === itemIndexFilter.value)
})

// 跟后端"需求完成进度"分子的口径保持一致（countCompletedByRequirementNos）：
// 已发布(未结算)/已加入客户未结算列表/客户已结算/折损 这四个状态算"已完成"
const COMPLETED_PROGRESS = ['PUBLISHED_UNSETTLED', 'JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED', 'DELAYED']
const completedCount = computed(() =>
  filteredRecords.value.filter(r => COMPLETED_PROGRESS.includes(r.progress)).length)

const totalInfluencerCost = computed(() =>
  filteredRecords.value.reduce((sum, r) => sum + (parseFloat(r.influencerUnitCostPrice) || 0), 0))
const totalClientPrice = computed(() =>
  filteredRecords.value.reduce((sum, r) => sum + (parseFloat(r.clientUnitPrice) || 0), 0))

const columns = [
  { title: '需求条目', key: 'itemIndex', width: 90 },
  { title: '项目视频类型', key: 'videoType', width: 130 },
  { title: '合作平台', key: 'platform', width: 160 },
  { title: '需求内容', key: 'demandContent', width: 200 },
  { title: '红人视频制作与发布单价成本（$）', key: 'influencerUnitCostPrice', width: 180 },
  { title: '客户合作单价（$）', key: 'clientUnitPrice', width: 130 },
  // 2026-08 新增：方便直接在这个详情列表里对照每条记录自己的发布时间是否跟"需求完成时间"
  // （该需求所有关联记录里最晚的视频发布时间）对得上，不用跳去合作跟踪模块逐条查
  { title: '视频发布时间', key: 'publishDate', width: 120 },
  { title: '视频项目进度', key: 'progress', width: 160 },
  { title: '操作', key: 'action', width: 90 }
]

const scrollX = computed(() => columns.reduce((sum, c) => sum + (c.width || 120), 0))

function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function load() {
  if (!props.requirementId) return
  loading.value = true
  itemIndexFilter.value = undefined
  try {
    const res = await requirementApi.progressDetail(props.requirementId)
    records.value = res.data || []
  } finally {
    loading.value = false
    remeasure()
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }

// "红人合作跟踪"列表页支持按内部项目编号精确筛选定位，直接带过去
function goToTracking(record) {
  router.push({ path: '/collaborations', query: { internalProjectNo: record.internalProjectNo } })
}
</script>

<style scoped>
.filter-bar { margin-bottom: 12px; }
</style>
