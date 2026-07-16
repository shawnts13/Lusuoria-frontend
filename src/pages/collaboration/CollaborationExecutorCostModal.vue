<template>
  <a-modal :open="visible" title="设置内部执行成本" width="480px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:12px; color:#666; font-size:13px">
      {{ record?.internalProjectNo }}
    </div>

    <a-spin :spinning="loadingSuggestion">
      <a-form layout="vertical">
        <a-form-item label="内部执行人员" v-if="!record?.executorId">
          <a-select v-model:value="selectedExecutorId" allow-clear show-search
            :disabled="notApplicable"
            :filter-option="(input, opt) => opt.label.includes(input)"
            placeholder="选择内部执行人员">
            <a-select-option v-for="e in executorCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <div v-else style="margin-bottom:12px; color:#666; font-size:13px">
          执行人员：{{ record.executorName || '—' }}
        </div>

        <template v-if="!notApplicable">
          <div v-if="breakdown" style="background:#f6f8fa; border-radius:4px; padding:10px 12px; margin-bottom:16px; font-size:13px; color:#555">
            {{ breakdown }}
          </div>
          <a-form-item label="内部执行成本（元）">
            <a-input-number v-model:value="amount" :min="0" :precision="2" style="width:100%" />
          </a-form-item>
          <div v-if="rateBasedSuggestion" style="font-size:12px; color:#999">
            以上是根据该执行人员在员工管理里维护的费率档位自动算出的建议金额，可以手动修改后再保存。
          </div>
        </template>
      </a-form>

      <a-button type="link" style="padding-left:0" @click="notApplicable = !notApplicable">
        {{ notApplicable ? '取消勾选' : '不涉及执行人员（以后不再提醒）' }}
      </a-button>
      <div v-if="notApplicable" style="font-size:12px;color:#888">
        确认后这条记录以后不会再自动弹出这个提醒；如果后续确实需要安排执行人员，直接去"编辑"里手动设置即可。
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'

const props = defineProps({
  visible: Boolean,
  record: Object,
  employees: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved'])

const executorCandidates = computed(() =>
  props.employees.filter(e => e.role === '执行人员'))

const amount = ref(null)
const breakdown = ref('')
const rateBasedSuggestion = ref(false)
const saving = ref(false)
const loadingSuggestion = ref(false)
const selectedExecutorId = ref(null)
const notApplicable = ref(false)

const effectiveExecutorId = computed(() => props.record?.executorId || selectedExecutorId.value)

async function loadSuggestion() {
  if (!effectiveExecutorId.value) {
    amount.value = null
    breakdown.value = '请先选择内部执行人员，或选择"不涉及执行人员"'
    rateBasedSuggestion.value = false
    return
  }
  loadingSuggestion.value = true
  try {
    const res = await collaborationApi.suggestExecutorCost(props.record.id, effectiveExecutorId.value)
    amount.value = res.data.suggestedAmount
    breakdown.value = res.data.breakdown
    rateBasedSuggestion.value = !!res.data.rateBasedSuggestion
  } finally {
    loadingSuggestion.value = false
  }
}

watch(() => props.visible, v => {
  if (v && props.record) {
    amount.value = null
    breakdown.value = ''
    rateBasedSuggestion.value = false
    selectedExecutorId.value = null
    notApplicable.value = false
    loadSuggestion()
  }
})

watch(selectedExecutorId, () => {
  if (!notApplicable.value) loadSuggestion()
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (saving.value) return
  if (!notApplicable.value && !effectiveExecutorId.value) {
    message.warning('请先选择内部执行人员，或选择"不涉及执行人员"')
    return
  }
  saving.value = true
  try {
    await collaborationApi.setExecutorCost(props.record.id, {
      amount: notApplicable.value ? null : amount.value,
      executorId: notApplicable.value ? null : selectedExecutorId.value,
      notApplicable: notApplicable.value
    })
    message.success(notApplicable.value ? '已确认不涉及执行人员' : '内部执行成本已保存')
    emit('saved')
    close()
  } finally { saving.value = false }
}
</script>
