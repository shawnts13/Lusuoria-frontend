<template>
  <a-modal :open="visible" title="存量记录关联需求" width="820px" :footer="null" @cancel="close">
    <a-steps :current="step - 1" size="small" style="margin-bottom:20px">
      <a-step title="选择红人" />
      <a-step title="选择内部需求编号" />
      <a-step title="选择红人合作跟踪记录" />
    </a-steps>

    <template v-if="step === 1">
      <a-form layout="vertical">
        <a-form-item label="红人社媒完整名字">
          <a-select v-model:value="influencerId" allow-clear show-search
            :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
            placeholder="从红人库选择" @change="onInfluencerChange">
            <a-select-option v-for="inf in influencers" :key="inf.id" :value="inf.id" :label="inf.accountName">
              {{ inf.accountName }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
      <div style="text-align:right">
        <a-button type="primary" :disabled="!influencerId" @click="goToStep2">下一步</a-button>
      </div>
    </template>

    <template v-else-if="step === 2">
      <a-list :data-source="requirements" :loading="loadingStep2" bordered>
        <template #renderItem="{ item }">
          <a-list-item :class="{ 'req-row-selected': selectedRequirement?.id === item.id }"
            style="cursor:pointer;display:block" @click="selectRequirement(item)">
            <div style="display:flex;align-items:center">
              <a-radio :checked="selectedRequirement?.id === item.id" />
              <div style="margin-left:8px;flex:1">
                <div>{{ item.internalRequirementNo }}</div>
                <div style="font-size:12px;color:#888">
                  需求月份 {{ item.requirementMonth }}，完成进度 {{ item.completedCount ?? 0 }}/{{ item.totalItemCount ?? 0 }}
                </div>
              </div>
            </div>
            <div v-if="selectedRequirement?.id === item.id" style="margin-top:10px;padding-left:24px">
              <div style="font-size:12px;color:#888;margin-bottom:4px">完整需求内容：</div>
              <div style="white-space:pre-wrap;font-size:12px;background:#f8faff;border-radius:4px;padding:8px;max-height:120px;overflow-y:auto">
                {{ item.fullRequirementContent || '（空）' }}
              </div>
              <div style="font-size:12px;color:#888;margin:8px 0 4px">涉及的红人需求条目：</div>
              <a-table :columns="itemColumns" :data-source="selectedItems" :pagination="false" size="small" row-key="id" :loading="loadingItems" />
            </div>
          </a-list-item>
        </template>
        <template #renderEmpty><div style="text-align:center;color:#bbb;padding:24px 0">该红人暂无未完成的需求</div></template>
      </a-list>
      <div style="margin-top:16px;text-align:right">
        <a-button style="margin-right:8px" @click="step = 1">上一步</a-button>
        <a-button type="primary" :disabled="!selectedRequirement" @click="goToStep3">下一步</a-button>
      </div>
    </template>

    <template v-else>
      <a-table :columns="candidateColumns" :data-source="candidates" :loading="loadingStep3" size="small"
        row-key="trackingId" :pagination="false"
        :row-selection="{ selectedRowKeys: selectedTrackingIds, onChange: keys => selectedTrackingIds = keys }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'platform'">{{ (record.platform || '').split('\n').join('、') }}</template>
          <template v-if="column.key === 'publishDate'">{{ record.publishDate ? formatDate(record.publishDate) : '—' }}</template>
        </template>
      </a-table>
      <div v-if="!loadingStep3 && candidates.length === 0" style="text-align:center;color:#bbb;padding:24px 0">
        没有找到匹配的红人合作跟踪记录
      </div>
      <div style="font-size:12px;color:#c00000;margin-top:8px">
        没有内部需求编号？请先在"1.红人需求管理"模块里新增对应红人的需求
      </div>
      <div style="margin-top:16px;text-align:right">
        <a-button style="margin-right:8px" @click="step = 2">上一步</a-button>
        <a-button type="primary" :loading="confirming" :disabled="selectedTrackingIds.length === 0" @click="handleConfirm">
          确定关联（已选 {{ selectedTrackingIds.length }} 条）
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { requirementApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible: { type: Boolean, default: false },
  influencers: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'linked'])

const step = ref(1)
const influencerId = ref(null)
const requirements = ref([])
const loadingStep2 = ref(false)
const selectedRequirement = ref(null)
const selectedItems = ref([])
const loadingItems = ref(false)
const candidates = ref([])
const loadingStep3 = ref(false)
const selectedTrackingIds = ref([])
const confirming = ref(false)

const itemColumns = [
  { title: '项目视频类型', dataIndex: 'videoTypeLabel', key: 'videoTypeLabel', width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '合作平台', key: 'platform', width: 140,
    customRender: ({ record }) => (record.platform || '').split('\n').join('、') || '—' },
  { title: '项目视频数目', dataIndex: 'videoCount', key: 'videoCount', width: 90 },
  { title: '已实施/总数', key: 'fulfilled', width: 90,
    customRender: ({ record }) => `${record.fulfilledCount ?? 0}/${record.videoCount ?? 0}` }
]

const candidateColumns = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 180 },
  { title: '项目视频类型', dataIndex: 'videoTypeLabel', key: 'videoTypeLabel', width: 110 },
  { title: '合作平台', key: 'platform', width: 140 },
  { title: '红人视频制作与发布成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 170 },
  { title: '客户合作价格（$）', dataIndex: 'clientPrice', key: 'clientPrice', width: 140 },
  { title: '视频发布时间', key: 'publishDate', width: 110 },
  { title: '需求内容', dataIndex: 'demandContent', key: 'demandContent', width: 160, ellipsis: true }
]

function onInfluencerChange() {
  selectedRequirement.value = null
}

async function goToStep2() {
  step.value = 2
  selectedRequirement.value = null
  loadingStep2.value = true
  try {
    const res = await requirementApi.byInfluencer(influencerId.value)
    requirements.value = res.data || []
  } finally {
    loadingStep2.value = false
  }
}

async function selectRequirement(item) {
  selectedRequirement.value = item
  loadingItems.value = true
  try {
    const res = await requirementApi.items(item.id)
    selectedItems.value = res.data || []
  } finally {
    loadingItems.value = false
  }
}

async function goToStep3() {
  if (!selectedRequirement.value) return
  step.value = 3
  selectedTrackingIds.value = []
  loadingStep3.value = true
  try {
    const res = await requirementApi.legacyCandidates(influencerId.value, selectedRequirement.value.internalRequirementNo)
    candidates.value = res.data || []
  } finally {
    loadingStep3.value = false
  }
}

watch(() => props.visible, v => {
  if (v) {
    step.value = 1
    influencerId.value = null
    selectedRequirement.value = null
    selectedTrackingIds.value = []
  }
})

function close() { emit('update:visible', false) }

async function handleConfirm() {
  if (confirming.value) return
  confirming.value = true
  try {
    await requirementApi.linkLegacy(selectedRequirement.value.internalRequirementNo, selectedTrackingIds.value)
    message.success(`已成功关联 ${selectedTrackingIds.value.length} 条红人合作跟踪记录`)
    emit('linked')
    close()
  } catch (e) {
    message.error(e?.response?.data?.message || '关联失败，请检查选择的记录是否超出需求条目剩余名额')
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped>
.req-row-selected { background: #e6f4ff; }
</style>
