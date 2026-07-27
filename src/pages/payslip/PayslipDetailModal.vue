<template>
  <a-modal :open="visible" :title="`${employeeName || ''} - ${yearMonth} 工资单明细`"
    width="720px" :footer="null" @cancel="close">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-table v-if="detail.rows && detail.rows.length" :columns="columns" :data-source="detail.rows"
          :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'projectManagerName'">
              <a-tag v-if="record.projectManagerName && !record.isSummaryRow" :color="colorForValue(record.projectManagerName)">
                {{ record.projectManagerName }}
              </a-tag>
            </template>
            <template v-if="column.key === 'brandTeam'">
              <template v-if="record.isSummaryRow">汇总</template>
              <template v-else-if="record.isGroupSubtotal">
                <b>{{ record.brandName }}</b>
                <a-tag v-if="detail.type === 'EXECUTOR'" style="margin-left:6px"
                  :color="record.groupConfirmed ? 'green' : 'orange'">
                  {{ record.groupConfirmed ? '已确认' : '预计' }}
                </a-tag>
              </template>
              <template v-else>
                <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
                <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
              </template>
            </template>
            <template v-if="column.key === 'videoTypeLabel'">{{ record.videoTypeLabel || '—' }}</template>
            <template v-if="column.key === 'videoCount'">{{ record.videoCount ?? 0 }}</template>
            <template v-if="column.key === 'amount'">{{ fmt(record.amount) }}</template>
            <template v-if="column.key === 'amount2'">{{ fmt(record.amount2) }}</template>
          </template>
        </a-table>

        <div class="summary-lines">
          <div v-if="detail.type === 'PROJECT_MANAGER'" class="line">
            <span>提成比例</span><span>{{ fmtRate(detail.commissionRate) }}</span>
          </div>
          <div v-if="detail.type === 'PROJECT_MANAGER' || detail.type === 'EXECUTOR'" class="line">
            <span>{{ detail.type === 'PROJECT_MANAGER' ? '提成金额' : '薪酬合计' }}</span>
            <span>{{ fmt(detail.baseAmount) }}</span>
          </div>

          <template v-if="detail.type === 'MANAGEMENT'">
            <div class="line"><span>项目毛利</span><span>{{ fmt(detail.grossProfit) }}</span></div>
            <div class="line"><span>可分配利润</span><span>{{ fmt(detail.distributableProfit) }}</span></div>
            <div class="line"><span>负责人提成合计（含Bonus）</span><span>{{ fmt(detail.managerCommissionTotal) }}</span></div>
            <div class="line"><span>内部执行人力成本</span><span>{{ fmt(detail.executorPayTotal) }}</span></div>
            <div class="line"><span>内部其他员工成本</span><span>{{ fmt(detail.otherStaffCost) }}</span></div>
          </template>

          <div v-if="detail.tierBonusAmount != null" class="line">
            <span>Bonus</span><span>{{ fmt(detail.tierBonusAmount) }}</span>
          </div>
          <div v-if="detail.extraBonusAmount != null" class="line">
            <span>奖金</span><span>{{ fmt(detail.extraBonusAmount) }}</span>
          </div>

          <div class="line total">
            <span>{{ totalLineLabel }}</span>
            <span>{{ fmt(detail.totalAmount) }}</span>
          </div>
        </div>

        <div v-if="detail.type === 'MANAGEMENT'" class="formula-box">
          <div class="formula-line">
            公司利润 = 项目毛利 − 内部执行人力成本 − 负责人提成合计（含Bonus） − 内部其他员工成本 − 奖金合计
          </div>
          <div class="formula-line formula-data">
            = {{ fmt(detail.grossProfit) }} − {{ fmt(detail.executorPayTotal) }}
            − {{ fmt(detail.managerCommissionTotal) }} − {{ fmt(detail.otherStaffCost) }}
            − {{ fmt(detail.extraBonusPayoutTotal) }}
            = <b>{{ fmt(detail.totalAmount) }}</b>
          </div>
        </div>

        <template v-if="detail.type === 'PROJECT_MANAGER'">
          <div class="section-title">
            <span>执行人员薪酬明细</span>
            <a-tag :color="detail.executorWageConfirmed ? 'green' : 'orange'" style="margin-left:8px">
              {{ detail.executorWageConfirmed ? '已确认' : '预计（实时更新）' }}
            </a-tag>
            <a-space v-if="canManageExecutorWages" class="section-actions">
              <a-button v-if="!detail.executorWageConfirmed" type="primary" size="small"
                @click="doConfirmExecutorWages">确认执行人员工资</a-button>
              <a-popconfirm v-else title="确认取消执行人员工资的确认？" @confirm="doUnconfirmExecutorWages">
                <a-button size="small">取消确认</a-button>
              </a-popconfirm>
            </a-space>
          </div>
          <a-table v-if="detail.executorWageRows && detail.executorWageRows.length"
            :columns="executorWageColumns" :data-source="detail.executorWageRows"
            :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'executorName'">
                <a-tag v-if="record.executorName && !record.isSummaryRow" :color="colorForValue(record.executorName)">
                  {{ record.executorName }}
                </a-tag>
              </template>
              <template v-if="column.key === 'brandTeam'">
                <template v-if="record.isSummaryRow">汇总</template>
                <template v-else-if="record.isGroupSubtotal"><b>{{ record.brandName }}</b></template>
                <template v-else>
                  <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
                  <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
                </template>
              </template>
              <template v-if="column.key === 'videoTypeLabel'">{{ record.videoTypeLabel || '—' }}</template>
              <template v-if="column.key === 'videoCount'">{{ record.videoCount ?? 0 }}</template>
              <template v-if="column.key === 'amount'">{{ fmt(record.amount) }}</template>
            </template>
          </a-table>
          <div class="summary-lines">
            <div class="line"><span>应发给执行人员的工资</span><span>{{ fmt(detail.executorWageTotal) }}</span></div>
            <div class="line total"><span>最终净得工资</span><span>{{ fmt(detail.finalNetWage) }}</span></div>
          </div>
        </template>

        <div class="footer-hint">{{ footerHint }}</div>
      </template>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { payslipApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { colorForValue } from '../../utils/tagColor'

const authStore = useAuthStore()

const props = defineProps({
  visible: { type: Boolean, default: false },
  employeeId: { type: [Number, String], default: null },
  employeeName: { type: String, default: '' },
  yearMonth: { type: String, default: '' },
  currency: { type: String, default: 'USD' }
})
const emit = defineEmits(['update:visible'])

const loading = ref(false)
const detail = ref(null)

const columns = computed(() => {
  if (!detail.value) return []
  if (detail.value.type === 'EXECUTOR') {
    return [
      { title: '所属项目负责人', key: 'projectManagerName', width: 130 },
      { title: '品牌方/红人团队', key: 'brandTeam' },
      { title: '项目视频类型', key: 'videoTypeLabel' },
      { title: '视频数', key: 'videoCount', width: 80 },
      { title: '薪酬金额', key: 'amount', width: 140 }
    ]
  }
  if (detail.value.type === 'MANAGEMENT') {
    return [
      { title: '品牌方/红人团队', key: 'brandTeam' },
      { title: '视频数', key: 'videoCount', width: 80 },
      { title: '客户合作价格', key: 'amount', width: 140 },
      { title: '红人成本', key: 'amount2', width: 140 }
    ]
  }
  // PROJECT_MANAGER
  return [
    { title: '品牌方/红人团队', key: 'brandTeam' },
    { title: '视频数', key: 'videoCount', width: 80 },
    { title: '客户合作价格', key: 'amount', width: 140 }
  ]
})

const executorWageColumns = [
  { title: '执行人员', key: 'executorName', width: 130 },
  { title: '品牌方/红人团队', key: 'brandTeam' },
  { title: '项目视频类型', key: 'videoTypeLabel' },
  { title: '视频数', key: 'videoCount', width: 80 },
  { title: '薪酬金额', key: 'amount', width: 140 }
]

const totalLineLabel = computed(() => {
  if (!detail.value) return '总工资'
  if (detail.value.type === 'MANAGEMENT') return '公司利润'
  if (detail.value.type === 'PROJECT_MANAGER') return '管理层所发工资'
  return '总工资'
})

const footerHint = computed(() => {
  if (!detail.value) return ''
  if (detail.value.type === 'PROJECT_MANAGER') {
    return detail.value.confirmed ? '以上"管理层所发工资"为已确认的工资单快照' : '以上"管理层所发工资"为预计（实时更新）'
  }
  return detail.value.confirmed ? '以上为已确认的工资单快照' : '以上为工资单预计（实时更新）'
})

// 只有项目负责人本人查看自己的工资单，才能确认/取消确认名下执行人员的工资
const canManageExecutorWages = computed(() =>
  detail.value?.type === 'PROJECT_MANAGER'
  && authStore.employeeId != null
  && String(authStore.employeeId) === String(props.employeeId))

function rowClassName(record) {
  if (record.isSummaryRow) return 'summary-row'
  if (record.isGroupSubtotal) return 'subtotal-row'
  return ''
}

function fmt(val) {
  if (val == null) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  const prefix = props.currency === 'RMB' ? '¥' : '$'
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtRate(rate) {
  if (rate == null) return '—'
  return (parseFloat(rate) * 100).toFixed(2) + '%'
}

async function load() {
  if (!props.employeeId || !props.yearMonth) return
  loading.value = true
  try {
    const res = await payslipApi.detail(props.employeeId, props.yearMonth, props.currency)
    detail.value = res.data || null
  } finally {
    loading.value = false
  }
}

watch(() => [props.visible, props.employeeId, props.yearMonth, props.currency], ([v]) => {
  if (v) load()
}, { immediate: true })

function close() { emit('update:visible', false) }

async function doConfirmExecutorWages() {
  try {
    await payslipApi.confirmExecutorWages(props.yearMonth)
    message.success('已确认')
    load()
  } catch (e) {
    message.error(e?.response?.data?.message || '确认失败')
  }
}
async function doUnconfirmExecutorWages() {
  try {
    await payslipApi.unconfirmExecutorWages(props.yearMonth)
    message.success('已取消确认')
    load()
  } catch (e) {
    message.error(e?.response?.data?.message || '取消确认失败')
  }
}
</script>

<style scoped>
.summary-lines {
  margin-top: 16px;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
.section-title {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.section-actions {
  margin-left: auto;
}
.line {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}
.line.total {
  font-weight: 700;
  font-size: 15px;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  padding-top: 8px;
}
.formula-box {
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}
.formula-line {
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}
.formula-line.formula-data {
  color: #333;
  font-family: 'Consolas', monospace;
}
.footer-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
  text-align: right;
}
:deep(.summary-row) {
  font-weight: 600;
  background: #fafafa;
}
:deep(.subtotal-row) {
  font-weight: 600;
  background: #f7f7f7;
}
</style>
