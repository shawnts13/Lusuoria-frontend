<template>
  <a-modal :open="visible" title="批量标记为&quot;已收到客户回款&quot;" width="640px"
    :confirm-loading="submitting" :ok-button-props="{ disabled: !canConfirm }"
    @ok="handleConfirm" @cancel="close">
    <a-spin :spinning="loading">
      <!-- 命中范围里存在"客户方付款批次"为空的记录：整体拒绝，不渲染任何分组明细，
           防止财务筛选条件选错、误把不该动的记录也纳入范围（2026-08-21 新增，Shawn 明确要求） -->
      <a-alert v-if="preview?.hasEmptyPaymentBatch" type="error" show-icon
        message="当前页面存在&quot;客户方付款批次&quot;为空的记录，请重新确认筛选条件！"
        style="margin-bottom:16px" />
      <template v-else-if="preview">
        <div class="hint-box">
          本次将按当前列表页的筛选条件，把命中的全部 {{ preview.totalCount }} 条记录（不只是当前
          这一页）统一标记为"已收到客户回款"——已经是这个状态的记录也会一并纳入（可能只是想更新
          收到回款日期）。下方明细按"客户方付款批次号"分组；不涉及客户方付款批次的品牌方
          （"客户方付款批次号"展示为"不涉及"）改按"品牌方/团队"分组，请核对范围无误后再提交。
        </div>
        <a-table :columns="groupColumns" :data-source="preview.groups" :row-key="(r, i) => i"
          size="small" :pagination="false" style="margin-top:12px">
          <template #bodyCell="{ column, record }">
            <!-- brandTeamLabel 可能是多个"品牌方/团队"换行拼接（同一客户方付款批次涉及多个
                 品牌方/团队时），white-space:pre-line 让换行符真正生效 -->
            <template v-if="column.key === 'brandTeamLabel'">
              <div style="white-space:pre-line;color:#262626">{{ record.brandTeamLabel }}</div>
            </template>
            <template v-if="column.key === 'totalClientPrice'">{{ fmtNum(record.totalClientPrice) }}</template>
          </template>
          <template #summary>
            <a-table-summary-row>
              <a-table-summary-cell :col-span="2">汇总（共 {{ preview.groups.length }} 行）</a-table-summary-cell>
              <a-table-summary-cell>{{ preview.totalCount }}</a-table-summary-cell>
              <a-table-summary-cell>{{ fmtNum(preview.totalClientPrice) }}</a-table-summary-cell>
            </a-table-summary-row>
          </template>
        </a-table>
        <a-form layout="vertical" style="margin-top:16px">
          <a-form-item label="收到回款日期" required>
            <a-date-picker v-model:value="receivedDate" style="width:100%" value-format="YYYY-MM-DD" />
            <div style="font-size:12px;color:#595959;margin-top:2px">
              默认填当天，可以改成实际收到回款的日期，这次提交的日期会覆盖到上面全部命中记录
            </div>
          </a-form-item>
        </a-form>
      </template>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible: Boolean,
  // 当前列表页筛选条件（跟 CollaborationListPage.vue 的 filters 一一对应，已经做过多选筛选
  // 的空数组归一化），由父组件在打开弹窗那一刻现算好传进来，见 openMarkPaymentReceivedModal()
  filterPayload: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:visible', 'saved'])

const loading = ref(false)
const submitting = ref(false)
const preview = ref(null)
const receivedDate = ref(null)

// 2026-08-21 新增"品牌方/团队"列（Shawn 要求）：分组本身仍然是按"客户方付款批次号"（有
// 批次号的记录）或"品牌方/团队"（不涉及批次号的记录）两种口径二选一分的，见后端
// markClientPaymentReceivedPreview() 的说明；这一列只是把命中的品牌方/团队展示出来，
// 不改变分组粒度——同一个批次号下如果涉及多个品牌方/团队，这一列会换行列出多个
const groupColumns = [
  { title: '客户方付款批次号', dataIndex: 'clientPaymentBatch', key: 'clientPaymentBatch', width: 160 },
  { title: '品牌方/团队', dataIndex: 'brandTeamLabel', key: 'brandTeamLabel' },
  { title: '条数', dataIndex: 'count', key: 'count', width: 90 },
  { title: '客户合作总价格（$）', dataIndex: 'totalClientPrice', key: 'totalClientPrice', width: 160 }
]

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 只有预览成功、没有空批次号问题、且已经填了收到回款日期才允许点确定
const canConfirm = computed(() => !!preview.value && !preview.value.hasEmptyPaymentBatch && !!receivedDate.value)

async function loadPreview() {
  loading.value = true
  preview.value = null
  try {
    const res = await collaborationApi.markPaymentReceivedPreview(props.filterPayload)
    preview.value = res.data
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => {
  if (v) {
    receivedDate.value = formatDate(new Date())
    loadPreview()
  }
})

function close() { emit('update:visible', false) }

async function handleConfirm() {
  if (!canConfirm.value) return
  submitting.value = true
  try {
    const res = await collaborationApi.markPaymentReceivedConfirm({
      ...props.filterPayload,
      clientPaymentReceivedDate: receivedDate.value
    })
    message.success(`已标记 ${res.data} 条记录为"已收到客户回款"`)
    emit('saved')
    close()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.hint-box {
  font-size: 12px;
  color: #614700;
  line-height: 1.6;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  padding: 6px 10px;
}
</style>
