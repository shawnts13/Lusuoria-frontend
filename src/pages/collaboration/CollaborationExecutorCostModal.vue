<template>
  <a-modal :open="visible" title="内部执行成本" width="480px"
    :confirm-loading="saving" :ok-button-props="{ disabled: saveDisabled }"
    @ok="handleSave" @cancel="close">
    <div style="margin-bottom:12px; color:#262626; font-size:13px">
      {{ record?.internalProjectNo }}
    </div>

    <a-spin :spinning="loadingSuggestion">
      <a-form layout="vertical">
        <a-form-item label="内部执行人员" v-if="!record?.executorId">
          <a-select v-model:value="selectedExecutorId" allow-clear show-search
            :disabled="notApplicable"
            :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
            placeholder="选择内部执行人员">
            <a-select-option v-for="e in executorCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <div v-else style="margin-bottom:12px; color:#262626; font-size:13px">
          执行人员：{{ record.executorName || '—' }}
        </div>

        <!-- 2026-08 起内部执行成本完全由系统按"执行人员管理"配置的费率梯度自动算，
             不再提供手动填写的输入框——这里只读展示系统算出的金额和依据 -->
        <template v-if="!notApplicable">
          <div v-if="breakdown" :style="breakdownBoxStyle" v-html="highlightBreakdown(breakdown)"></div>
          <div v-if="!loadingSuggestion && effectiveExecutorId" style="margin-bottom:4px">
            <span style="font-size:13px;color:#595959">{{ alreadySet ? '目前已设置成：' : '系统算出的内部执行成本：' }}</span>
            <b :style="{ fontSize: '16px', color: blocked ? '#bbb' : '#262626' }">
              {{ blocked ? '—' : ('¥' + fmtAmount(suggestedAmount)) }}
            </b>
          </div>
          <div v-if="blocked" style="font-size:12px; color:#d4380d; margin-bottom:4px">
            {{ noRateConfigured ? '该执行人员还没有配置这个视频类型的费率梯度，配置好之前这条记录无法保存。'
               : outOfRange ? '当前费率梯度没有覆盖到这个条数，补充档位配置之前这条记录无法保存。' : '' }}
          </div>
          <div v-else-if="cappedAtZero" style="font-size:12px; color:#d4380d; margin-bottom:4px">
            已达到该视频类型当月的封顶金额，这一笔不再计费，金额正常保存为 ¥0.00。
          </div>
          <div v-else-if="rateBasedSuggestion" style="font-size:12px; color:#595959">
            以上是根据该执行人员在"员工管理"/"执行人员管理"维护的费率梯度自动算出的金额，如需特批一个不同的金额，
            请联系管理层通过"编辑"表单手动设置。
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

const suggestedAmount = ref(null)
const breakdown = ref('')
const rateBasedSuggestion = ref(false)
const alreadySet = ref(false)
const noRateConfigured = ref(false)
const outOfRange = ref(false)
const cappedAtZero = ref(false)
const saving = ref(false)
const loadingSuggestion = ref(false)
const selectedExecutorId = ref(null)
const notApplicable = ref(false)

// noRateConfigured/outOfRange：系统算不出金额，这条记录现在没法保存，跟"算出来是0"
// （cappedAtZero，正常业务结果，允许保存）是两回事，不能混为一谈
const blocked = computed(() => noRateConfigured.value || outOfRange.value)
const saveDisabled = computed(() => !notApplicable.value && (!effectiveExecutorId.value || blocked.value))

const breakdownBoxStyle = 'background:#f6f8fa; border-radius:4px; padding:10px 12px; margin-bottom:12px; font-size:13px; color:#262626; white-space:pre-line; line-height:1.6'

function fmtAmount(v) {
  if (v == null || v === '') return '—'
  return parseFloat(v).toFixed(2)
}

const effectiveExecutorId = computed(() => props.record?.executorId || selectedExecutorId.value)

async function loadSuggestion() {
  if (!effectiveExecutorId.value) {
    suggestedAmount.value = null
    breakdown.value = '请先选择内部执行人员，或选择"不涉及执行人员"'
    rateBasedSuggestion.value = false
    noRateConfigured.value = false
    outOfRange.value = false
    cappedAtZero.value = false
    return
  }
  loadingSuggestion.value = true
  try {
    const res = await collaborationApi.suggestExecutorCost(props.record.id, effectiveExecutorId.value)
    suggestedAmount.value = res.data.suggestedAmount
    breakdown.value = res.data.breakdown
    rateBasedSuggestion.value = !!res.data.rateBasedSuggestion
    alreadySet.value = !!res.data.alreadySet
    noRateConfigured.value = !!res.data.noRateConfigured
    outOfRange.value = !!res.data.outOfRange
    cappedAtZero.value = !!res.data.cappedAtZero
  } finally {
    loadingSuggestion.value = false
  }
}

watch(() => props.visible, v => {
  if (v && props.record) {
    suggestedAmount.value = null
    breakdown.value = ''
    rateBasedSuggestion.value = false
    alreadySet.value = false
    noRateConfigured.value = false
    outOfRange.value = false
    cappedAtZero.value = false
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
  if (!notApplicable.value && blocked.value) {
    message.warning('系统还算不出这笔内部执行成本，请先按上面的提示处理后再保存')
    return
  }
  saving.value = true
  try {
    // 2026-08 起金额不再由前端提交——服务端按费率梯度现场算，见后端 setExecutorCost() 注释
    const res = await collaborationApi.setExecutorCost(props.record.id, {
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
