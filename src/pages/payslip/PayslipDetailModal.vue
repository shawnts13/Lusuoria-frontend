<template>
  <a-modal :open="visible" :title="`${employeeName || ''} - ${yearMonth} 工资单明细`"
    width="720px" :footer="null" @cancel="close">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-table v-if="detail.rows && detail.rows.length" :columns="columns" :data-source="detail.rows"
          :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'projectManagerName'">
              <a-tag v-if="record.projectManagerName && !record.isSummaryRow && !record.isTierSummaryRow"
                :color="colorForValue(record.projectManagerName)">
                {{ record.projectManagerName }}
              </a-tag>
            </template>
            <template v-if="column.key === 'brandTeam'">
              <span v-if="record.isTierSummaryRow" style="color:#874d00;font-weight:600">{{ record.brandName }}</span>
              <template v-else-if="record.isSummaryRow">汇总</template>
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
            <template v-if="column.key === 'videoTypeLabel'">{{ record.isTierSummaryRow ? '' : (record.videoTypeLabel || '—') }}</template>
            <template v-if="column.key === 'videoCount'">{{ record.isTierSummaryRow ? '' : (record.videoCount ?? 0) }}</template>
            <template v-if="column.key === 'unitPrice'">
              {{ (record.isTierSummaryRow || record.isSummaryRow || record.isGroupSubtotal) ? '' : fmt(record.unitPrice) }}
            </template>
            <template v-if="column.key === 'amount'">{{ record.isTierSummaryRow ? '' : fmt(record.amount) }}</template>
            <template v-if="column.key === 'amount2'">{{ record.isTierSummaryRow ? '' : fmt(record.amount2) }}</template>
            <template v-if="column.key === 'profit'">{{ record.isTierSummaryRow ? '' : fmt(record.profit) }}</template>
          </template>
        </a-table>

        <div class="summary-lines">
          <div v-if="detail.type === 'PROJECT_MANAGER'" class="line">
            <span>提成比例</span><span>{{ fmtRate(detail.commissionRate) }}</span>
          </div>
          <div v-if="detail.type === 'PROJECT_MANAGER'" class="hint-line">
            提成金额是按每条记录分别计算再加总的（不是"利润汇总行 × 提成比例"一次性算出来的），
            加上每条金额四舍五入，加总后跟"利润汇总 × 提成比例"的结果会有小额差异，属正常现象
            （不扣内部执行成本——那部分是您自己发给执行人员的）
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
            <div class="hint-line">
              下方三块明细分别拆解了"负责人提成合计（含Bonus）"、"内部执行人力成本"、
              "内部其他员工成本"这三个汇总数字的构成，方便核对——由于明细行是分开取整后再加总的，
              跟汇总数字直接相加相比可能有几分钱的四舍五入误差，属正常现象
            </div>
          </template>

          <div v-if="detail.tierBonusRate != null" class="line">
            <span>Bonus比例</span><span>{{ fmtRate(detail.tierBonusRate) }}</span>
          </div>
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
          <div class="formula-title">
            公司利润 = 项目毛利 − 内部执行人力成本 − 负责人提成合计（含Bonus） − 内部其他员工成本 − 奖金合计
          </div>
          <div class="formula-row">
            <div class="formula-term">
              <div class="formula-label">项目毛利</div>
              <div class="formula-value">{{ fmt(detail.grossProfit) }}</div>
            </div>
            <div class="formula-op">−</div>
            <div class="formula-term">
              <div class="formula-label">内部执行人力成本</div>
              <div class="formula-value">{{ fmt(detail.executorPayTotal) }}</div>
            </div>
            <div class="formula-op">−</div>
            <div class="formula-term">
              <div class="formula-label">负责人提成合计（含Bonus）</div>
              <div class="formula-value">{{ fmt(detail.managerCommissionTotal) }}</div>
            </div>
            <div class="formula-op">−</div>
            <div class="formula-term">
              <div class="formula-label">内部其他员工成本</div>
              <div class="formula-value">{{ fmt(detail.otherStaffCost) }}</div>
            </div>
            <div class="formula-op">−</div>
            <div class="formula-term">
              <div class="formula-label">奖金合计</div>
              <div class="formula-value">{{ fmt(detail.extraBonusPayoutTotal) }}</div>
            </div>
            <div class="formula-op">=</div>
            <div class="formula-term formula-total">
              <div class="formula-label">公司利润</div>
              <div class="formula-value">{{ fmt(detail.totalAmount) }}</div>
            </div>
          </div>
        </div>

        <!-- 这个项目负责人当月压根没有涉及执行人员的记录时，整段执行人员相关内容都不展示，
             不能让"执行人员工资预计"这类字眼出现在跟执行人员完全无关的项目负责人工资单里。
             管理层这边（2026-08-10 新增展示）同一份数据的含义是"内部执行人力成本"的构成明细，
             不是"发给谁多少工资"，标题/底部说明按类型区分开，避免管理层看到"最终净得工资"
             这种项目负责人视角才有意义的字眼 -->
        <template v-if="(detail.type === 'PROJECT_MANAGER' || detail.type === 'MANAGEMENT') && detail.executorWageRows && detail.executorWageRows.length">
          <div class="section-title">
            <span>{{ detail.type === 'MANAGEMENT' ? '内部执行人力成本明细' : '执行人员薪酬明细' }}</span>
            <a-tag :color="detail.executorWageConfirmed ? 'green' : 'orange'" style="margin-left:8px">
              {{ detail.executorWageConfirmed ? '已确认' : '预计（实时更新）' }}
            </a-tag>
            <!-- 确认/取消确认这个动作 2026-07 起挪到"工资单"主页面的"手下执行人员工资"区块直接操作，
                 跟管理层工资单的样式保持一致，这里只做只读展示，不再放确认按钮 -->
          </div>
          <a-table :columns="executorWageColumns" :data-source="detail.executorWageRows"
            :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'executorName'">
                <a-tag v-if="record.executorName && !record.isSummaryRow && !record.isTierSummaryRow" :color="colorForValue(record.executorName)">
                  {{ record.executorName }}
                </a-tag>
              </template>
              <template v-if="column.key === 'brandTeam'">
                <span v-if="record.isTierSummaryRow" style="color:#874d00;font-weight:600">{{ record.brandName }}</span>
                <template v-else-if="record.isSummaryRow">汇总</template>
                <template v-else-if="record.isGroupSubtotal"><b>{{ record.brandName }}</b></template>
                <template v-else>
                  <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
                  <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
                </template>
              </template>
              <template v-if="column.key === 'videoTypeLabel'">{{ record.isTierSummaryRow ? '' : (record.videoTypeLabel || '—') }}</template>
              <template v-if="column.key === 'videoCount'">{{ record.isTierSummaryRow ? '' : (record.videoCount ?? 0) }}</template>
              <template v-if="column.key === 'unitPrice'">
                {{ (record.isTierSummaryRow || record.isSummaryRow || record.isGroupSubtotal) ? '' : fmt(record.unitPrice) }}
              </template>
              <template v-if="column.key === 'amount'">{{ record.isTierSummaryRow ? '' : fmt(record.amount) }}</template>
              <template v-if="column.key === 'confirmStatus' && record.isGroupSubtotal">
                <a-tag :color="record.groupConfirmed ? 'green' : 'orange'">
                  {{ record.groupConfirmed ? '已确认' : '预计' }}
                </a-tag>
              </template>
            </template>
          </a-table>
          <div class="summary-lines">
            <div class="line">
              <span>{{ detail.type === 'MANAGEMENT' ? '内部执行人力成本合计' : '应发给执行人员的工资' }}</span>
              <span>{{ fmt(detail.executorWageTotal) }}</span>
            </div>
            <div v-if="detail.type === 'PROJECT_MANAGER'" class="line total">
              <span>最终净得工资</span><span>{{ fmt(detail.finalNetWage) }}</span>
            </div>
          </div>
        </template>

        <!-- 负责人提成合计（含Bonus）明细：按项目负责人拆分，管理层自己不算在内
             （2026-08-10 新增，Shawn 反馈只看汇总数字没法核对公式） -->
        <template v-if="detail.type === 'MANAGEMENT' && detail.commissionBreakdownRows && detail.commissionBreakdownRows.length">
          <div class="section-title"><span>负责人提成合计（含Bonus）明细</span></div>
          <a-table :columns="commissionBreakdownColumns" :data-source="detail.commissionBreakdownRows"
            :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'managerName'">
                <template v-if="record.isSummaryRow">汇总</template>
                <a-tag v-else-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
              </template>
              <template v-if="column.key === 'amount'">{{ fmt(record.amount) }}</template>
              <template v-if="column.key === 'amount2'">{{ record.amount2 != null ? fmt(record.amount2) : '—' }}</template>
              <template v-if="column.key === 'profit'">{{ fmt(record.profit) }}</template>
            </template>
          </a-table>
          <div class="hint-line">Bonus 一列显示"—"代表这个项目负责人这个月还没确认（未确认前阶梯Bonus算不出来），不是没有配置Bonus阶梯</div>
        </template>

        <!-- 内部其他员工成本明细：按人拆分（财务/IT后勤固定月薪、法务当月工资）
             （2026-08-10 新增） -->
        <template v-if="detail.type === 'MANAGEMENT' && detail.otherStaffCostBreakdownRows && detail.otherStaffCostBreakdownRows.length">
          <div class="section-title"><span>内部其他员工成本明细</span></div>
          <a-table :columns="otherStaffCostBreakdownColumns" :data-source="detail.otherStaffCostBreakdownRows"
            :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'staffLabel'">
                <template v-if="record.isSummaryRow">汇总</template>
                <a-tag v-else-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
              </template>
              <template v-if="column.key === 'amount'">{{ fmt(record.amount) }}</template>
            </template>
          </a-table>
        </template>

        <div class="footer-hint">{{ footerHint }}</div>
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
  currency: { type: String, default: 'RMB' }
})
const emit = defineEmits(['update:visible'])

