<template>
  <a-modal :open="visible" title="进度提醒详情" width="1100px" :footer="null"
    @cancel="close" :destroy-on-close="true">
    <a-table :columns="columns" :data-source="list" :loading="loading"
      row-key="id" size="middle" :pagination="false" />
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { progressReminderApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible: { type: Boolean, default: false },
  reminderId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible'])

const loading = ref(false)
const list = ref([])

const columns = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190 },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      dataIndex: 'teamName',            key: 'teamName',            width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '需求内容',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
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
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }
</script>
