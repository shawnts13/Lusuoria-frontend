<template>
  <a-modal :open="visible" title="关联红人需求" width="640px" :footer="null" @cancel="close">
    <template v-if="step === 1">
      <p style="color:#595959;font-size:13px">选择该红人下"需求完成进度"还没满的需求：</p>
      <a-list :data-source="requirements" :loading="loadingStep1" bordered>
        <template #renderItem="{ item }">
          <a-list-item :class="{ 'req-row-selected': selectedRequirement?.id === item.id }"
            style="cursor:pointer" @click="selectedRequirement = item">
            <a-radio :checked="selectedRequirement?.id === item.id" />
            <div style="margin-left:8px;flex:1">
              <div>{{ item.internalRequirementNo }}</div>
              <div style="font-size:12px;color:#595959">
                需求月份 {{ item.requirementMonth }}，完成进度 {{ item.completedCount ?? 0 }}/{{ item.totalItemCount ?? 0 }}
              </div>
            </div>
          </a-list-item>
        </template>
        <template #renderEmpty><div style="text-align:center;color:#595959;padding:24px 0">该红人暂无未完成的需求</div></template>
      </a-list>
      <div style="margin-top:16px;text-align:right">
        <a-button type="primary" :disabled="!selectedRequirement" @click="goToStep2">下一步</a-button>
      </div>
    </template>

    <template v-else>
      <p style="color:#595959;font-size:13px">
        选择具体的"项目视频类型-合作平台"条目（已实施满的条目不能再选）：
      </p>
      <a-list :data-source="items" :loading="loadingStep2" bordered>
        <template #renderItem="{ item }">
          <a-list-item :class="{ 'req-row-selected': selectedItem?.id === item.id, 'req-row-disabled': isFull(item) }"
            :style="isFull(item) ? 'cursor:not-allowed;color:#bbb' : 'cursor:pointer'"
            @click="!isFull(item) && (selectedItem = item)">
            <a-radio :checked="selectedItem?.id === item.id" :disabled="isFull(item)" />
            <div style="margin-left:8px;flex:1">
              {{ item.videoTypeLabel }}-{{ (item.platform || '').split('\n').join('、') }}
              <span style="margin-left:8px;color:#595959;font-size:12px">
                已实施 {{ item.fulfilledCount ?? 0 }}/{{ item.videoCount ?? 0 }}
              </span>
            </div>
          </a-list-item>
        </template>
      </a-list>
      <div style="margin-top:16px;text-align:right">
        <a-button v-if="!presetRequirement" style="margin-right:8px" @click="step = 1">上一步</a-button>
        <a-button type="primary" :disabled="!selectedItem" @click="confirmSelection">确定</a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { requirementApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  influencerId: { type: [Number, String], default: null },
  // 从"红人需求管理"页面点击"新建合作跟踪"时传入：跳过第一步的需求列表，直接进入第二步
  // 选这条已经确定的需求下的子项
  presetRequirement: { type: Object, default: null }
})
const emit = defineEmits(['update:visible', 'confirm'])

const step = ref(1)
const loadingStep1 = ref(false)
const loadingStep2 = ref(false)
const requirements = ref([])
const items = ref([])
const selectedRequirement = ref(null)
const selectedItem = ref(null)

function isFull(item) {
  return (item.fulfilledCount ?? 0) >= (item.videoCount ?? 0)
}

async function loadRequirements() {
  loadingStep1.value = true
  try {
    const res = await requirementApi.byInfluencer(props.influencerId)
    requirements.value = res.data || []
  } finally {
    loadingStep1.value = false
  }
}

async function loadItems(requirementId) {
  step.value = 2
  selectedItem.value = null
  loadingStep2.value = true
  try {
    const res = await requirementApi.items(requirementId)
    items.value = res.data || []
  } finally {
    loadingStep2.value = false
  }
}

async function goToStep2() {
  if (!selectedRequirement.value) return
  await loadItems(selectedRequirement.value.id)
}

// 同时监听 visible 和 presetRequirement 两个来源，不要只看 visible 的 false→true 变化——
// 如果外层弹窗没有把 visible 正确复位成 false 就再次打开（比如上层调用方状态没清干净），
// 这里再次传入 true 时值没有变化，只监听 visible 会导致这个 watch 压根不重新触发，
// 停留在上一次残留的状态（可能是空列表）。同时监听 presetRequirement，只要这个引用变了
// （哪怕 visible 一直是 true）也会重新加载，更稳妥。
watch(() => [props.visible, props.presetRequirement], ([v]) => {
  if (!v) return
  selectedItem.value = null
  if (props.presetRequirement) {
    selectedRequirement.value = props.presetRequirement
    loadItems(props.presetRequirement.id)
  } else {
    step.value = 1
    selectedRequirement.value = null
    loadRequirements()
  }
})

function close() { emit('update:visible', false) }

function confirmSelection() {
  if (!selectedRequirement.value || !selectedItem.value) return
  emit('confirm', {
    internalRequirementNo: selectedRequirement.value.internalRequirementNo,
    influencerId: selectedRequirement.value.influencerId,
    brandId: selectedRequirement.value.brandId,
    teamId: selectedRequirement.value.teamId,
    countryMarket: selectedRequirement.value.countryMarket,
    platform: (selectedItem.value.platform || '').split('\n').filter(Boolean),
    videoType: selectedItem.value.videoType,
    influencerUnitCostPrice: selectedItem.value.influencerUnitCostPrice,
    clientUnitPrice: selectedItem.value.clientUnitPrice,
    defaultProjectManagerId: selectedRequirement.value.defaultProjectManagerId
  })
  close()
}
</script>

<style scoped>
.req-row-selected { background: #e6f4ff; }
.req-row-disabled { background: #fafafa; }
</style>
