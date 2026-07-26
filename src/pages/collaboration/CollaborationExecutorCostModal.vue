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

      <a-button v-if="!preSave" type="link" style="padding-left:0" @click="notApplicable = !notApplicable">
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

/**
 * 2026-07 新增 preSave 模式：编辑表单里首次填视频链接触发自动流转、且该项目负责人还没给
 * 这个执行人员配置过费率梯度时，视频链接+状态+执行人员+执行成本要合并成一次性提交
 * （见 CollaborationFormModal.vue）——这种场景下这条记录在数据库里还是旧数据（链接/状态都
 * 还没改），不能调 suggestExecutorCost（会按旧的视频发布时间/进度算，还可能触发"该记录尚未
 * 填写视频发布时间"之类的报错），直接展示固定的"未配置费率"提示，不发起任何查询；
 * 也不提供"不涉及执行人员"选项——这个场景下执行人员是编辑表单里已经选好的，不涉及现场改选。
 * 确认时不直接调用 setExecutorCost，而是把金额通过 confirm-amount 事件交给父组件，
 * 由父组件把金额并入同一个保存请求一次性提交；取消/关闭/确认但没填金额，都不发起任何请求。
 */
const props = defineProps({
  visible: Boolean,
  record: Object,
  employees: { type: Array, default: () => [] },
  preSave: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved', 'confirm-amount'])

const executorCandidates = computed(() =>
  props.employees.filter(e => e.role === '执行人员'))

const amount = ref(null)
const breakdown = ref('')
const rateBasedSuggestion = ref(false)
const saving = ref(false)
const loadingSuggestion = ref(false)
const selectedExecutorId = ref(null)
const notApplicable = ref(false)

const NO_RATE_CONFIGURED_MESSAGE = '该项目负责人尚未在"执行人员管理"模块为其设置薪资信息，'
  + '请先进行设置后，再手动设置该视频条目的执行人员薪酬。'

const effectiveExecutorId = computed(() => props.record?.executorId || selectedExecutorId.value)

async function loadSuggestion() {
  if (props.preSave) {
    amount.value = null
    breakdown.value = NO_RATE_CONFIGURED_MESSAGE
    rateBasedSuggestion.value = false
    return
  }
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

  if (props.preSave) {
    if (amount.value == null) {
      message.warning('请填写内部执行成本金额，或点击右上角关闭放弃本次保存')
      return
    }
    emit('confirm-amount', amount.value)
    close()
    return
  }

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