const loading = ref(false)
const detail = ref(null)

const columns = computed(() => {
  if (!detail.value) return []
  if (detail.value.type === 'EXECUTOR') {
    return [
      { title: '所属项目负责人', key: 'projectManagerName', width: 130 },
      { title: '品牌方/红人团队', key: 'brandTeam', width: 180 },
      { title: '项目视频类型', key: 'videoTypeLabel', width: 110 },
      { title: '视频数', key: 'videoCount', width: 80 },
      { title: '单价', key: 'unitPrice', width: 100 },
      { title: '薪酬金额', key: 'amount', width: 140 }
    ]
  }
  if (detail.value.type === 'MANAGEMENT') {
    return [
      { title: '品牌方/红人团队', key: 'brandTeam', width: 200 },
      { title: '视频数', key: 'videoCount', width: 80 },
      { title: '客户合作价格', key: 'amount', width: 140 },
      { title: '红人成本', key: 'amount2', width: 140 }
    ]
  }
  // PROJECT_MANAGER：2026-08 新增红人成本/利润两列——提成金额是拿利润乘以提成比例算出来的，
  // 光看提成金额看不出这个依据，补上这两列（含表格自带的汇总行）让项目负责人能自己核对
  return [
    { title: '品牌方/红人团队', key: 'brandTeam', width: 180 },
    { title: '视频数', key: 'videoCount', width: 70 },
    { title: '客户合作价格', key: 'amount', width: 130 },
    { title: '红人成本', key: 'amount2', width: 130 },
    { title: '利润', key: 'profit', width: 130 }
  ]
})

