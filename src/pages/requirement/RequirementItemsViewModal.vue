<template>
  <a-modal :open="visible" title="涉及的红人需求条目" :footer="null" width="820px" @cancel="close">
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="items" :loading="loading" :pagination="false"
        size="small" row-key="id" :scroll="{ x: scrollX }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'videoType'">
          <a-tag v-if="record.videoType" :color="videoTypeColor(record.videoType)">{{ record.videoTypeLabel || '—' }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'platform'">
          <template v-if="record.platform">
            <a-tag v-for="p in splitMulti(record.platform)" :key="p" :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
          </template>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'influencerUnitCostPrice'">
          {{ record.influencerUnitCostPrice != null ? fmtNum(record.influencerUnitCostPrice) : '—' }}
        </template>
        <template v-if="column.key === 'clientUnitPrice'">
          {{ record.clientUnitPrice != null ? fmtNum(record.clientUnitPrice) : '—' }}
        </template>
        <template v-if="column.key === 'fulfilled'">
          <span :style="{ color: fulfilledColor(record), fontWeight: 600 }">
            {{ record.fulfilledCount ?? 0 }}/{{ record.videoCount ?? 0 }}
          </span>
        </template>
      </template>
      <template #summary>
        <a-table-summary-row v-if="items.length">
          <a-table-summary-cell :col-span="2">汇总</a-table-summary-cell>
          <a-table-summary-cell>{{ totalVideoCount }}</a-table-summary-cell>
          <a-table-summary-cell :col-span="2"></a-table-summary-cell>
          <a-table-summary-cell>
            <span :style="{ color: totalFulfilledColor, fontWeight: 600 }">
              {{ totalFulfilledCount }}/{{ totalVideoCount }}
            </span>
          </a-table-summary-cell>
        </a-table-summary-row>
      </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { requirementApi } from '../../api/index'
import { colorForValue } from '../../utils/tagColor'
import { videoTypeColor } from '../../utils/enumColors'
import { useTopScrollbar } from '../../composables/useTopScrollbar'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirementId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading = ref(false)
const items = ref([])

const columns = [
  { title: '项目视频类型', key: 'videoType', width: 130 },
  { title: '合作平台', key: 'platform', width: 160 },
  { title: '项目视频数目', dataIndex: 'videoCount', key: 'videoCount', width: 100 },
  { title: '红人视频制作与发布单价成本（$）', dataIndex: 'influencerUnitCostPrice', key: 'influencerUnitCostPrice', width: 180 },
  { title: '客户合作单价（$）', dataIndex: 'clientUnitPrice', key: 'clientUnitPrice', width: 130 },
  { title: '已实施/总数', key: 'fulfilled', width: 110 }
]

const scrollX = computed(() => columns.reduce((sum, c) => sum + (c.width || 120), 0))

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// 已实施/总数配色：还没实施够（含0）用中性灰，正好实施满用绿色，超出（说明数据有问题，
// 比如误关联进了不该关联的记录）用红色提醒
function fulfilledColor(record) {
  const fulfilled = record.fulfilledCount ?? 0
  const total = record.videoCount ?? 0
  if (fulfilled > total) return '#cf1322'
  if (total > 0 && fulfilled === total) return '#237804'
  return '#595959'
}

const totalVideoCount = computed(() => items.value.reduce((sum, r) => sum + (r.videoCount ?? 0), 0))
const totalFulfilledCount = computed(() => items.value.reduce((sum, r) => sum + (r.fulfilledCount ?? 0), 0))
const totalFulfilledColor = computed(() => {
  if (totalFulfilledCount.value > totalVideoCount.value) return '#cf1322'
  if (totalVideoCount.value > 0 && totalFulfilledCount.value === totalVideoCount.value) return '#237804'
  return '#595959'
})

async function load() {
  if (!props.requirementId) return
  loading.value = true
  try {
    const res = await requirementApi.items(props.requirementId)
    items.value = res.data || []
  } finally {
    loading.value = false
    remeasure()
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }
</script>
