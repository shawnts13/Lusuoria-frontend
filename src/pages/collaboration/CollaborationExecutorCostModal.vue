<template>
  <a-modal :open="visible" title="设置内部执行成本" width="480px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:12px; color:#262626; font-size:13px">
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
        <div v-else style="margin-bottom:12px; color:#262626; font-size:13px">
          执行人员：{{ record.executorName || '—' }}
        </div>

        <template v-if="!notApplicable">
          <div v-if="breakdown" style="background:#f6f8fa; border-radius:4px; padding:10px 12px; margin-bottom:16px; font-size:13px; color:#262626; white-space:pre-line; line-height:1.6"
            v-html="highlightBreakdown(breakdown)"></div>
          <a-form-item label="内部执行成本（元）">
            <a-input-number v-model:value="amount" :min="0" :precision="2" style="width:100%" />
          </a-form-item>
          <!-- 已保存金额 vs 文本框里目前计划设置的金额，两者分开展示，改了之后一眼能看出差异
               （Shawn 反馈：之前只在说明文字里提过一次已保存金额，改了文本框之后就分不清哪个是
               原值、哪个是准备保存的新值了） -->
          <div v-if="alreadySet" style="font-size:12px; color:#262626; margin-bottom:4px">
            之前已设置：<b>¥{{ fmtAmount(savedAmount) }}</b>
            <template v-if="amountChanged">
              <span style="color:#8c8c8c"> → </span>
              <b style="color:#d4380d">¥{{ fmtAmount(amount) }}</b>
              <span style="color:#d4380d">（保存后会覆盖为这个新值）</span>
            </template>
            <span v-else style="color:#595959">（如需调整可以直接修改后再保存）</span>
          </div>
          <div v-else-if="rateBasedSuggestion" style="font-size:12px; color:#595959">
            以上是根据该执行人员在员工管理里维护的费率档位自动算出的建议金额，可以手动修改后再保存。
          </div>
        </template>
      </a-form>

      <a-button type="link" style="padding-left:0" @click="notApplicable = !notApplicable">
        {{ notApplicable ? '取消勾选' : '不涉及执行人员（以后不再提醒）' }}
      </a-button>
      <div v-if="notApplicable" style="font-size:12px;color:#595959">
        确认后这条记录以后不会再自动弹出这个提醒；如果后续确实需要安排执行人员，直接去"编辑"里手动设置即可。
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'
import { highlightAmounts } from '../../utils/textHighlight'

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
const alreadySet = ref(false)
// 已保存金额的快照，跟 amount 分开存——amount 会随用户编辑文本框实时变化，savedAmount 保持
// 不变，用来跟 amount 对比展示"之前已设置" vs "目前计划设置"这两个值的差异
const savedAmount = ref(null)
const saving = ref(false)
const loadingSuggestion = ref(false)
const selectedExecutorId = ref(null)
const notApplicable = ref(false)

const amountChanged = computed(() =>
  alreadySet.value && savedAmount.value != null
  && Number(amount.value) !== Number(savedAmount.value))

function fmtAmount(v) {
  if (v == null || v === '') return '—'
  return parseFloat(v).toFixed(2)
}

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
    alreadySet.value = !!res.data.alreadySet
    // alreadySet 时后端返回的 suggestedAmount 就是当前已保存的金额，存一份快照，
    // 不随用户后续编辑 amount 变化
    savedAmount.value = alreadySet.value ? res.data.suggestedAmount : null
  } finally {
    loadingSuggestion.value = false
  }
}

watch(() => props.visible, v => {
  if (v && props.record) {
    amount.value = null
    breakdown.value = ''
    rateBasedSuggestion.value = false
    alreadySet.value = false
    savedAmount.value = null
    selectedExecutorId.value = null
    notApplicable.value = false
    loadSuggestion()
  }
})

watch(selectedExecutorId, () => {
  if (!notApplicable.value) loadSuggestion()
})

// 建议金额说明是纯文本拼出来的自然语言，不是结构化字段，用正则给月份/笔数/金额这几个
// 用户最关心的数字上色，方便一眼扫到关键信息——这套通用的"金额/计数高亮"规则抽到了
// utils/textHighlight.js（highlightAmounts），"员工管理"薪资信息列也复用同一份，
// 不要在这里重新写一份容易跟那边风格走偏
const highlightBreakdown = highlightAmounts

function close() { emit('update:visible', false) }

async function handleSave() {
  if (saving.value) return

  if (!notApplicable.value && !effectiveExecutorId.value) {
    message.warning('请先选择内部执行人员，或选择"不涉及执行人员"')
    return
  }
  saving.value = true
  try {
    const res = await collaborationApi.setExecutorCost(props.record.id, {
      amount: notApplicable.value ? null : amount.value,
      executorId: notApplicable.value ? null : selectedExecutorId.value,
      notApplicable: notApplicable.value
    })
    if (res.data?.pendingApproval) {
      message.success('该记录已设置过一次内部执行成本，这次修改已提交给项目负责人审核，同意后才会生效')
    } else {
      message.success(notApplicable.value ? '已确认不涉及执行人员' : '内部执行成本已保存')
    }
    emit('saved')
    close()
  } finally { saving.value = false }
}
</script>
