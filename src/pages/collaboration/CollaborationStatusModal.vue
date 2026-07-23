<template>
  <a-modal :open="visible" title="状态流转" width="460px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:16px; color:#666; font-size:13px">
      {{ record?.accountName }}
      <span v-if="record?.internalProjectNo">（{{ record.internalProjectNo }}）</span>
    </div>
    <div v-if="record?.hasPendingRollbackRequest"
      style="margin-bottom:12px;color:#faad14;font-size:13px">
      该记录当前已有一条待审核的"视频项目进度倒退"申请，等待管理员处理中。
    </div>
    <a-form layout="vertical">
      <a-form-item label="视频项目进度">
        <a-select v-model:value="progress" placeholder="选择视频项目进度">
          <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value"
            :disabled="FINANCE_ONLY_PROGRESS.includes(o.value) && !authStore.canSetFinanceSettlementProgress">
            {{ o.label }}
          </a-select-option>
        </a-select>
        <div v-if="!authStore.canSetFinanceSettlementProgress" style="font-size:12px;color:#888;margin-top:2px">
          "已加入客户未结算列表"/"客户已结算"仅能由财务/管理层设置
        </div>
      </a-form-item>
      <a-form-item label="红人结款进度">
        <a-select v-model:value="paymentProgress" placeholder="选择红人结款进度"
          allow-clear :disabled="!paymentProgressEnabled || isSystemManagedCurrent || willAutoSetPayment">
          <a-select-option v-for="o in getOptions('influencer_payment_progress')" :key="o.value" :value="o.value"
            :disabled="SYSTEM_MANAGED_PROGRESS.includes(o.value)">
            {{ o.label }}
          </a-select-option>
        </a-select>
        <div v-if="willAutoSetPayment" style="font-size:12px;color:#1677ff;margin-top:2px">
          首次进入"已发布（未结算）"，系统会自动判定红人结款进度为「{{ autoPaymentLabel }}」
        </div>
        <div v-else-if="!paymentProgressEnabled" style="font-size:12px;color:#888;margin-top:2px">
          仅当视频项目进度为"已发布（未结算）"、"已加入客户未结算列表"、"客户已结算"时才能设置
        </div>
        <div style="font-size:12px;color:#ff4d4f;margin-top:2px">
          "已纳入红人结款批次"/"已纳入红人结款批次（缺少invoice）"仅能由管理层通过"红人结款"功能设置，此处无法选中
        </div>
      </a-form-item>
      <div v-if="willAutoFillPublishDate" style="margin-bottom:12px;color:#1677ff;font-size:12px">
        该记录尚未填写"视频发布时间"，保存后系统将自动填上今天的日期
      </div>
      <a-form-item label="倒退原因" v-if="isRollback" required>
        <p style="color:#888;font-size:13px;margin-bottom:8px">
          该记录"红人结款进度"已有值，视频项目进度要改回不满足前置条件的状态，不会立即生效，
          需要提交管理员审核，请说明原因。
        </p>
        <a-textarea v-model:value="reason" :rows="3" placeholder="请说明原因" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { useAuthStore } from '../../store/auth'

const { getOptions } = useOptions()
const authStore = useAuthStore()

// 跟后端 requireFinanceForSettlementProgress() 保持一致：这两个状态只能由财务/管理层设置
const FINANCE_ONLY_PROGRESS = ['JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']

