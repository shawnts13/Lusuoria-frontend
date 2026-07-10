<template>
  <a-modal
    :open="visible"
    :title="record ? '编辑结款记录' : '新建结款记录'"
    width="720px"
    :destroy-on-close="true"
    :confirm-loading="saving"
    @ok="handleSave"
    @cancel="emit('update:visible', false)"
  >
    <a-form ref="formRef" :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">

      <a-form-item label="品牌方" name="brandId"
        :rules="[{ required: true, message: '请选择品牌方' }]">
        <a-select v-model:value="form.brandId" show-search option-filter-prop="label"
          :disabled="!!form.id" @change="form.selectedItems = []">
          <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="红人团队" name="teamId">
        <a-select v-model:value="form.teamId" allow-clear show-search option-filter-prop="label"
          :disabled="!!form.id" @change="form.selectedItems = []">
          <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="对账日期（可选）" name="reconcileDate">
        <a-date-picker v-model:value="form.reconcileDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>

      <a-form-item label="结算月份" name="settlementMonth"
        :rules="[{ required: true, message: '请选择结算月份' }]">
        <a-date-picker
          v-model:value="form.settlementMonthVal"
          picker="month" format="YYYYMM" value-format="YYYYMM"
          style="width:100%" :disabled="!!form.id"
          @change="v => form.settlementMonth = v"
        />
      </a-form-item>

      <a-form-item label="涉及的红人视频项目">
        <a-button :disabled="!canOpenSelector" @click="openSelector">
          {{ selectorMode === 'view' ? '查看涉及的红人视频项目' : '选择涉及的红人视频项目' }}
        </a-button>
        <div style="font-size:12px;color:#999;margin-top:4px">
          已选 {{ form.selectedItems.length }} 条，合计 {{ fmtNum(form.payableAmount) }} 美元
        </div>
      </a-form-item>

      <a-form-item label="合作数量">
        <a-input-number :value="form.cooperationQuantity" style="width:100%" disabled />
      </a-form-item>

      <a-form-item label="应付金额">
        <a-input-number :value="form.payableAmount" style="width:100%" :precision="2" disabled />
      </a-form-item>

      <a-form-item label="币种">
        <a-input value="USD" disabled />
      </a-form-item>

      <a-form-item label="汇率" name="exchangeRate">
        <a-input-number v-model:value="form.exchangeRate" style="width:100%" :precision="4"
          :disabled="!form.id" @change="recomputeRmb" />
        <div v-if="form.id" style="font-size:12px;color:#faad14">
          管理层可强制修改汇率，请确认！（修改后人民币金额会重新计算）
        </div>
      </a-form-item>

      <a-form-item label="人民币金额">
        <a-input-number :value="form.rmbAmount" style="width:100%" :precision="2" disabled />
      </a-form-item>

      <a-form-item label="预计付款日" name="expectedPaymentDate">
        <a-date-picker v-model:value="form.expectedPaymentDate" value-format="YYYY-MM-DD" style="width:100%" />
        <div v-if="brandCycleHint" style="font-size:12px;color:#999;margin-top:4px">{{ brandCycleHint }}</div>
      </a-form-item>

      <template v-if="!form.id">
        <a-form-item label="付款状态" name="paymentStatus">
          <a-select v-model:value="form.paymentStatus">
            <a-select-option value="PENDING">待付款</a-select-option>
            <a-select-option value="PAID">已付款</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="实际付款日" name="actualPaymentDate"
          :validate-status="actualDateError ? 'error' : ''" :help="actualDateError">
          <a-date-picker v-model:value="form.actualPaymentDate" value-format="YYYY-MM-DD" style="width:100%" />
        </a-form-item>
      </template>
      <template v-else>
        <a-form-item label="付款状态">
          <a-tag :color="record.paymentStatus === 'PAID' ? 'green' : 'orange'">
            {{ record.paymentStatus === 'PAID' ? '已付款' : '待付款' }}
          </a-tag>
          <div style="font-size:12px;color:#ff4d4f">状态请使用"状态流转"功能修改</div>
        </a-form-item>
      </template>

      <a-form-item label="备注" name="notes">
        <a-textarea v-model:value="form.notes" :rows="3" />
      </a-form-item>
    </a-form>

    <PaymentItemSelectorModal
      v-model:visible="selectorVisible"
      :mode="selectorMode"
      :brand-id="form.brandId"
      :team-id="form.teamId"
      :reconcile-date="form.reconcileDate"
      :existing-payment-id="form.id"
      @confirm="handleSelectorConfirm"
    />
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { paymentApi, exchangeRateApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'
import PaymentItemSelectorModal from './PaymentItemSelectorModal.vue'

const props = defineProps({
  visible: Boolean,
  record:  Object,
  brands: { type: Array, default: () => [] },
  teams:  { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved'])

const formRef = ref()
const saving  = ref(false)
const selectorVisible = ref(false)

const form = reactive({
  id: null,
  brandId: null, teamId: null,
  reconcileDate: null,
  settlementMonth: null, settlementMonthVal: null,
  selectedItems: [],
  cooperationQuantity: null, payableAmount: null,
  exchangeRate: null, rmbAmount: null,
  expectedPaymentDate: null,
  paymentStatus: 'PENDING', actualPaymentDate: null,
  notes: ''
})

const record = computed(() => props.record)
const canOpenSelector = computed(() => !!form.brandId && !!form.settlementMonth)
// 编辑态且已付款：只能查看，不能再调整勾选；其余情况（新建 / 编辑态待付款）可选
const selectorMode = computed(() => (form.id && record.value?.paymentStatus === 'PAID') ? 'view' : 'select')

const brandCycleHint = computed(() => {
  const brand = props.brands.find(b => b.id === form.brandId)
  if (!brand || !brand.paymentCycleType) return ''
  if (brand.paymentCycleType === 'MONTH_END') {
    return brand.daysAfterMonthEnd != null ? `该品牌方为月结，对账日后${brand.daysAfterMonthEnd}天内结款` : ''
  }
  if (brand.paymentCycleType === 'COST_THRESHOLD') {
    if (brand.costThresholdAmount == null) return ''
    return `该品牌方按红人成本阈值分档结款：单笔≤${brand.costThresholdAmount}时${brand.daysWithinThreshold}天内结款，`
      + `超过时${brand.daysAboveThreshold}天内结款`
  }
  return ''
})

// 付款状态/实际付款日这两个字段只在"新建"表单里出现（编辑态用"状态流转"改），
// 编辑态时 form.paymentStatus/actualPaymentDate 只是从记录带过来的展示用残留值，
// 不应该参与这里的校验，否则编辑一条已付款的记录会被这条校验误挡住保存
const actualDateError = computed(() => {
  if (form.id) return ''
  if (form.paymentStatus === 'PENDING' && form.actualPaymentDate) {
    return '付款状态是：待付款，请勿选择"实际付款日"'
  }
  if (form.paymentStatus === 'PAID' && !form.actualPaymentDate) {
    return '付款状态是：已付款，请选择"实际付款日"'
  }
  return ''
})

function fmtNum(v) {
  if (v == null) return '0.00'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function openSelector() { selectorVisible.value = true }

async function handleSelectorConfirm(selected) {
  form.selectedItems = selected
  form.cooperationQuantity = selected.length
  form.payableAmount = selected.reduce((sum, r) => sum + (r.influencerCost != null ? +r.influencerCost : 0), 0)

  if (!form.id) {
    // 新建时汇率不接受手填，按结算月份自动取
    try {
      const res = await exchangeRateApi.getOne(form.settlementMonth)
      form.exchangeRate = res.data && !res.data.isMissing ? res.data.usdToCny : null
    } catch {
      form.exchangeRate = null
    }
  }
  recomputeRmb()
}

function recomputeRmb() {
  form.rmbAmount = (form.payableAmount != null && form.exchangeRate != null)
    ? Math.round(form.payableAmount * form.exchangeRate * 100) / 100
    : null
}

async function syncFromRecord(rec) {
  if (!rec) {
    Object.assign(form, {
      id:null, brandId:null, teamId:null, reconcileDate:null,
      settlementMonth:null, settlementMonthVal:null,
      selectedItems:[], cooperationQuantity:null, payableAmount:null,
      exchangeRate:null, rmbAmount:null, expectedPaymentDate:null,
      paymentStatus:'PENDING', actualPaymentDate:null, notes:''
    })
    return
  }
  Object.assign(form, {
    id: rec.id,
    brandId: rec.brandId || null,
    teamId:  rec.teamId  || null,
    reconcileDate: rec.reconcileDate ? formatDate(rec.reconcileDate) : null,
    settlementMonth: rec.settlementMonth, settlementMonthVal: rec.settlementMonth,
    cooperationQuantity: rec.cooperationQuantity, payableAmount: rec.payableAmount,
    exchangeRate: rec.exchangeRate, rmbAmount: rec.rmbAmount,
    expectedPaymentDate: rec.expectedPaymentDate ? formatDate(rec.expectedPaymentDate) : null,
    paymentStatus: rec.paymentStatus, actualPaymentDate: null,
    notes: rec.notes || ''
  })
  try {
    const res = await paymentApi.items(rec.id)
    form.selectedItems = res.data || []
  } catch {
    form.selectedItems = []
  }
}

watch(() => [props.visible, props.record], ([visible, rec]) => {
  if (!visible) return
  syncFromRecord(rec)
}, { immediate: true })

async function handleSave() {
  if (saving.value) return
  if (actualDateError.value) { message.error(actualDateError.value); return }
  try { await formRef.value.validate() } catch { return }
  if (!form.selectedItems.length) { message.error('请至少选择一条涉及的红人视频项目'); return }
  saving.value = true
  try {
    await paymentApi.save({
      id: form.id,
      brandId: form.brandId,
      teamId: form.teamId,
      reconcileDate: form.reconcileDate,
      settlementMonth: form.settlementMonth,
      collaborationTrackingIds: form.selectedItems.map(i => i.trackingId),
      exchangeRate: form.exchangeRate,
      expectedPaymentDate: form.expectedPaymentDate,
      notes: form.notes,
      paymentStatus: form.id ? undefined : form.paymentStatus,
      actualPaymentDate: form.id ? undefined : form.actualPaymentDate
    })
    message.success(form.id ? '更新成功' : '创建成功')
    emit('update:visible', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
