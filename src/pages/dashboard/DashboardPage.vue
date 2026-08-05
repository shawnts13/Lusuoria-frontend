<template>
  <div class="page-container">
    <!-- Header: month selector + currency toggle + exchange rate -->
    <div class="page-header">
      <span class="page-title">数据看板</span>
      <a-space :size="16">
        <router-link to="/dashboard/annual-report">年度报告 ›</router-link>
        <router-link to="/dashboard/comparison">双月对比 ›</router-link>
        <a-date-picker
          v-model:value="selectedMonth"
          picker="month"
          format="YYYYMM"
          value-format="YYYYMM"
          placeholder="选择月份"
          @change="onMonthChange"
        />
        <a-range-picker
          v-model:value="selectedDateRange"
          value-format="YYYY-MM-DD"
          :placeholder="['视频发布开始日期', '视频发布结束日期']"
          @change="onDateRangeChange"
        />
        <a-radio-group v-model:value="currency" button-style="solid" @change="loadSummary">
          <a-radio-button value="USD">USD</a-radio-button>
          <a-radio-button value="RMB">RMB</a-radio-button>
        </a-radio-group>
        <span v-if="summary.exchangeRateInfo?.isMissing" class="exchange-rate-error">
          该月份汇率未维护，金额暂按 USD 展示
          <router-link v-if="authStore.isAdmin" to="/exchange-rates">去维护 ›</router-link>
        </span>
        <span v-else-if="summary.exchangeRateInfo?.usdToCny" class="exchange-rate-display">
          汇率：1 USD = {{ summary.exchangeRateInfo.usdToCny }} CNY
          <span class="rate-updated-by" v-if="summary.exchangeRateInfo.updatedBy">
            （{{ summary.exchangeRateInfo.updatedBy }} 维护）
          </span>
        </span>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card highlight clickable" @click="openDrilldown('video')">
          <div class="label">视频项目数量 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">
            {{ summary.videoProjectCount ?? 0 }}笔
            <span v-if="summary.damagedVideoProjectCount" class="damaged-note">
              （其中{{ summary.damagedVideoProjectCount }}笔为折损）
            </span>
          </div>
        </div>

        <div class="summary-card clickable" @click="openDrilldown('client-price')">
          <div class="label">客户合作价格 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalClientPrice) }}</div>
        </div>

        <div class="summary-card success clickable" @click="openDrilldown('client-settled-amount')">
          <div class="label">客户已回款总金额 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalClientSettledAmount) }}</div>
        </div>

        <div class="summary-card warning clickable" @click="openDrilldown('influencer-cost')">
          <div class="label">红人成本 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalInfluencerCost) }}</div>
        </div>

        <div class="summary-card">
          <div class="label">其他外部成本</div>
          <div class="value">{{ fmt(summary.totalOtherExternalCost) }}</div>
        </div>

        <div class="summary-card warning clickable" @click="openDrilldown('commission')">
          <div class="label">负责人提成合计 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalCommissionAmount) }}</div>
        </div>

        <div class="summary-card clickable" @click="openDrilldown('execution-cost')">
          <div class="label">内部执行人力成本 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalInternalExecutionCost) }}</div>
        </div>

        <div class="summary-card clickable" @click="openDrilldown('other-staff-cost')">
          <div class="label">内部其他员工成本 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalOtherStaffCost) }}</div>
        </div>

        <!-- 奖金（Payslip.extraBonusAmount）：当月没有任何人设置奖金时不显示这张卡片 -->
        <div v-if="hasExtraBonus" class="summary-card warning clickable" @click="openDrilldown('extra-bonus')">
          <div class="label">奖金 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalExtraBonus) }}</div>
        </div>

        <div class="summary-card success clickable" @click="openDrilldown('gross-profit')">
          <div class="label">项目毛利 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalGrossProfit) }}</div>
        </div>

        <div class="summary-card success">
          <div class="label">可分配利润</div>
          <div class="value">{{ fmt(summary.totalDistributableProfit) }}</div>
        </div>

        <div class="summary-card highlight clickable" @click="openDrilldown('company-profit')">
          <div class="label">公司利润 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalCompanyProfit) }}</div>
        </div>
      </div>

      <div v-if="summary.totalCompanyProfit != null" class="formula-box">
        <div class="formula-title">公司利润 = 项目毛利 − 内部执行人力成本 − 负责人提成合计 − 内部其他员工成本 − 奖金</div>
        <div class="formula-row">
          <div class="formula-term">
            <div class="formula-label">项目毛利</div>
            <div class="formula-value">{{ fmt(summary.totalGrossProfit) }}</div>
          </div>
          <div class="formula-op">−</div>
          <div class="formula-term">
            <div class="formula-label">内部执行人力成本</div>
            <div class="formula-value">{{ fmt(summary.totalInternalExecutionCostForProfit) }}</div>
          </div>
          <div class="formula-op">−</div>
          <div class="formula-term">
            <div class="formula-label">负责人提成合计</div>
            <div class="formula-value">{{ fmt(summary.totalCommissionAmount) }}</div>
          </div>
          <div class="formula-op">−</div>
          <div class="formula-term">
            <div class="formula-label">内部其他员工成本</div>
            <div class="formula-value">{{ fmt(summary.totalOtherStaffCost) }}</div>
          </div>
          <div class="formula-op">−</div>
          <div class="formula-term">
            <div class="formula-label">奖金</div>
            <div class="formula-value">{{ fmt(summary.totalExtraBonus) }}</div>
          </div>
          <div class="formula-op">=</div>
          <div class="formula-term formula-total">
            <div class="formula-label">公司利润</div>
            <div class="formula-value">{{ fmt(summary.totalCompanyProfit) }}</div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 视频项目数量下钻：品牌方 + 红人团队，无币种切换 -->
    <DrilldownModal
      v-model:visible="modals.video"
      title="视频项目数量明细"
      metric="video"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="false"
      :dimension-options="videoDimensionOptions"
      :fetcher="fetchVideoDrilldown"
    />

    <!-- 客户合作价格下钻：品牌方/红人团队，或项目负责人 可切换 -->
    <DrilldownModal
      v-model:visible="modals.clientPrice"
      title="客户合作价格明细"
      metric="client-price"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :dimension-options="clientPriceDimensionOptions"
      :fetcher="fetchClientPriceDrilldown"
    />

    <!-- 客户已回款总金额下钻（2026-08 新增）：维度跟"客户合作价格"完全一样 -->
    <DrilldownModal
      v-model:visible="modals.clientSettledAmount"
      title="客户已回款总金额明细"
      metric="client-settled-amount"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :dimension-options="clientPriceDimensionOptions"
      :fetcher="fetchClientSettledAmountDrilldown"
    />

    <!-- 红人成本下钻：品牌方/团队/账号/类型 可切换 -->
    <DrilldownModal
      v-model:visible="modals.influencerCost"
      title="红人成本明细"
      metric="influencer-cost"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :dimension-options="dimensionOptions"
      :fetcher="fetchInfluencerCostDrilldown"
    />

    <!-- 项目毛利下钻：品牌方/团队/品牌方-团队/账号/类型/项目负责人 可切换 -->
    <DrilldownModal
      v-model:visible="modals.grossProfit"
      title="项目毛利明细"
      metric="gross-profit"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :dimension-options="dimensionOptionsWithManager"
      :fetcher="fetchGrossProfitDrilldown"
    />

    <!-- 公司利润下钻：品牌方/团队/品牌方-团队/账号/类型/项目负责人 可切换 -->
    <DrilldownModal
      v-model:visible="modals.companyProfit"
      title="公司利润明细"
      metric="company-profit"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :dimension-options="dimensionOptionsWithManager"
      :fetcher="fetchCompanyProfitDrilldown"
    />

    <!-- 内部执行人力成本下钻：按项目负责人，或项目负责人/品牌方/红人团队 可切换 -->
    <DrilldownModal
      v-model:visible="modals.executionCost"
      title="内部执行人力成本明细"
      metric="execution-cost"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :dimension-options="executionCostDimensionOptions"
      :fetcher="fetchExecutionCostDrilldown"
    />

    <!-- 内部其他员工成本下钻：财务/IT后勤的固定月薪，按"员工角色-姓名"展示。这两项是按月设置的
         数据，不支持按天筛选，弹窗固定用月份区间选择器（不传 date-mode），日期区间模式下默认
         显示区间覆盖到的完整月份范围 -->
    <DrilldownModal
      v-model:visible="modals.otherStaffCost"
      title="内部其他员工成本明细"
      metric="other-staff-cost"
      :default-month-range="payslipMetricMonthRange"
      :show-currency-toggle="true"
      :count-label="'人数'"
      :fetcher="fetchOtherStaffCostDrilldown"
    />

    <!-- 负责人提成下钻：仅负责人维度 -->
    <DrilldownModal
      v-model:visible="modals.commission"
      title="项目负责人提成明细"
      metric="commission"
      :default-month="selectedMonth"
      :date-mode="isDateMode"
      :default-date-range="selectedDateRange"
      :show-currency-toggle="true"
      :fetcher="fetchCommissionDrilldown"
    />

    <!-- 奖金下钻：仅员工维度，当月没有人设置奖金时卡片本身不显示，弹窗也就打不开。跟"内部其他
         员工成本"一样是按月数据，不支持按天筛选，固定用月份区间选择器 -->
    <DrilldownModal
      v-model:visible="modals.extraBonus"
      title="奖金明细"
      metric="extra-bonus"
      :default-month-range="payslipMetricMonthRange"
      :show-currency-toggle="true"
      :count-label="'人数'"
      :fetcher="fetchExtraBonusDrilldown"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { dashboardApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import dayjs from 'dayjs'
import DrilldownModal from './DrilldownModal.vue'

const authStore = useAuthStore()
const loading = ref(false)
const selectedMonth = ref(dayjs().format('YYYYMM'))
// "视频发布日期"区间筛选（2026-08 新增）：跟"月份"互斥，默认显示"当前月份"，选了日期区间就
// 清空月份（反之亦然）。isDateMode 为 true 时，看板数字和所有下钻弹窗都改用日期区间查询
const selectedDateRange = ref(undefined)
const isDateMode = computed(() => !!(selectedDateRange.value && selectedDateRange.value.length === 2))
const currency = ref('USD')
const summary = ref({})

function onMonthChange(v) {
  selectedMonth.value = v
  if (v) selectedDateRange.value = undefined
  loadSummary()
}
function onDateRangeChange(v) {
  if (v && v.length === 2) selectedMonth.value = undefined
  loadSummary()
}
// "内部其他员工成本"/"奖金"这两个下钻是按月设置的工资/奖金数据，没有"某天的工资"这个概念，
// 日期区间模式下把区间换算成覆盖到的月份范围（哪怕区间只覆盖某个月的几天，也按整月算），
// 交给现有的月份区间下钻接口，不需要后端为这两个单独支持按天筛选
function touchedMonthRange(dateRange) {
  const toMonth = d => d.slice(0, 7).replace('-', '')
  return [toMonth(dateRange[0]), toMonth(dateRange[1])]
}
// "内部其他员工成本"/"奖金"下钻弹窗用（这两个固定显示月份区间选择器，不管主看板是月份模式
// 还是日期区间模式）：日期区间模式下默认显示区间覆盖到的完整月份范围，月份模式下就是当前选的这一个月
const payslipMetricMonthRange = computed(() =>
  isDateMode.value ? touchedMonthRange(selectedDateRange.value) : [selectedMonth.value, selectedMonth.value]
)

const modals = reactive({
  video: false, clientPrice: false, clientSettledAmount: false, influencerCost: false,
  grossProfit: false, companyProfit: false, executionCost: false, otherStaffCost: false, commission: false,
  extraBonus: false
})

// 当月没有任何人设置奖金（Payslip.extraBonusAmount）时不展示"奖金"这张卡片
const hasExtraBonus = computed(() => {
  const v = parseFloat(summary.value.totalExtraBonus)
  return !isNaN(v) && v !== 0
})

// 2026-07 起去掉"按红人团队"（红人成本/项目毛利/公司利润这三个下钻共用这份维度列表）；
// 同一批新增"按服务国家/市场""按合作平台"（2026-07 年度报告功能顺带加到现有单月下钻弹窗）
const dimensionOptions = [
  { value: 'brand',         label: '按品牌方' },
  { value: 'brand_team',    label: '按品牌方/红人团队' },
  { value: 'account',       label: '按红人账号' },
  { value: 'type',          label: '按红人类型' },
  { value: 'countryMarket', label: '按服务国家/市场' },
  { value: 'platform',      label: '按合作平台' }
]
// 项目毛利/公司利润专用：在通用维度基础上追加"按项目负责人"，不影响红人成本明细的可选维度
const dimensionOptionsWithManager = [
  ...dimensionOptions,
  { value: 'manager', label: '按项目负责人' }
]

const clientPriceDimensionOptions = [
  { value: 'brand',         label: '按品牌方' },
  { value: 'brand_team',    label: '按品牌方/红人团队' },
  { value: 'manager',       label: '按项目负责人' },
  { value: 'countryMarket', label: '按服务国家/市场' },
  { value: 'platform',      label: '按合作平台' }
]

const executionCostDimensionOptions = [
  { value: 'manager',            label: '按项目负责人' },
  { value: 'manager_executor',   label: '按项目负责人/执行人员' },
  { value: 'manager_brand_team', label: '按项目负责人/品牌方/红人团队' }
]

// 2026-07 起："按品牌方"排最前面，去掉"按项目视频发布时间"；同一批新增执行人员/国家市场/合作平台
const videoDimensionOptions = [
  { value: 'brand',         label: '按品牌方' },
  { value: 'brand_team',    label: '按品牌方/红人团队' },
  { value: 'manager',       label: '按项目负责人' },
  { value: 'executor',      label: '按执行人员' },
  { value: 'countryMarket', label: '按服务国家/市场' },
  { value: 'platform',      label: '按合作平台' }
]

function openDrilldown(metric) {
  const map = { video: 'video', 'client-price': 'clientPrice',
    'client-settled-amount': 'clientSettledAmount',
    'influencer-cost': 'influencerCost', 'gross-profit': 'grossProfit',
    'company-profit': 'companyProfit', 'execution-cost': 'executionCost',
    'other-staff-cost': 'otherStaffCost', commission: 'commission', 'extra-bonus': 'extraBonus' }
  modals[map[metric]] = true
}

async function loadSummary() {
  if (!isDateMode.value && !selectedMonth.value) return
  loading.value = true
  try {
    const res = isDateMode.value
      ? await dashboardApi.summary(undefined, currency.value, selectedDateRange.value)
      : await dashboardApi.summary(selectedMonth.value, currency.value)
    summary.value = res.data || {}
  } catch {
    summary.value = {}
  } finally {
    loading.value = false
  }
}

function fmt(val) {
  if (val == null || val === '') return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  const prefix = currency.value === 'RMB' ? '¥' : '$'
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 下钻请求函数：统一签名 (startMonth, endMonth, currency, dimension, dateRange) -> Promise。
// dateRange 只在主看板处于"日期区间"模式时才有值（[startDate,endDate]），月份模式下是 undefined
function fetchVideoDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownVideoCount(start, end, dim, dateRange)
}
function fetchClientPriceDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownClientPrice(start, end, cur, dim, dateRange)
}
function fetchClientSettledAmountDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownClientSettledAmount(start, end, cur, dim, dateRange)
}
function fetchInfluencerCostDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownInfluencerCost(start, end, cur, dim, dateRange)
}
function fetchGrossProfitDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownGrossProfit(start, end, cur, dim, dateRange)
}
function fetchCompanyProfitDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownCompanyProfit(start, end, cur, dim, dateRange)
}
function fetchExecutionCostDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownExecutionCost(start, end, cur, dim, dateRange)
}
// 这两个是按月设置的工资/奖金数据，不支持按天筛选——弹窗本身固定用月份区间选择器
// （DrilldownModal 的 date-mode 没传给这两个实例），所以这里始终只会收到月份区间参数
function fetchOtherStaffCostDrilldown(start, end, cur) {
  return dashboardApi.drilldownOtherStaffCost(start, end, cur)
}
function fetchCommissionDrilldown(start, end, cur, dim, dateRange) {
  return dashboardApi.drilldownCommission(start, end, cur, dateRange)
}
function fetchExtraBonusDrilldown(start, end, cur) {
  return dashboardApi.drilldownExtraBonus(start, end, cur)
}

onMounted(loadSummary)
</script>

<style scoped>
.clickable {
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.clickable:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.drill-hint {
  font-size: 11px;
  color: #1677ff;
  font-weight: normal;
  margin-left: 4px;
}
.damaged-note {
  font-size: 13px;
  font-weight: normal;
  color: #fa8c16;
}
.exchange-rate-display {
  font-size: 13px;
  color: #595959;
}
.exchange-rate-display a, .rate-updated-by {
  color: #595959;
  margin-left: 4px;
}
.exchange-rate-error {
  font-size: 13px;
  color: #ff4d4f;
}
.exchange-rate-error a {
  color: #1677ff;
  margin-left: 4px;
}
.formula-box {
  margin-top: 16px;
  padding: 12px 16px;
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
</style>