const props = defineProps({
  visible: Boolean,
  record: Object,
  brands: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved', 'need-executor-cost'])

// 跟后端 CollaborationProgress.allowsPaymentProgress() 保持一致
const QUALIFYING_PROGRESS = ['PUBLISHED_UNSETTLED', 'JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']
function qualifies(v) { return !!v && QUALIFYING_PROGRESS.includes(v) }

// "已纳入红人结款批次"这两个状态只能由红人结款模块内部设置：选项本身仍然展示出来（不隐藏），
// 但单独禁用这两项，不让用户选中；如果记录当前就是这两个状态之一，整个下拉框直接锁死
// （不能手动改离开），跟后端 InfluencerPaymentProgress.isSystemManagedOnly() 保持一致
const SYSTEM_MANAGED_PROGRESS = ['INCLUDED_IN_PAYMENT_BATCH', 'INCLUDED_IN_PAYMENT_BATCH_MISSING_INVOICE']

const progress = ref(null)
const paymentProgress = ref(null)
const reason = ref('')
const saving = ref(false)

// 弹窗打开那一刻的原始值，用来判断这次改动算不算"倒退"（不随下面 progress/paymentProgress 的
// 实时编辑而变化，保证即使中途改来改去，isRollback 判断的始终是"跟数据库原值相比"）
const original = reactive({ progress: null, paymentProgress: null })

// 这条记录数据库里现在就是"已纳入结款批次"状态：直接锁死展示，不给编辑入口
const isSystemManagedCurrent = computed(() => SYSTEM_MANAGED_PROGRESS.includes(original.paymentProgress))

watch(() => props.visible, v => {
  if (v && props.record) {
    progress.value = props.record.progress || null
    paymentProgress.value = props.record.influencerPaymentProgress || null
    reason.value = ''
    original.progress = props.record.progress || null
    original.paymentProgress = props.record.influencerPaymentProgress || null
  }
})

const paymentProgressEnabled = computed(() => qualifies(progress.value))

// 首次进入"已发布（未结算）"：后端会自动判定红人结款进度（按品牌方是否需要invoice），
// 不需要（也不应该）在这里让用户手动选，跟后端 enteringPublishedUnsettled 的条件保持一致
const willAutoSetPayment = computed(() =>
  progress.value === 'PUBLISHED_UNSETTLED' && original.progress !== 'PUBLISHED_UNSETTLED'
)
const autoPaymentLabel = computed(() => {
  const brand = props.brands?.find(b => b.id === props.record?.brandId)
  return brand && brand.requiresInvoice === false ? '待结款（不涉及invoice）' : '待红人发送invoice'
})

// 视频发布时间自动填写提示：跟后端 updateStatus() 的规则保持一致——首次从不满足前置条件
// 流转到满足前置条件的状态、且当前还没有视频发布时间时，系统才会自动填今天的日期
const willAutoFillPublishDate = computed(() =>
  qualifies(progress.value) && !qualifies(original.progress) && !props.record?.publishDate
)

// 视频项目进度改成不满足条件的状态时，红人结款进度选项跟着禁用，
// 界面上不应该继续显示一个"选中但禁用"的值造成误解，这里同步清空
watch(progress, () => {
  if (!paymentProgressEnabled.value) paymentProgress.value = null
})

// 倒退判定：数据库原值里红人结款进度已有值 + 原视频项目进度符合条件 +
// 这次要改成不符合条件的另一个状态，就是"倒退"，需要走审核
const isRollback = computed(() =>
  !!original.paymentProgress
  && qualifies(original.progress)
  && !!progress.value
  && !qualifies(progress.value)
  && progress.value !== original.progress
)

function close() { emit('update:visible', false) }

async function handleSave() {
  if (isRollback.value && !reason.value?.trim()) {
    message.warning('请填写倒退原因')
    return
  }
  saving.value = true
  try {
    const res = await collaborationApi.updateStatus(props.record.id, {
      progress: progress.value,
      influencerPaymentProgress: willAutoSetPayment.value ? null
        : (paymentProgressEnabled.value ? paymentProgress.value : null),
      reason: isRollback.value ? reason.value.trim() : null
    })
    if (res.data?.pendingApproval) {
      message.success('已提交审核，待管理员同意后生效')
    } else {
      message.success('状态已更新')
    }
    emit('saved')
    close()

    // 内部执行成本设置流程触发：后端已经判断过条件（视频项目进度达到前置条件，或红人结款进度
    // 被设置了值，且这条记录有执行人员、还没设置过内部执行成本），这里直接按标记弹出即可
    if (res.data?.needExecutorCost) {
      emit('need-executor-cost', props.record)
    }
  } finally { saving.value = false }
}
</script>
