<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">执行人员管理</span>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading"
        row-key="id" size="middle" :pagination="tablePagination">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'email'">
            <span v-if="record.email">{{ record.email }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'salaryInfo'">
            <div v-if="hasAnyRate(record.id)" style="font-size:12px;line-height:1.8">
              <div v-for="type in VIDEO_TYPES" :key="type">
                <template v-if="tierSummary(record.id, type)">
                  <a-tag :color="videoTypeColor(type)" style="margin-right:4px">{{ VIDEO_TYPE_LABELS[type] }}</a-tag>
                  <span v-html="highlightAmounts(tierSummary(record.id, type))"></span>
                </template>
              </div>
            </div>
            <span v-else style="color:#c00000;font-size:12px">请设置对应执行人员的薪资规则</span>
          </template>
          <template v-if="column.key === 'action'">
            <a @click="openEdit(record)">编辑薪资标准</a>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal :open="modalVisible" title="编辑执行人员薪资标准"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false"
      :destroy-on-close="true" width="480px">
      <div style="margin-bottom:12px; color:#262626; font-size:13px">{{ editing?.name }}</div>
      <ExecutorRateFields v-if="editing" ref="ratesRef" :executor-id="editing.id" />
    </a-modal>
  </div>
</template>

<script setup>
/**
 * 执行人员管理 - "项目负责人"角色专属，只能看"执行人员"角色的员工，只能维护自己那份
 * ExecutorPayRate（后端按当前登录人的员工id强制过滤，看不到、也改不了别人配的价），
 * 没有删除按钮。跟"员工管理"（ADMIN/管理层）是两个拆开的模块，共用 ExecutorRateFields 组件。
 */
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { employeeApi, executorPayRateApi } from '../../api/index'
import { VIDEO_TYPES, VIDEO_TYPE_LABELS, formatVideoTypeTiers } from '../../utils/executorRateFormat'
import { videoTypeColor } from '../../utils/enumColors'
import { highlightAmounts } from '../../utils/textHighlight'
import ExecutorRateFields from './ExecutorRateFields.vue'

const loading = ref(false)
const list = ref([])
// 结构：{ [executorId]: { [videoType]: [tier, ...] } }，供列表"薪资标准"列直接展示
// 当前登录人（自己）已配置的档位
const executorRates = ref({})

function tierSummary(executorId, videoType) {
  return formatVideoTypeTiers(executorRates.value[executorId]?.[videoType])
}
function hasAnyRate(executorId) {
  return VIDEO_TYPES.some(type => tierSummary(executorId, type))
}
const modalVisible = ref(false)
const editing = ref(null)
const saving = ref(false)
const ratesRef = ref()

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 140,
    sorter: (a, b) => (a.name || '').localeCompare(b.name || '', 'zh') },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 200 },
  { title: '薪资标准', key: 'salaryInfo', width: 260 },
  { title: '操作', key: 'action', width: 120 }
]

const tablePagination = {
  pageSize: 20,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100'],
  showTotal: t => `共 ${t} 条`
}

async function loadData() {
  loading.value = true
  try {
    const [empRes, rateRes] = await Promise.all([
      employeeApi.list('执行人员'),
      executorPayRateApi.list()
    ])
    list.value = empRes.data || []
    const map = {}
    for (const t of (rateRes.data || [])) {
      if (!map[t.executorId]) map[t.executorId] = {}
      if (!map[t.executorId][t.videoType]) map[t.executorId][t.videoType] = []
      map[t.executorId][t.videoType].push(t)
    }
    executorRates.value = map
  } finally { loading.value = false }
}

function openEdit(r) {
  editing.value = r
  modalVisible.value = true
}

async function handleSave() {
  if (saving.value || !ratesRef.value) return
  saving.value = true
  try {
    await ratesRef.value.save()
    message.success('保存成功')
    modalVisible.value = false
    loadData()
  } finally { saving.value = false }
}

onMounted(loadData)
</script>
