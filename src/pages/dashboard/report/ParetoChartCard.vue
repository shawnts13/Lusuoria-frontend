<template>
  <div class="pareto-card">
    <div class="pareto-header">
      <span class="pareto-title">{{ title }} · 集中度/风险分析</span>
      <span class="pareto-caveat" v-if="caveat">{{ caveat }}</span>
    </div>

    <div class="pareto-headline">
      <div class="headline-text">
        前 {{ topN }} 名合计占比
        <b class="headline-value">{{ (topShare * 100).toFixed(1) }}%</b>
      </div>
      <a-progress :percent="Math.round(topShare * 1000) / 10" :show-info="false" stroke-color="#2a78d6" />
    </div>

    <ReportChartCard
      :title="`${title}（原始金额，降序，前 ${cappedRows.length} 项）`"
      :option="barOption"
      :height="barChartHeightPx"
    />
    <ReportChartCard
      :title="`${title} · 累计占比`"
      subtitle="虚线为 80% 参考线"
      :option="lineOption"
      height="220px"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ReportChartCard from './ReportChartCard.vue'
import { topNShare, cumulativeShareCurve } from './deltaMath'
import { barChartHeight } from './chartOptions'

const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] }, // 已按 field 降序排好的下钻行
  field: { type: String, default: 'amount' },
  currencyPrefix: { type: String, default: '$' },
  topN: { type: Number, default: 5 },
  caveat: { type: String, default: '' },
  maxCategories: { type: Number, default: 15 }
})

function fmt(v) {
  const n = Number(v) || 0
  return props.currencyPrefix + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// 图表只展示前 N 项，避免类别过多时柱状图/曲线图挤在一起看不清；集中度占比计算用全量 rows，
// 不受这个截断影响
const cappedRows = computed(() => {
  if (props.rows.length <= props.maxCategories) return props.rows
  const head = props.rows.slice(0, props.maxCategories)
  const restSum = props.rows.slice(props.maxCategories)
    .reduce((s, r) => s + (Number(r[props.field]) || 0), 0)
  return [...head, { dimensionLabel: '其他', [props.field]: restSum }]
})

const topShare = computed(() => topNShare(props.rows, props.topN, props.field))

const barOption = computed(() => {
  const cats = cappedRows.value.map(r => r.dimensionLabel).reverse()
  const vals = cappedRows.value.map(r => Number(r[props.field]) || 0).reverse()
  return {
    grid: { left: 120, right: 24, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: cats, axisLabel: { interval: 0 } },
    series: [{ type: 'bar', data: vals, itemStyle: { color: '#2a78d6' }, barMaxWidth: 22 }]
  }
})
const barChartHeightPx = computed(() => barChartHeight(cappedRows.value.length || 1))

const lineOption = computed(() => {
  const cats = cappedRows.value.map(r => r.dimensionLabel)
  const curve = cumulativeShareCurve(cappedRows.value, props.field)
  return {
    grid: { left: 50, right: 24, top: 20, bottom: 40 },
    tooltip: { trigger: 'axis', valueFormatter: v => v.toFixed(1) + '%' },
    xAxis: { type: 'category', data: cats, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'line',
      data: curve,
      itemStyle: { color: '#2a78d6' },
      markLine: {
        symbol: 'none',
        lineStyle: { type: 'dashed', color: '#fa8c16' },
        data: [{ yAxis: 80, label: { formatter: '80%' } }]
      }
    }]
  }
})
</script>

<style scoped>
.pareto-card {
  margin-bottom: 24px;
}
.pareto-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.pareto-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}
.pareto-caveat {
  font-size: 12px;
  color: #8c8c8c;
}
.pareto-headline {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 12px;
  background: #fafafa;
}
.headline-text {
  font-size: 13px;
  color: #595959;
  margin-bottom: 8px;
}
.headline-value {
  font-size: 22px;
  color: #262626;
  margin-left: 6px;
}
</style>
