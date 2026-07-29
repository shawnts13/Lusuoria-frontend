<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">进度提醒阈值维护</span>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom:16px"
      message="这里维护的是'待处理-进度提醒'各类提醒的判定参数（多少个工作日算滞留、提醒分几档、每档边界是多少天等）。改动后立即生效：跑批（每天凌晨3点）或手动点'结款后更新提示内容'/'项目流转后更新提示内容'时会用新的值重新计算。"
    />

    <a-spin :spinning="loading">
      <div v-for="group in groupedConfigs" :key="group.category" class="category-card">
        <div class="category-header">
          <a-tag :color="colorForValue(group.label)" style="font-size:13px;padding:2px 10px">{{ group.label }}</a-tag>
        </div>
        <a-table :columns="columns" :data-source="group.items" :pagination="false"
          row-key="id" size="middle">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'paramLabel'">
              <span style="color:#262626">{{ record.paramLabel }}</span>
            </template>
            <template v-if="column.key === 'value'">
              <span style="color:#237804;font-weight:600">{{ record.paramValue }} {{ record.unit }}</span>
            </template>
            <template v-if="column.key === 'action'">
              <a @click="openEdit(record)">修改</a>
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>

    <a-modal :open="modalVisible" title="修改阈值参数"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false" :destroy-on-close="true">
      <div class="edit-hint">
        <a-tag v-if="editingRecord" :color="colorForValue(categoryLabelOf(editingRecord.category))">
          {{ categoryLabelOf(editingRecord.category) }}
        </a-tag>
        <span style="color:#262626">{{ editingRecord?.paramLabel }}</span>
      </div>
      <a-form layout="vertical">
        <a-form-item :label="`数值（单位：${editingRecord?.unit || ''}）`">
          <a-input-number v-model:value="editForm.paramValue" :min="0" :precision="0" style="width:100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { reminderThresholdApi } from '../../api/index'
import { colorForValue } from '../../utils/tagColor'
import { CATEGORY_LABEL, categoryLabel } from '../../utils/reminderLabels'

const loading = ref(false)
const saving = ref(false)
const configs = ref([])
const modalVisible = ref(false)
const editingRecord = ref(null)
const editForm = reactive({ paramValue: null })

const columns = [
  { title: '参数说明', key: 'paramLabel' },
  { title: '当前值', key: 'value', width: 160 },
  { title: '操作', key: 'action', width: 80 }
]

// 分组展示顺序：跟进度提醒卡片列表默认出现的顺序一致，方便对照
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL)

function categoryLabelOf(c) { return categoryLabel(c) }

// 默认展示时把不同提醒类型的数据 group 在一起（Shawn 要求），不是简单地把所有参数堆在一页
const groupedConfigs = computed(() => {
  const byCategory = new Map()
  for (const c of configs.value) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category).push(c)
  }
  const groups = []
  for (const category of CATEGORY_ORDER) {
    const items = byCategory.get(category)
    if (items && items.length) {
      groups.push({ category, label: categoryLabelOf(category), items: items.sort((a, b) => a.sortOrder - b.sortOrder) })
      byCategory.delete(category)
    }
  }
  // 兜底：万一以后新增了类别但没同步加到 CATEGORY_ORDER 里，也不会丢数据，排在最后
  for (const [category, items] of byCategory) {
    groups.push({ category, label: categoryLabelOf(category), items: items.sort((a, b) => a.sortOrder - b.sortOrder) })
  }
  return groups
})

async function loadList() {
  loading.value = true
  try {
    const res = await reminderThresholdApi.list()
    configs.value = res.data || []
  } finally {
    loading.value = false
  }
}

function openEdit(record) {
  editingRecord.value = record
  editForm.paramValue = record.paramValue
  modalVisible.value = true
}

async function handleSave() {
  if (editForm.paramValue == null) {
    message.warning('请填写数值')
    return
  }
  saving.value = true
  try {
    await reminderThresholdApi.update(editingRecord.value.id, editForm.paramValue)
    message.success('保存成功，下次跑批/手动更新提示内容时生效')
    modalVisible.value = false
    loadList()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadList)
</script>

<style scoped>
.category-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: #fafafa;
}
.category-header {
  margin-bottom: 12px;
}
.edit-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}
</style>
