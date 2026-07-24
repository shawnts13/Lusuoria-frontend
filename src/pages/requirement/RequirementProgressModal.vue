<template>
  <a-modal :open="visible" title="需求完成进度详情" :footer="null" width="800px" @cancel="close">
    <div class="filter-bar">
      <a-select v-model:value="itemIndexFilter" placeholder="需求条目" allow-clear
        style="width:160px" :options="itemIndexOptions" />
    </div>
    <a-table :columns="columns" :data-source="filteredRecords" :loading="loading" :pagination="false" size="small" row-key="trackingId">
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
        <template v-if="column.key === 'progress'">
          <a-tag v-if="record.progress" :color="collabProgressColor(record.progress)">{{ record.progressLabel || '—' }}</a-tag>
          <span v-else style="color:#bbb">—</span>
        </template>
        <template v-if="column.key === 'action'">
          <a @click="goToTracking(record)">查看详情</a>
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { requirementApi } from '../../api/index'
import { colorForValue } from '../../utils/tagColor'
import { videoTypeColor, collabProgressColor } from '../../utils/enumColors'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirementId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])
const router = useRouter()

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

const columns = [
  { title: '需求条目', key: 'itemIndex', width: 90 },
  { title: '项目视频类型', key: 'videoType', width: 130 },
  { title: '合作平台', key: 'platform', width: 160 },
  { title: '需求内容', key: 'demandContent', width: 200 },
  { title: '视频项目进度', key: 'progress', width: 160 },
  { title: '操作', key: 'action', width: 90 }
]

async function load() {
  if (!props.requirementId) return
  loading.value = true
  itemIndexFilter.value = undefined
  try {
    const res = await requirementApi.progressDetail(props.requirementId)
    records.value = res.data || []
  } finally {
    loading.value = false
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
