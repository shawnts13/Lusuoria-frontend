<template>
  <a-modal :open="visible" :title="`${employeeName || ''} - ${yearMonth} 工资单明细`"
    width="720px" :footer="null" @cancel="close">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-table v-if="detail.rows && detail.rows.length" :columns="columns" :data-source="detail.rows"
          :pagination="false" size="small" row-key="brandName"
          :row-class-name="(record) => record.isSummaryRow ? 'summary-row' : ''">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'brandTeam'">
              <template v-if="record.isSummaryRow">汇总</template>
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
            <span>{{ detail.type === 'MANAGEMENT' ? '公司利润' : '总工资' }}</span>
            <span>{{ fmt(detail.totalAmount) }}</span>
          </div>
        </div>

        <div class="footer-hint">
          {{ detail.confirmed ? '以上为已确认的工资单快照' : '以上为工资单预计（实时更新）' }}
        </div>
      </template>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { payslipApi } from '../../api/index'
import { colorForValue } from '../../utils/tagColor'

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
</script>

<style scoped>
.summary-lines {
  margin-top: 16px;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
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
</style>
