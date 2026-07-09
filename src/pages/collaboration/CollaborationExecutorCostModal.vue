<template>
  <a-modal :open="visible" title="设置内部执行成本" width="480px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:12px; color:#666; font-size:13px">
      {{ record?.internalProjectNo }}　执行人员：{{ record?.executorName || '—' }}
    </div>

    <a-spin :spinning="loadingSuggestion">
      <div v-if="breakdown" style="background:#f6f8fa; border-radius:4px; padding:10px 12px; margin-bottom:16px; font-size:13px; color:#555">
        {{ breakdown }}
      </div>
      <a-form layout="vertical">
        <a-form-item label="内部执行成本（元）">
          <a-input-number v-model:value="amount" :min="0" :precision="2" style="width:100%" />
        </a-form-item>
      </a-form>
      <div v-if="rateBasedSuggestion" style="font-size:12px; color:#999">
        以上是根据该执行人员在员工管理里维护的费率档位自动算出的建议金额，可以手动修改后再保存。
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'

const props = defineProps({
  visible: Boolean,
  record: Object
})
const emit = defineEmits(['update:visible', 'saved'])

const amount = ref(null)
const breakdown = ref('')
const rateBasedSuggestion = ref(false)
const saving = ref(false)
const loadingSuggestion = ref(false)

watch(() => props.visible, async v => {
  if (v && props.record) {
    amount.value = null
    breakdown.value = ''
    rateBasedSuggestion.value = false
    loadingSuggestion.value = true
    try {
      const res = await collaborationApi.suggestExecutorCost(props.record.id)
      amount.value = res.data.suggestedAmount
      breakdown.value = res.data.breakdown
      rateBasedSuggestion.value = !!res.data.rateBasedSuggestion
    } finally {
      loadingSuggestion.value = false
    }
  }
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    await collaborationApi.setExecutorCost(props.record.id, amount.value)
    message.success('内部执行成本已保存')
    emit('saved')
    close()
  } finally { saving.value = false }
}
</script>
