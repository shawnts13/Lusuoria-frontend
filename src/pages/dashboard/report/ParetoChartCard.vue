<template>
  <div class="pareto-card">
    <div class="pareto-header">
      <span class="pareto-title">{{ title }} · 集中度/风险分析</span>
      <span class="pareto-caveat" v-if="caveat">{{ caveat }}</span>
    </div>

    <div v-if="tooFewToAnalyze" class="pareto-too-few">
      该维度目前只有 {{ props.rows.length }} 个分类，分类太少时"前N名占比"没有参考意义
      （比如只有3个品牌方时，"前5名占比"永远约等于100%），暂不做集中度分析。
    </div>
    <template v-else>
      <div class="pareto-headline">
        <div class="headline-text">
          前 {{ effectiveTopN }} 名（共 {{ props.rows.length }} 个）合计占比
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
    </template>
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

// 分类数太少时（比如目前只有3个品牌方），"前 topN 名占比"这个统计没有意义——不管 topN 设多少，
// 结果都约等于100%，反而误导人。改成：
//   1. 分类数 <=2 时干脆不做集中度分析（任意1-2个分类的"集中度"都是没有信息量的伪命题）；
//   2. 分类数更多时，实际展示的 N 动态收缩到"总数减一"以内（保证"前N名"确实是一部分而不是
//      全部），同时把分母（共几个分类）显示出来，不再是一个孤零零、脱离上下文的固定"前5名"。
const tooFewToAnalyze = computed(() => props.rows.length <= 2)
const effectiveTopN = computed(() => Math.max(1, Math.min(props.topN, props.rows.length - 1)))

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

const topShare = computed(() => topNShare(props.rows, effectiveTopN.value, props.field))

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
.pareto-too-few {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 14px 18px;
  background: #fafafa;
  color: #595959;
  font-size: 13px;
}
</style>
