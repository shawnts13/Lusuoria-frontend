<template>
  <a-modal :open="visible" title="状态流转" width="420px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:16px; color:#666; font-size:13px">
      {{ record?.paymentNo }}
    </div>
    <a-form layout="vertical">
      <a-form-item label="付款状态">
        <a-select v-model:value="paymentStatus">
          <a-select-option value="PENDING">待付款</a-select-option>
          <a-select-option value="PAID">已付款</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item v-if="paymentStatus === 'PAID'" label="实际付款日">
        <a-date-picker v-model:value="actualPaymentDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import { paymentApi } from '../../api/index'

const props = defineProps({
  visible: Boolean,
  record: Object
})
const emit = defineEmits(['update:visible', 'saved'])

const paymentStatus = ref(null)
const actualPaymentDate = ref(null)
const saving = ref(false)

watch(() => props.visible, v => {
  if (v && props.record) {
    paymentStatus.value = props.record.paymentStatus || null
    actualPaymentDate.value = paymentStatus.value === 'PAID' ? dayjs().format('YYYY-MM-DD') : null
  }
})

function close() { emit('update:visible', false) }

function handleSave() {
  const isRollback = props.record?.paymentStatus === 'PAID' && paymentStatus.value === 'PENDING'
  if (isRollback) {
    Modal.confirm({
      title: '确认退回付款状态？',
      content: '确定要将付款状态从"已付款"退回"待付款"吗？退回后"实际付款日"将被清空。',
      okText: '确认',
      cancelText: '取消',
      onOk: doSave
    })
    return
  }
  doSave()
}

async function doSave() {
  if (paymentStatus.value === 'PAID' && !actualPaymentDate.value) {
    message.error('请选择实际付款日')
    return
  }
  saving.value = true
  try {
    await paymentApi.updateStatus(props.record.id, {
      paymentStatus: paymentStatus.value,
      actualPaymentDate: paymentStatus.value === 'PAID' ? actualPaymentDate.value : null
    })
    message.success('状态已更新')
    emit('saved')
    close()
  } finally { saving.value = false }
}
</script>
