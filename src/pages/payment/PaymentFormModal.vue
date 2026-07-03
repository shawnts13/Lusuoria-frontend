<template>
  <a-modal
    :open="visible"
    :title="record ? '编辑结款记录' : '新建结款记录'"
    width="680px"
    :destroy-on-close="true"
    :confirm-loading="saving"
    @ok="handleSave"
    @cancel="emit('update:visible', false)"
  >
    <a-form ref="formRef" :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">

      <a-form-item label="结算月份" name="settlementMonth"
        :rules="[{ required: true, message: '请选择结算月份' }]">
        <a-date-picker
          v-model:value="form.settlementMonthVal"
          picker="month" format="YYYYMM" value-format="YYYYMM"
          style="width:100%"
          @change="v => form.settlementMonth = v"
        />
      </a-form-item>

      <a-form-item label="红人" name="influencerId"
        :rules="[{ required: true, message: '请选择红人' }]">
        <a-select v-model:value="form.influencerId" show-search option-filter-prop="label">
          <a-select-option v-for="inf in influencers" :key="inf.id" :value="inf.id"
            :label="inf.accountName">
            {{ inf.teamNames ? `[${inf.teamNames.split(',')[0]}] ` : '' }}{{ inf.accountName }}
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="合作内容" name="cooperationContent">
        <a-input v-model:value="form.cooperationContent" />
      </a-form-item>

      <a-form-item label="合作数量" name="cooperationQuantity">
        <a-input-number v-model:value="form.cooperationQuantity" style="width:100%" :min="1" />
      </a-form-item>

      <a-form-item label="红人单价" name="influencerUnitPrice">
        <a-input-number v-model:value="form.influencerUnitPrice" style="width:100%" :precision="2" />
      </a-form-item>

      <a-form-item label="应付金额" name="payableAmount">
        <a-input-number v-model:value="form.payableAmount" style="width:100%" :precision="2" />
      </a-form-item>

      <a-form-item label="币种" name="currency">
        <a-select v-model:value="form.currency">
          <a-select-option value="RMB">RMB</a-select-option>
          <a-select-option value="USD">USD</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="汇率" name="exchangeRate">
        <a-input-number v-model:value="form.exchangeRate" style="width:100%" :precision="4" />
      </a-form-item>

      <a-form-item label="人民币金额" name="rmbAmount">
        <a-input-number v-model:value="form.rmbAmount" style="width:100%" :precision="2" />
      </a-form-item>

      <a-form-item label="对账日期" name="reconcileDate">
        <a-date-picker v-model:value="form.reconcileDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>

      <a-form-item label="预计付款日" name="expectedPaymentDate">
        <a-date-picker v-model:value="form.expectedPaymentDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>

      <a-form-item label="实际付款日" name="actualPaymentDate">
        <a-date-picker v-model:value="form.actualPaymentDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>

      <a-form-item label="付款状态" name="paymentStatus">
        <a-select v-model:value="form.paymentStatus" :disabled="!!form.id">
          <a-select-option value="PENDING_RECONCILE">待对账</a-select-option>
          <a-select-option value="RECONCILED">已对账</a-select-option>
          <a-select-option value="PENDING_PAYMENT">待付款</a-select-option>
          <a-select-option value="PARTIAL_PAYMENT">部分付款</a-select-option>
          <a-select-option value="PAID">已付款</a-select-option>
          <a-select-option value="ABNORMAL">异常</a-select-option>
        </a-select>
        <div v-if="form.id" style="font-size:12px;color:#ff4d4f">状态请使用"状态流转"功能修改</div>
      </a-form-item>

      <a-form-item label="已付金额" name="paidAmount">
        <a-input-number v-model:value="form.paidAmount" style="width:100%" :precision="2" />
      </a-form-item>

      <a-form-item label="备注" name="notes">
        <a-textarea v-model:value="form.notes" :rows="3" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { message } from 'ant-design-vue'
import { paymentApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible: Boolean,
  record:  Object,
  influencers: Array
})
const emit = defineEmits(['update:visible', 'saved'])

const formRef = ref()
const saving  = ref(false)

const form = reactive({
  id: null,
  settlementMonth: null, settlementMonthVal: null,
  influencerId: null,
  cooperationContent: '', cooperationQuantity: null,
  influencerUnitPrice: null, payableAmount: null,
  currency: 'RMB', exchangeRate: null, rmbAmount: null,
  reconcileDate: null, expectedPaymentDate: null, actualPaymentDate: null,
  paymentStatus: 'PENDING_RECONCILE', paidAmount: null, notes: ''
})

// 同时监听 visible 和 record：只监听 record 的话，连续两次都是"新建"（record 始终是 null，
// 值没变化）watch 不会重新触发，表单会残留上一次的内容。加上 visible 以后，
// 每次弹窗从关到开，都会强制重新同步一次表单。
watch(() => [props.visible, props.record], ([visible, rec]) => {
  if (!visible) return
  if (rec) {
    Object.assign(form, {
      id: rec.id,
      settlementMonth: rec.settlementMonth, settlementMonthVal: rec.settlementMonth,
      influencerId: rec.influencer?.id || null,
      cooperationContent: rec.cooperationContent || '',
      cooperationQuantity: rec.cooperationQuantity,
      influencerUnitPrice: rec.influencerUnitPrice, payableAmount: rec.payableAmount,
      currency: rec.currency || 'RMB', exchangeRate: rec.exchangeRate,
      rmbAmount: rec.rmbAmount,
      reconcileDate: rec.reconcileDate ? formatDate(rec.reconcileDate) : null,
      expectedPaymentDate: rec.expectedPaymentDate ? formatDate(rec.expectedPaymentDate) : null,
      actualPaymentDate:   rec.actualPaymentDate   ? formatDate(rec.actualPaymentDate)   : null,
      paymentStatus: rec.paymentStatus || 'PENDING_RECONCILE',
      paidAmount: rec.paidAmount, notes: rec.notes || ''
    })
  } else {
    Object.assign(form, {
      id:null, settlementMonth:null, settlementMonthVal:null, influencerId:null,
      cooperationContent:'', cooperationQuantity:null,
      influencerUnitPrice:null, payableAmount:null,
      currency:'RMB', exchangeRate:null, rmbAmount:null,
      reconcileDate:null, expectedPaymentDate:null, actualPaymentDate:null,
      paymentStatus:'PENDING_RECONCILE', paidAmount:null, notes:''
    })
  }
}, { immediate: true })

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await paymentApi.save({ ...form })
    message.success(form.id ? '更新成功' : '创建成功')
    emit('update:visible', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
