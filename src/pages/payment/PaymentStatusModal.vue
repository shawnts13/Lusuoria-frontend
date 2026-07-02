<template>
  <a-modal :open="visible" title="状态流转" width="420px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:16px; color:#666; font-size:13px">
      {{ record?.paymentNo }}
    </div>
    <a-form layout="vertical">
      <a-form-item label="付款状态">
        <a-select v-model:value="paymentStatus">
          <a-select-option value="PENDING_RECONCILE">待对账</a-select-option>
          <a-select-option value="RECONCILED">已对账</a-select-option>
          <a-select-option value="PENDING_PAYMENT">待付款</a-select-option>
          <a-select-option value="PARTIAL_PAYMENT">部分付款</a-select-option>
          <a-select-option value="PAID">已付款</a-select-option>
          <a-select-option value="ABNORMAL">异常</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { paymentApi } from '../../api/index'

const props = defineProps({
  visible: Boolean,
  record: Object
})
const emit = defineEmits(['update:visible', 'saved'])

const paymentStatus = ref(null)
const saving = ref(false)

watch(() => props.visible, v => {
  if (v && props.record) paymentStatus.value = props.record.paymentStatus || null
})

function close() { emit('update:visible', false) }

async function handleSave() {
  saving.value = true
  try {
    await paymentApi.updateStatus(props.record.id, { paymentStatus: paymentStatus.value })
    message.success('状态已更新')
    emit('saved')
    close()
  } finally { saving.value = false }
}
</script>
