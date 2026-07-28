<template>
  <div class="page-container">
    <!-- Header: month selector + currency toggle + exchange rate -->
    <div class="page-header">
      <span class="page-title">数据看板</span>
      <a-space :size="16">
        <a-date-picker
          v-model:value="selectedMonth"
          picker="month"
          format="YYYYMM"
          value-format="YYYYMM"
          placeholder="选择月份"
          @change="loadSummary"
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
      :show-currency-toggle="true"
      :dimension-options="clientPriceDimensionOptions"
      :fetcher="fetchClientPriceDrilldown"
    />

    <!-- 红人成本下钻：品牌方/团队/账号/类型 可切换 -->
    <DrilldownModal
      v-model:visible="modals.influencerCost"
      title="红人成本明细"
      metric="influencer-cost"
      :default-month="selectedMonth"
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
      :show-currency-toggle="true"
      :dimension-options="executionCostDimensionOptions"
      :fetcher="fetchExecutionCostDrilldown"
    />

    <!-- 内部其他员工成本下钻：财务/IT后勤的固定月薪，按"员工角色-姓名"展示 -->
    <DrilldownModal
      v-model:visible="modals.otherStaffCost"
      title="内部其他员工成本明细"
      metric="other-staff-cost"
      :default-month="selectedMonth"
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
      :show-currency-toggle="true"
      :fetcher="fetchCommissionDrilldown"
    />

    <!-- 奖金下钻：仅员工维度，当月没有人设置奖金时卡片本身不显示，弹窗也就打不开 -->
    <DrilldownModal
      v-model:visible="modals.extraBonus"
      title="奖金明细"
      metric="extra-bonus"
      :default-month="selectedMonth"
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
const currency = ref('USD')
const summary = ref({})

const modals = reactive({
  video: false, clientPrice: false, influencerCost: false,
  grossProfit: false, companyProfit: false, executionCost: false, otherStaffCost: false, commission: false,
  extraBonus: false
})

// 当月没有任何人设置奖金（Payslip.extraBonusAmount）时不展示"奖金"这张卡片
const hasExtraBonus = computed(() => {
  const v = parseFloat(summary.value.totalExtraBonus)
  return !isNaN(v) && v !== 0
})

// 2026-07 起去掉"按红人团队"（红人成本/项目毛利/公司利润这三个下钻共用这份维度列表）
const dimensionOptions = [
  { value: 'brand',      label: '按品牌方' },
  { value: 'brand_team', label: '按品牌方/红人团队' },
  { value: 'account',    label: '按红人账号' },
  { value: 'type',       label: '按红人类型' }
]
// 项目毛利/公司利润专用：在通用维度基础上追加"按项目负责人"，不影响红人成本明细的可选维度
const dimensionOptionsWithManager = [
  ...dimensionOptions,
  { value: 'manager', label: '按项目负责人' }
]

const clientPriceDimensionOptions = [
  { value: 'brand',       label: '按品牌方' },
  { value: 'brand_team',  label: '按品牌方/红人团队' },
  { value: 'manager',     label: '按项目负责人' }
]

const executionCostDimensionOptions = [
  { value: 'manager',            label: '按项目负责人' },
  { value: 'manager_executor',   label: '按项目负责人/执行人员' },
  { value: 'manager_brand_team', label: '按项目负责人/品牌方/红人团队' }
]

// 2026-07 起："按品牌方"排最前面，去掉"按项目视频发布时间"
const videoDimensionOptions = [
  { value: 'brand',      label: '按品牌方' },
  { value: 'brand_team', label: '按品牌方/红人团队' },
  { value: 'manager',    label: '按项目负责人' }
]

function openDrilldown(metric) {
  const map = { video: 'video', 'client-price': 'clientPrice',
    'influencer-cost': 'influencerCost', 'gross-profit': 'grossProfit',
    'company-profit': 'companyProfit', 'execution-cost': 'executionCost',
    'other-staff-cost': 'otherStaffCost', commission: 'commission', 'extra-bonus': 'extraBonus' }
  modals[map[metric]] = true
}

async function loadSummary() {
  if (!selectedMonth.value) return
  loading.value = true
  try {
    const res = await dashboardApi.summary(selectedMonth.value, currency.value)
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

// 下钻请求函数：统一签名 (startMonth, endMonth, currency, dimension) -> Promise
function fetchVideoDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownVideoCount(start, end, dim)
}
function fetchClientPriceDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownClientPrice(start, end, cur, dim)
}
function fetchInfluencerCostDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownInfluencerCost(start, end, cur, dim)
}
function fetchGrossProfitDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownGrossProfit(start, end, cur, dim)
}
function fetchCompanyProfitDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownCompanyProfit(start, end, cur, dim)
}
function fetchExecutionCostDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownExecutionCost(start, end, cur, dim)
}
function fetchOtherStaffCostDrilldown(start, end, cur) {
  return dashboardApi.drilldownOtherStaffCost(start, end, cur)
}
function fetchCommissionDrilldown(start, end, cur) {
  return dashboardApi.drilldownCommission(start, end, cur)
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
