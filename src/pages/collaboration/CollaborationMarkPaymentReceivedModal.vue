<template>
  <a-modal :open="visible" title="批量标记为&quot;已收到客户回款&quot;"
    :width="preview?.hasEmptyPaymentBatch ? '1100px' : '640px'"
    :confirm-loading="submitting" :ok-button-props="{ disabled: !canConfirm }"
    @ok="handleConfirm" @cancel="close">
    <a-spin :spinning="loading">
      <!-- 命中范围里存在"该品牌方涉及客户方付款批次却没填"的记录：整体拒绝，不渲染分组明细，
           防止财务筛选条件选错、误把不该动的记录也纳入范围（2026-08-21 新增，Shawn 明确要求；
           2026-08-21 同日追加：把具体是哪些记录漏填了列出来，方便财务直接对照排查，不用回
           列表页自己一条条找） -->
      <template v-if="preview?.hasEmptyPaymentBatch">
        <a-alert type="error" show-icon
          message="当前页面存在&quot;客户方付款批次&quot;为空的记录，请重新确认筛选条件！"
          style="margin-bottom:12px" />
        <a-table :columns="missingBatchColumns" :data-source="preview.missingPaymentBatchRecords"
          :row-key="(r, i) => i" size="small" :pagination="false" :scroll="{ x: 1600 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'brandName'">
              <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
              <span v-else style="color:#bbb">—</span>
            </template>
            <template v-if="column.key === 'teamName'">
              <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
              <span v-else style="color:#bbb">—</span>
            </template>
            <template v-if="column.key === 'publishLink'">
              <div v-if="record.publishLink" style="white-space:pre-line;font-size:12px">{{ record.publishLink }}</div>
              <span v-else style="color:#bbb">—</span>
            </template>
            <template v-if="column.key === 'publishDate'">
              {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
            </template>
            <template v-if="column.key === 'clientPrice'">
              {{ record.clientPrice != null ? fmtNum(record.clientPrice) : '—' }}
            </template>
          </template>
        </a-table>
      </template>
      <template v-else-if="preview">
        <div class="hint-box">
          本次将按当前列表页的筛选条件，把命中的全部 {{ preview.totalCount }} 条记录统一标记为
          "已收到客户回款"——已经是这个状态的记录也会一并纳入（用于"可能只想更新收到回款日期"
          这种情况）。下方明细按"客户方付款批次号"分组；同时包含不涉及客户方付款批次的品牌方，
          请核对范围无误后再提交。
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
import { colorForValue } from '../../utils/tagColor'

// "客户方付款批次为空"报错时的问题记录明细列（2026-08-21 新增，Shawn 要求；同日追加"客户方的
// 项目订单"，放在"客户合作价格（$）"后面）：内部需求编号/内部项目编号/品牌方/红人团队/红人
// 社媒完整名字/需求内容/视频发布链接/视频发布时间/客户合作价格/客户方的项目订单，供财务对照
// 排查是哪条记录漏填了，不用回列表页自己一条条找
const missingBatchColumns = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',       dataIndex: 'brandName',           key: 'brandName',           width: 110 },
  { title: '红人团队',     dataIndex: 'teamName',             key: 'teamName',             width: 130 },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',         width: 150,
    customRender: ({ text }) => text || '—' },
  { title: '需求内容',     dataIndex: 'demandContent',        key: 'demandContent',        width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '视频发布链接', dataIndex: 'publishLink',          key: 'publishLink',          width: 220 },
  { title: '视频发布时间', dataIndex: 'publishDate',          key: 'publishDate',          width: 110 },
  { title: '客户合作价格（$）', dataIndex: 'clientPrice',     key: 'clientPrice',          width: 150 },
  { title: '客户方的项目订单', dataIndex: 'clientOrderId',    key: 'clientOrderId',        width: 160,
    customRender: ({ text }) => text || '—' }
]

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