// 之前"品牌方/红人团队"/"项目视频类型"这两列一直没设置固定宽度（Ant Design 表格里其余
// 列都设了 width，只有这两列没设，会导致自动布局时被其它固定宽度列挤占空间——720px 的弹窗
// 宽度本来就紧张，"项目视频类型"这种短文本列一旦被挤到只剩几十像素，中文就会一个字一行，
// 表格高度暴涨。这次全部显式给宽度（2026-07-29 Shawn 反馈修复）。
const executorWageColumns = [
  { title: '执行人员', key: 'executorName', width: 130 },
  { title: '品牌方/红人团队', key: 'brandTeam', width: 180 },
  { title: '项目视频类型', key: 'videoTypeLabel', width: 110 },
  { title: '视频数', key: 'videoCount', width: 80 },
  { title: '单价', key: 'unitPrice', width: 100 },
  { title: '薪酬金额', key: 'amount', width: 140 },
  { title: '确认状态', key: 'confirmStatus', width: 90 }
]

// 管理层"查看详情"专属明细表（2026-08-10 新增）：负责人提成合计（含Bonus）按负责人拆分
const commissionBreakdownColumns = [
  { title: '项目负责人', key: 'managerName', width: 160 },
  { title: '原始提成', key: 'amount', width: 160 },
  { title: '阶梯Bonus', key: 'amount2', width: 160 },
  { title: '合计', key: 'profit', width: 160 }
]
// 内部其他员工成本按人拆分
const otherStaffCostBreakdownColumns = [
  { title: '人员', key: 'staffLabel', width: 240 },
  { title: '金额', key: 'amount', width: 200 }
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

function rowClassName(record) {
  if (record.isSummaryRow) return 'summary-row'
  if (record.isTierSummaryRow) return 'tier-summary-row'
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
.line {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}
.hint-line {
  font-size: 12px;
  color: #595959;
  padding: 0 0 4px;
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
.formula-title {
  font-size: 12px;
  color: #595959;
  margin-bottom: 10px;
}
.formula-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 4px;
}
.formula-term {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
  max-width: 160px;
  padding: 2px 6px;
  text-align: center;
}
.formula-label {
  font-size: 12px;
  color: #595959;
  margin-bottom: 4px;
}
.formula-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  font-family: 'Consolas', monospace;
}
.formula-op {
  font-size: 16px;
  color: #999;
  padding: 0 2px;
}
.formula-term.formula-total .formula-label {
  color: #333;
  font-weight: 600;
}
.formula-term.formula-total .formula-value {
  font-size: 17px;
  font-weight: 700;
  color: #000;
}
.footer-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #595959;
  text-align: right;
}
:deep(.summary-row) {
  font-weight: 600;
  background: #fafafa;
}
:deep(.tier-summary-row) {
  background: #fffbe6;
}
:deep(.subtotal-row) {
  font-weight: 600;
  background: #f7f7f7;
}
/* 每个执行人员小计行下面加一条更明显的分隔线，跟下一个执行人员的明细行区分开——
   表格行本身没有"外边距"这个概念，用加粗的单元格底边框模拟视觉上的间隔 */
:deep(.subtotal-row td) {
  border-bottom: 2px solid #bfbfbf !important;
}
</style>
