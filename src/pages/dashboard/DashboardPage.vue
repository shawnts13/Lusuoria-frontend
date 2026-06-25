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
          <div class="value">{{ summary.videoProjectCount ?? 0 }}</div>
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

        <div class="summary-card">
          <div class="label">内部执行人力成本</div>
          <div class="value">{{ fmt(summary.totalInternalExecutionCost) }}</div>
        </div>

        <div class="summary-card success clickable" @click="openDrilldown('gross-profit')">
          <div class="label">项目毛利 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalGrossProfit) }}</div>
        </div>

        <div class="summary-card success">
          <div class="label">可分配利润</div>
          <div class="value">{{ fmt(summary.totalDistributableProfit) }}</div>
        </div>

        <div class="summary-card warning clickable" @click="openDrilldown('commission')">
          <div class="label">负责人提成合计 <span class="drill-hint">点击查看明细 ›</span></div>
          <div class="value">{{ fmt(summary.totalCommissionAmount) }}</div>
        </div>

        <div class="summary-card highlight">
          <div class="label">公司利润</div>
          <div class="value">{{ fmt(summary.totalCompanyProfit) }}</div>
        </div>
      </div>
    </a-spin>

    <!-- 视频项目数量下钻：品牌方 + 红人类型，无币种切换 -->
    <DrilldownModal
      v-model:visible="modals.video"
      title="视频项目数量明细（按品牌方 / 红人类型）"
      metric="video"
      :default-month="selectedMonth"
      :show-currency-toggle="false"
      :fetcher="fetchVideoDrilldown"
    />

    <!-- 客户合作价格下钻：品牌方 + 红人类型 -->
    <DrilldownModal
      v-model:visible="modals.clientPrice"
      title="客户合作价格明细（按品牌方 / 红人类型）"
      metric="client-price"
      :default-month="selectedMonth"
      :show-currency-toggle="true"
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

    <!-- 项目毛利下钻：品牌方/团队/账号/类型 可切换 -->
    <DrilldownModal
      v-model:visible="modals.grossProfit"
      title="项目毛利明细"
      metric="gross-profit"
      :default-month="selectedMonth"
      :show-currency-toggle="true"
      :dimension-options="dimensionOptions"
      :fetcher="fetchGrossProfitDrilldown"
    />

    <!-- 负责人提成下钻：仅负责人维度 -->
    <DrilldownModal
      v-model:visible="modals.commission"
      title="负责人提成明细"
      metric="commission"
      :default-month="selectedMonth"
      :show-currency-toggle="true"
      :fetcher="fetchCommissionDrilldown"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
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
  grossProfit: false, commission: false
})

const dimensionOptions = [
  { value: 'brand',   label: '按品牌方' },
  { value: 'team',    label: '按红人团队' },
  { value: 'account',  label: '按红人账号' },
  { value: 'type',    label: '按红人类型' }
]

function openDrilldown(metric) {
  const map = { video: 'video', 'client-price': 'clientPrice',
    'influencer-cost': 'influencerCost', 'gross-profit': 'grossProfit', commission: 'commission' }
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
function fetchVideoDrilldown(start, end) {
  return dashboardApi.drilldownVideoCount(start, end)
}
function fetchClientPriceDrilldown(start, end, cur) {
  return dashboardApi.drilldownClientPrice(start, end, cur)
}
function fetchInfluencerCostDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownInfluencerCost(start, end, cur, dim)
}
function fetchGrossProfitDrilldown(start, end, cur, dim) {
  return dashboardApi.drilldownGrossProfit(start, end, cur, dim)
}
function fetchCommissionDrilldown(start, end, cur) {
  return dashboardApi.drilldownCommission(start, end, cur)
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
.exchange-rate-display {
  font-size: 13px;
  color: #666;
}
.exchange-rate-display a, .rate-updated-by {
  color: #999;
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
</style>
