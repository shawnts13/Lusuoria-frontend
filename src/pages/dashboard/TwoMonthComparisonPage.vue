<template>
  <div class="page-container">
    <div class="page-header no-print">
      <span class="page-title">双月对比</span>
      <a-space :size="16" wrap>
        <router-link to="/dashboard">‹ 返回数据看板</router-link>
        <a-date-picker v-model:value="monthAValue" picker="month" format="YYYYMM" placeholder="选择月份 A" @change="loadAll" />
        <span>vs</span>
        <a-date-picker v-model:value="monthBValue" picker="month" format="YYYYMM" placeholder="选择月份 B" @change="loadAll" />
        <a-radio-group v-model:value="currency" button-style="solid" @change="loadAll">
          <a-radio-button value="USD">USD</a-radio-button>
          <a-radio-button value="RMB">RMB</a-radio-button>
        </a-radio-group>
        <a-button type="primary" @click="printReport">导出 PDF</a-button>
      </a-space>
    </div>
    <div class="print-title">{{ monthA }} vs {{ monthB }} 双月对比（{{ currency }}）</div>

    <a-spin :spinning="loading">
      <template v-if="summaryA && summaryB">
        <!-- 总计对比 -->
        <section class="report-section">
          <div class="section-title">总计对比</div>
          <a-table :columns="kpiColumns" :data-source="kpiRows" size="middle" :pagination="false" row-key="label" />
        </section>

        <!-- 各维度对比 + 涨跌幅 -->
        <section class="report-section" v-for="group in chartGroups" :key="group.name">
          <div class="section-title">{{ group.name }}</div>
          <div class="chart-grid">
            <template v-for="d in group.defs" :key="d.key">
              <ReportChartCard :title="`${group.name} · ${d.title}（${monthA} vs ${monthB}）`" :option="groupedOption(d)" height="300px" />
              <ReportChartCard :title="`${group.name} · ${d.title} · 涨跌幅`" :option="divergingOption(d)" height="300px" />
            </template>
          </div>
        </section>

        <!-- 集中度/风险分析：两个月各自展示 -->
        <section class="report-section">
          <div class="section-title">集中度 / 风险分析</div>
          <div v-for="p in PARETO_DEFS" :key="p.key" class="pareto-pair">
            <ParetoChartCard :title="`${p.title}（${monthA}）`" :rows="dimensionRowsA[p.key] || []" field="amount" :currency-prefix="currencyPrefix" />
            <ParetoChartCard :title="`${p.title}（${monthB}）`" :rows="dimensionRowsB[p.key] || []" field="amount" :currency-prefix="currencyPrefix" />
          </div>
        </section>

        <!-- 员工排名/对比 -->
        <section class="report-section">
          <div class="section-title">员工理论数据（按项目负责人/执行人员，基于合作跟踪记录现算）</div>
          <div class="chart-grid">
            <ReportChartCard title="项目负责人 · 项目毛利排名对比" :option="groupedOption(findDef('gross_manager'))" height="300px" />
            <ReportChartCard title="项目负责人 · 公司利润排名对比" :option="groupedOption(findDef('company_manager'))" height="300px" />
            <ReportChartCard title="项目负责人 · 提成排名对比"
              :option="buildGroupedBarOption(commissionRowsA, commissionRowsB, monthA, monthB, 'amount', currencyPrefix)" height="300px" />
            <ReportChartCard title="项目负责人/执行人员 · 内部执行成本对比"
              :option="buildGroupedBarOption(executionRowsA, executionRowsB, monthA, monthB, 'amount', currencyPrefix)" height="300px" />
          </div>
        </section>
      </template>
      <div v-else-if="!loading" class="empty-hint">选择两个月份后生成对比</div>
    </a-spin>
  </div>
</template>

