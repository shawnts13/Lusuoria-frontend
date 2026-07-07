<template>
  <a-modal :open="visible" title="状态流转" width="420px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:16px; color:#666; font-size:13px">
      {{ record?.internalProjectNo }}
    </div>
    <a-form layout="vertical">
      <a-form-item label="甲方状态">
        <a-select v-model:value="clientStatus">
          <a-select-option v-for="s in clientStatuses" :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="内部状态">
        <a-select v-model:value="internalStatus">
          <a-select-option v-for="s in availableInternalStatuses" :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { projectApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'

const authStore = useAuthStore()

const props = defineProps({
  visible: Boolean,
  record: Object
})
const emit = defineEmits(['update:visible', 'saved', 'need-executor-cost'])

const clientStatus = ref(null)
const internalStatus = ref(null)
const saving = ref(false)

const clientStatuses = [
  { value: 'PENDING_SUBMIT',    label: '待提交' },
  { value: 'SUBMITTED',         label: '已提交' },
  { value: 'CLIENT_CONFIRMED',  label: '甲方已确认' },
  { value: 'CLIENT_RECONCILED', label: '甲方已对账' },
  { value: 'CONTRACT_SIGNED',   label: '合同已签署' },
  { value: 'PENDING_PAYMENT',   label: '待到账' },
  { value: 'PARTIAL_PAYMENT',   label: '部分到账' },
  { value: 'PAID',              label: '已到账' },
  { value: 'ABNORMAL',          label: '异常' }
]

const allInternalStatuses = [
  { value: 'PENDING_CALC',     label: '待核算',    adminOnly: false },
  { value: 'CALCULATED',       label: '已核算',    adminOnly: false },
  { value: 'PENDING_APPROVAL', label: '待老板审核', adminOnly: false },
  { value: 'CONFIRMED',        label: '已确认',    adminOnly: true  },
  { value: 'IN_PAYROLL',       label: '已进入工资', adminOnly: true  },
  { value: 'ARCHIVED',         label: '已归档',    adminOnly: true  }
]

// 跟编辑表单保持一致：非 ADMIN 看不到 adminOnly 的状态选项
const availableInternalStatuses = computed(() =>
  allInternalStatuses.filter(s => !s.adminOnly || authStore.canApprove)
)

watch(() => props.visible, v => {
  if (v && props.record) {
    clientStatus.value   = props.record.clientStatus   || null
    internalStatus.value = props.record.internalStatus || null
  }
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    const res = await projectApi.updateStatus(props.record.id, {
      clientStatus: clientStatus.value,
      internalStatus: internalStatus.value
    })
    message.success('状态已更新')
    emit('saved')
    close()

    // 甲方状态流转成"待提交"以外的状态，或者内部状态流转成"待核算"以外的状态时，
    // 如果这个订单有执行人员、且还没设置过内部执行成本，弹出设置弹窗；
    // 已经设置过的不会再弹（那种情况改去列表里直接编辑内部执行成本）
    const order = res.data
    const triggered = (order.clientStatus !== 'PENDING_SUBMIT' || order.internalStatus !== 'PENDING_CALC')
    if (triggered && order.executorId && (order.internalExecutionCost === null || order.internalExecutionCost === undefined)) {
      emit('need-executor-cost', order)
    }
  } finally { saving.value = false }
}
</script>
