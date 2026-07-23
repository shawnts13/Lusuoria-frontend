<template>
  <a-modal :open="visible" title="涉及的红人需求条目" :footer="null" width="720px" @cancel="close">
    <a-table :columns="columns" :data-source="items" :loading="loading" :pagination="false" size="small" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'videoType'">{{ record.videoTypeLabel || '—' }}</template>
        <template v-if="column.key === 'platform'">{{ (record.platform || '').split('\n').join('、') || '—' }}</template>
        <template v-if="column.key === 'fulfilled'">{{ record.fulfilledCount ?? 0 }}/{{ record.videoCount ?? 0 }}</template>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { requirementApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirementId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])

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

async function load() {
  if (!props.requirementId) return
  loading.value = true
  try {
    const res = await requirementApi.items(props.requirementId)
    items.value = res.data || []
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }
</script>