<script setup>
import '../../echarts-setup'
import { ref, reactive, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { dashboardApi } from '../../api/index'
import { runLimited } from './report/useReportFetch'
import { delta, pctChange } from './report/deltaMath'
import { buildGroupedBarOption, buildDivergingBarOption } from './report/chartOptions'
import { KPI_METRICS, CHART_DEFS, CHART_GROUP_NAMES, PARETO_DEFS, findChartDef } from './report/reportDefs'
import ReportChartCard from './report/ReportChartCard.vue'
import ParetoChartCard from './report/ParetoChartCard.vue'

const monthAValue = ref(dayjs().subtract(1, 'month'))
const monthBValue = ref(dayjs())
const monthA = computed(() => monthAValue.value ? dayjs(monthAValue.value).format('YYYYMM') : null)
const monthB = computed(() => monthBValue.value ? dayjs(monthBValue.value).format('YYYYMM') : null)
const currency = ref('USD')
const currencyPrefix = computed(() => currency.value === 'RMB' ? '¥' : '$')
const loading = ref(false)

const summaryA = ref(null)
const summaryB = ref(null)
const dimensionRowsA = reactive({})
const dimensionRowsB = reactive({})
const commissionRowsA = ref([])
const commissionRowsB = ref([])
const executionRowsA = ref([])
const executionRowsB = ref([])

const findDef = findChartDef
const chartGroups = computed(() => CHART_GROUP_NAMES.map(name => ({ name, defs: CHART_DEFS.filter(d => d.group === name) })))

async function loadAll() {
  if (!monthA.value || !monthB.value) return
  loading.value = true
  const cur = currency.value
  const mA = monthA.value
  const mB = monthB.value

  // 双月对比是两个任意（不一定相邻）的自然月，不能像年度报告那样传区间——中间月份会被
  // 一并算进去，这里统一对现有单月接口各调用两次
  const taskDefs = []
  taskDefs.push({ key: 'summaryA', run: () => dashboardApi.summary(mA, cur) })
  taskDefs.push({ key: 'summaryB', run: () => dashboardApi.summary(mB, cur) })
  CHART_DEFS.forEach(d => {
    const fetcher = d.metric === 'video'
      ? (m) => dashboardApi.drilldownVideoCount(m, m, d.dim)
      : (m) => dashboardApi[d.apiName](m, m, cur, d.dim)
    taskDefs.push({ key: d.key + '_A', run: () => fetcher(mA) })
    taskDefs.push({ key: d.key + '_B', run: () => fetcher(mB) })
  })
  taskDefs.push({ key: 'commissionA', run: () => dashboardApi.drilldownCommission(mA, mA, cur) })
  taskDefs.push({ key: 'commissionB', run: () => dashboardApi.drilldownCommission(mB, mB, cur) })
  taskDefs.push({ key: 'executionA', run: () => dashboardApi.drilldownExecutionCost(mA, mA, cur, 'manager_executor') })
  taskDefs.push({ key: 'executionB', run: () => dashboardApi.drilldownExecutionCost(mB, mB, cur, 'manager_executor') })

  try {
    const results = await runLimited(taskDefs.map(t => t.run), 4)
    const byKey = {}
    taskDefs.forEach((t, idx) => { byKey[t.key] = results[idx] })

    summaryA.value = byKey.summaryA?.data || null
    summaryB.value = byKey.summaryB?.data || null
    CHART_DEFS.forEach(d => {
      dimensionRowsA[d.key] = byKey[d.key + '_A']?.data?.rows || []
      dimensionRowsB[d.key] = byKey[d.key + '_B']?.data?.rows || []
    })
    commissionRowsA.value = byKey.commissionA?.data?.rows || []
    commissionRowsB.value = byKey.commissionB?.data?.rows || []
    executionRowsA.value = byKey.executionA?.data?.rows || []
    executionRowsB.value = byKey.executionB?.data?.rows || []
  } finally {
    loading.value = false
  }
}

function fmtKpi(v, isCount) {
  const n = Number(v) || 0
  if (isCount) return n.toLocaleString('en-US') + '笔'
  return currencyPrefix.value + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const kpiColumns = computed(() => [
  { title: '指标', dataIndex: 'label', key: 'label' },
  { title: monthA.value, dataIndex: 'valueA', key: 'valueA' },
  { title: monthB.value, dataIndex: 'valueB', key: 'valueB' },
  { title: '差值', dataIndex: 'delta', key: 'delta' },
  { title: '涨跌幅', dataIndex: 'pct', key: 'pct' }
])
const kpiRows = computed(() => KPI_METRICS.map(k => {
  const a = summaryA.value?.[k.field]
  const b = summaryB.value?.[k.field]
  const pct = pctChange(a, b)
  const d = delta(a, b)
  return {
    label: k.label,
    valueA: fmtKpi(a, k.isCount),
    valueB: fmtKpi(b, k.isCount),
    delta: (d >= 0 ? '+' : '') + (k.isCount ? d.toLocaleString('en-US') : fmtKpi(d, false)),
    pct: pct == null ? '—' : `${pct >= 0 ? '▲' : '▼'} ${(Math.abs(pct) * 100).toFixed(1)}%`
  }
}))

function groupedOption(d) {
  if (!d) return {}
  return buildGroupedBarOption(dimensionRowsA[d.key] || [], dimensionRowsB[d.key] || [], monthA.value, monthB.value, d.field, currencyPrefix.value, { isCount: !!d.isCount })
}
function divergingOption(d) {
  return buildDivergingBarOption(dimensionRowsA[d.key] || [], dimensionRowsB[d.key] || [], d.field, currencyPrefix.value, { isCount: !!d.isCount })
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
.pareto-pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.empty-hint {
  text-align: center;
  color: #595959;
  padding: 60px 0;
}
</style>
