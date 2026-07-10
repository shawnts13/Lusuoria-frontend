<template>
  <a-modal :open="visible" title="进度提醒详情" width="1200px" :footer="null"
    @cancel="close" :destroy-on-close="true">
    <div class="filter-bar">
      <a-select v-model:value="brandTeamFilter" placeholder="品牌方-红人团队" allow-clear
        style="width:240px" :options="brandTeamOptions" />
    </div>
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="filteredList" :loading="loading"
        row-key="id" size="middle" :pagination="false" :scroll="{ x: 1300 }">
        <template #summary>
          <a-table-summary>
            <a-table-summary-row>
              <a-table-summary-cell :index="0" :col-span="5">
                合计：{{ filteredList.length }} 笔
              </a-table-summary-cell>
              <a-table-summary-cell :index="5">
                {{ fmtAmount(totalCost) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="6" :col-span="4" />
            </a-table-summary-row>
          </a-table-summary>
        </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { progressReminderApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'
import { useTopScrollbar } from '../../composables/useTopScrollbar'

const props = defineProps({
  visible: { type: Boolean, default: false },
  reminderId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])

const loading = ref(false)
const list = ref([])
const brandTeamFilter = ref(undefined)
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
const filteredList = computed(() => {
  if (!brandTeamFilter.value) return list.value
  return list.value.filter(r => brandTeamKey(r) === brandTeamFilter.value)
})
const totalCost = computed(() =>
  filteredList.value.reduce((sum, r) => sum + (r.influencerCost != null ? +r.influencerCost : 0), 0))

const columns = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190 },
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
    customRender: ({ text }) => text ? formatDate(text) : '—' }
]

async function load() {
  if (!props.reminderId) return
  loading.value = true
  try {
    const res = await progressReminderApi.details(props.reminderId)
    list.value = res.data || []
    brandTeamFilter.value = undefined
    remeasure()
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }
</script>

<style scoped>
.filter-bar { margin-bottom: 12px; }
</style>
