<template>
  <div class="page-container">
    <div class="page-header no-print">
      <span class="page-title">年度报告</span>
      <a-space :size="16" wrap>
        <router-link to="/dashboard">‹ 返回数据看板</router-link>
        <a-date-picker v-model:value="yearValue" picker="year" placeholder="选择年份" @change="loadAll" />
        <a-radio-group v-model:value="currency" button-style="solid" @change="loadAll">
          <a-radio-button value="USD">USD</a-radio-button>
          <a-radio-button value="RMB">RMB</a-radio-button>
        </a-radio-group>
        <a-button type="primary" @click="printReport">导出 PDF</a-button>
      </a-space>
    </div>
    <div class="print-title">{{ year }} 年度报告（{{ currency }}）</div>
    <a-alert v-if="warmingUp" type="info" show-icon class="no-print" style="margin-bottom:16px"
      message="正在连接服务器"
      description="服务器长时间未使用会自动休眠，首次访问需要等待它启动，通常不超过1分钟，请耐心等待……" />
    <a-alert v-if="loadWarning" type="warning" show-icon closable class="no-print" style="margin-bottom:16px"
      :message="loadWarning" @close="loadWarning = ''">
      <template #action>
        <a-button size="small" type="primary" ghost @click="loadAll">重新生成报告</a-button>
      </template>
    </a-alert>

    <a-spin :spinning="loading">
      <template v-if="rangeSummary">
        <!-- 全年总计 + 同比 -->
        <section class="report-section">
          <div class="section-title">全年总计</div>
          <div class="kpi-grid">
            <div v-for="k in KPI_METRICS" :key="k.field" class="kpi-card">
              <div class="kpi-label">{{ k.label }}</div>
              <div class="kpi-value">{{ fmtKpi(rangeSummary.total?.[k.field], k.isCount) }}</div>
              <div class="kpi-yoy" v-if="yoyText(k.field)">
                <span :class="yoyClass(k.field)">{{ yoyText(k.field) }}</span>
                <span class="yoy-hint">同比 {{ year - 1 }} 年</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 月度趋势 + 季度对比 -->
        <section class="report-section">
          <div class="section-title">月度趋势 / 季度对比</div>
          <div class="chart-grid">
            <ReportChartCard v-for="m in TREND_METRICS" :key="'month_'+m.field"
              :title="`${m.label} · 月度趋势`"
              :option="monthlyLineOption(m)" height="260px" />
          </div>
          <div class="chart-grid">
            <ReportChartCard v-for="m in TREND_METRICS" :key="'quarter_'+m.field"
              :title="`${m.label} · 季度对比`"
              :option="quarterColumnOption(m)" height="240px" />
          </div>
        </section>

        <!-- 各维度下钻对比 -->
        <section class="report-section" v-for="group in chartGroups" :key="group.name">
          <div class="section-title">{{ group.name }}</div>
          <div class="chart-grid">
            <ReportChartCard v-for="d in group.defs" :key="d.key"
              :title="`${group.name} · ${d.title}`"
              :option="dimBarOption(d)" height="300px">
              <template #table>
                <a-table :columns="dimTableColumns(d)" :data-source="dimensionRows[d.key] || []"
                  size="small" row-key="dimensionLabel" :pagination="{ pageSize: 10 }" />
              </template>
            </ReportChartCard>
          </div>
        </section>

        <!-- 集中度/风险分析：品牌方/团队/项目负责人/国家市场，基于项目毛利 -->
        <section class="report-section">
          <div class="section-title">集中度 / 风险分析</div>
          <ParetoChartCard v-for="p in PARETO_DEFS" :key="p.key"
            :title="p.title"
            :rows="dimensionRows[p.key] || []"
            field="amount"
            :currency-prefix="currencyPrefix" />
        </section>

        <!-- 维度交叉透视 -->
        <section class="report-section">
          <div class="section-title">维度交叉透视</div>
          <PivotHeatmapCard v-for="p in PIVOT_DEFS" :key="p.key"
            :title="p.title"
            :pivot-data="pivotResults[p.key] || { rowLabels: [], colLabels: [], cells: [] }"
            :currency-prefix="currencyPrefix" />
        </section>

        <!-- 员工理论数据 -->
        <section class="report-section">
          <div class="section-title">员工理论数据（按项目负责人/执行人员，基于合作跟踪记录现算）</div>
          <div class="chart-grid">
            <ReportChartCard title="项目负责人 · 项目毛利排名" :option="dimBarOption(findDef('gross_manager'))" height="300px" />
            <ReportChartCard title="项目负责人 · 公司利润排名" :option="dimBarOption(findDef('company_manager'))" height="300px" />
            <ReportChartCard title="项目负责人 · 提成排名" :option="buildBarOption(commissionRows, 'amount', currencyPrefix)" height="300px" />
            <ReportChartCard title="项目负责人/执行人员 · 内部执行成本" :option="buildBarOption(executionRows, 'amount', currencyPrefix)" height="300px" />
          </div>
        </section>

        <!-- 员工个人趋势 -->
        <section class="report-section">
          <div class="section-title">员工个人趋势（逐月）</div>
          <ManagerTrendCard title="项目负责人个人趋势" :trend-data="managerTrendData" role="manager" :currency-prefix="currencyPrefix" />
          <ManagerTrendCard title="执行人员个人趋势" :trend-data="executorTrendData" role="executor" :currency-prefix="currencyPrefix" />
        </section>
      </template>
      <div v-else-if="!loading" class="empty-hint">选择年份后生成报告</div>
    </a-spin>
  </div>
