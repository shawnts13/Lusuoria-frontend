<template>
  <a-modal :open="visible" title="需求完成进度详情" :footer="null" width="800px" @cancel="close">
    <a-table :columns="columns" :data-source="records" :loading="loading" :pagination="false" size="small" row-key="trackingId">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'videoType'">{{ record.videoTypeLabel || '—' }}</template>
        <template v-if="column.key === 'platform'">{{ (record.platform || '').split('\n').join('、') || '—' }}</template>
        <template v-if="column.key === 'demandContent'">{{ record.demandContent || '—' }}</template>
        <template v-if="column.key === 'progress'">{{ record.progressLabel || '—' }}</template>
        <template v-if="column.key === 'action'">
          <a @click="goToTracking(record)">查看详情</a>
        </template>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { requirementApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirementId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])
const router = useRouter()

const loading = ref(false)
const records = ref([])

const columns = [
  { title: '项目视频类型', key: 'videoType', width: 130 },
  { title: '合作平台', key: 'platform', width: 160 },
  { title: '需求内容', key: 'demandContent', width: 200 },
  { title: '视频项目进度', key: 'progress', width: 160 },
  { title: '操作', key: 'action', width: 90 }
]

async function load() {
  if (!props.requirementId) return
  loading.value = true
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