</template>

<script setup>
import '../../echarts-setup'
import { ref, reactive, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { dashboardApi, systemApi } from '../../api/index'
import { runLimited, warmUpBackend } from './report/useReportFetch'
import { pctChange } from './report/deltaMath'
import { buildBarOption, buildLineOption, buildColumnOption } from './report/chartOptions'
import { KPI_METRICS, TREND_METRICS, CHART_DEFS, CHART_GROUP_NAMES, PARETO_DEFS, PIVOT_DEFS, findChartDef } from './report/reportDefs'
import ReportChartCard from './report/ReportChartCard.vue'
import ParetoChartCard from './report/ParetoChartCard.vue'
import PivotHeatmapCard from './report/PivotHeatmapCard.vue'
import ManagerTrendCard from './report/ManagerTrendCard.vue'

/**
 * 年度报告是每次实时按选中年份现算的，不是"生成后存一份"——年份选择器不限制只能选当前年，
 * 只要底层数据还在（软删除机制保证历史数据一直都在），选任意历史年份都能补生成报告。
 */
const yearValue = ref(dayjs())
const year = computed(() => yearValue.value ? Number(dayjs(yearValue.value).format('YYYY')) : null)
const currency = ref('USD')
const currencyPrefix = computed(() => currency.value === 'RMB' ? '¥' : '$')
const loading = ref(false)
const warmingUp = ref(false)
const loadWarning = ref('')

const rangeSummary = ref(null)
const rangeSummaryLastYear = ref(null)
const dimensionRows = reactive({})
const commissionRows = ref([])
const executionRows = ref([])
const pivotResults = reactive({})
const managerTrendData = ref({ months: [], series: [] })
const executorTrendData = ref({ months: [], series: [] })

const chartGroups = computed(() => CHART_GROUP_NAMES.map(name => ({ name, defs: CHART_DEFS.filter(d => d.group === name) })))
const findDef = findChartDef

async function loadAll() {
  if (!year.value) return
  loading.value = true
  loadWarning.value = ''

  // 真正发年度报告这几十个请求之前，先确认服务器是醒着的（Render 免费实例闲置会休眠，冷启动
  // 可能要几十秒）——直接把几十个请求打过去、冷启动期间大量失败、失败后指望用户刷新页面，
  // 刷新本质上只是把同样的请求原样再打一遍，并不能真正解决"服务器还没醒"这个问题
  warmingUp.value = true
  await warmUpBackend(() => systemApi.health())
  warmingUp.value = false

  const y = year.value
  const startMonth = `${y}01`
  const endMonth = `${y}12`
  const lastYearStart = `${y - 1}01`
  const lastYearEnd = `${y - 1}12`
  const cur = currency.value

  // silent: true —— 这一批几十个请求里单个失败/超时不弹全局 Toast，runLimited 内部会自动重试，
  // 最终仍失败的部分由下面的 loadWarning 提示（此时服务器已经预热过，理论上不该再大批失败了）
  const SILENT = { silent: true }
  const taskDefs = []
  taskDefs.push({ key: 'summary', run: () => dashboardApi.rangeSummary(startMonth, endMonth, cur, SILENT) })
  taskDefs.push({ key: 'summaryLastYear', run: () => dashboardApi.rangeSummary(lastYearStart, lastYearEnd, cur, SILENT) })
  CHART_DEFS.forEach(d => {
    taskDefs.push({
      key: d.key,
      run: d.metric === 'video'
        ? () => dashboardApi.drilldownVideoCount(startMonth, endMonth, d.dim, SILENT)
        : () => dashboardApi[d.apiName](startMonth, endMonth, cur, d.dim, SILENT)
    })
  })
  taskDefs.push({ key: 'commission', run: () => dashboardApi.drilldownCommission(startMonth, endMonth, cur, SILENT) })
  taskDefs.push({ key: 'executionManager', run: () => dashboardApi.drilldownExecutionCost(startMonth, endMonth, cur, 'manager_executor', SILENT) })
  PIVOT_DEFS.forEach(p => {
    taskDefs.push({ key: p.key, run: () => dashboardApi.pivot(startMonth, endMonth, cur, p.row, p.col, SILENT) })
  })
  taskDefs.push({ key: 'trendManager', run: () => dashboardApi.managerTrend(startMonth, endMonth, cur, 'manager', SILENT) })
  taskDefs.push({ key: 'trendExecutor', run: () => dashboardApi.managerTrend(startMonth, endMonth, cur, 'executor', SILENT) })

  try {
    const { results, failedCount } = await runLimited(taskDefs.map(t => t.run))
    loadWarning.value = failedCount > 0
      ? `有 ${failedCount} 个数据请求最终未加载成功，对应图表会显示为空，可以点右侧按钮重新生成`
      : ''
    const byKey = {}
    taskDefs.forEach((t, idx) => { byKey[t.key] = results[idx] })

    rangeSummary.value = byKey.summary?.data || null
    rangeSummaryLastYear.value = byKey.summaryLastYear?.data || null
    CHART_DEFS.forEach(d => { dimensionRows[d.key] = byKey[d.key]?.data?.rows || [] })
    commissionRows.value = byKey.commission?.data?.rows || []
    executionRows.value = byKey.executionManager?.data?.rows || []
    PIVOT_DEFS.forEach(p => {
      pivotResults[p.key] = byKey[p.key]?.data || { rowLabels: [], colLabels: [], cells: [] }
    })
    managerTrendData.value = byKey.trendManager?.data || { months: [], series: [] }
    executorTrendData.value = byKey.trendExecutor?.data || { months: [], series: [] }
  } finally {
    loading.value = false
  }
}

function fmtKpi(v, isCount) {
  const n = Number(v) || 0
  if (isCount) return n.toLocaleString('en-US') + '笔'
  return currencyPrefix.value + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function yoyText(field) {
  if (!rangeSummaryLastYear.value) return ''
  const pct = pctChange(rangeSummaryLastYear.value.total?.[field], rangeSummary.value.total?.[field])
  if (pct == null) return ''
  const sign = pct >= 0 ? '▲' : '▼'
  return `${sign} ${(Math.abs(pct) * 100).toFixed(1)}%`
}
function yoyClass(field) {
  if (!rangeSummaryLastYear.value) return ''
  const pct = pctChange(rangeSummaryLastYear.value.total?.[field], rangeSummary.value.total?.[field])
  return pct >= 0 ? 'yoy-up' : 'yoy-down'
}

function monthlyLineOption(m) {
  const months = (rangeSummary.value?.monthly || []).map(x => x.yearMonth)
  const values = (rangeSummary.value?.monthly || []).map(x => Number(x[m.field]) || 0)
  return buildLineOption(months, values, currencyPrefix.value, { isCount: m.isCount })
}

function buildQuarters() {
  const monthly = rangeSummary.value?.monthly || []
  const quarters = [
    { label: 'Q1', months: monthly.slice(0, 3) },
    { label: 'Q2', months: monthly.slice(3, 6) },
    { label: 'Q3', months: monthly.slice(6, 9) },
    { label: 'Q4', months: monthly.slice(9, 12) }
  ]
  return quarters.map(q => ({
    label: q.label,
    sums: q.months.reduce((acc, m) => {
      KPI_METRICS.forEach(k => { acc[k.field] = (acc[k.field] || 0) + (Number(m[k.field]) || 0) })
      return acc
    }, {})
  }))
}
function quarterColumnOption(m) {
  const quarters = buildQuarters()
  return buildColumnOption(quarters.map(q => q.label), quarters.map(q => q.sums[m.field] || 0), currencyPrefix.value, { isCount: m.isCount })
}

function dimBarOption(d) {
  if (!d) return {}
  return buildBarOption(dimensionRows[d.key] || [], d.field, currencyPrefix.value, { isCount: !!d.isCount })
}
function dimTableColumns(d) {
  if (d.isCount) {
    return [
      { title: '维度', dataIndex: 'dimensionLabel', key: 'dimensionLabel' },
      { title: '视频数量', dataIndex: 'videoCount', key: 'videoCount' }
    ]
  }
  return [
    { title: '维度', dataIndex: 'dimensionLabel', key: 'dimensionLabel' },
    { title: '笔数', dataIndex: 'videoCount', key: 'videoCount' },
    { title: '金额', dataIndex: 'amount', key: 'amount' }
  ]
}

function printReport() {
  window.print()
}

onMounted(loadAll)
</script>

<style scoped>
.print-title {
  display: none;
}
@media print {
  .print-title {
    display: block;
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 16px;
  }
}
.report-section {
  margin-bottom: 32px;
}
.section-title {
  font-size: 17px;
  font-weight: 700;
  color: #262626;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #f0f0f0;
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 16px;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.kpi-card {
  background: #fff;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.kpi-label {
  font-size: 13px;
  color: #595959;
  margin-bottom: 8px;
}
.kpi-value {
  font-size: 21px;
  font-weight: 700;
  color: #1a1a1a;
}
.kpi-yoy {
  margin-top: 6px;
  font-size: 12px;
}
.yoy-up { color: #2a78d6; font-weight: 600; }
.yoy-down { color: #d4380d; font-weight: 600; }
.yoy-hint { color: #8c8c8c; margin-left: 4px; }
.empty-hint {
  text-align: center;
  color: #595959;
  padding: 60px 0;
}
</style>
