<template>
  <div class="pivot-card">
    <div class="pivot-header">
      <span class="pivot-title">{{ title }}</span>
      <a-radio-group v-model:value="metric" button-style="solid" size="small">
        <a-radio-button value="videoCount">视频数量</a-radio-button>
        <a-radio-button value="clientPrice">客户合作价格</a-radio-button>
        <a-radio-button value="grossProfit">项目毛利</a-radio-button>
        <a-radio-button value="companyProfit">公司利润</a-radio-button>
      </a-radio-group>
    </div>

    <ReportChartCard :title="`${title}（${metricLabel}）`" :option="heatmapOption" :height="chartHeight" />

    <a-collapse ghost>
      <a-collapse-panel key="table" header="查看完整明细表格（含未在热力图中显示的部分）">
        <a-table :columns="tableColumns" :data-source="tableRows" size="small" row-key="key"
          :pagination="{ pageSize: 20, showTotal: t => `共 ${t} 条` }" />
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import ReportChartCard from './ReportChartCard.vue'

const props = defineProps({
  title: { type: String, required: true },
  pivotData: { type: Object, default: () => ({ rowLabels: [], colLabels: [], cells: [] }) },
  currencyPrefix: { type: String, default: '$' },
  maxRows: { type: Number, default: 15 }
})

const metric = ref('clientPrice')
const metricLabels = {
  videoCount: '视频数量',
  clientPrice: '客户合作价格',
  grossProfit: '项目毛利',
  companyProfit: '公司利润'
}
const metricLabel = computed(() => metricLabels[metric.value])

function fmtValue(v) {
  const n = Number(v) || 0
  if (metric.value === 'videoCount') return n.toLocaleString('en-US')
  return props.currencyPrefix + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// rowLabels 后端已按行合计降序返回，这里只截断热力图渲染用的行数，完整明细表不受影响
const displayRows = computed(() => (props.pivotData.rowLabels || []).slice(0, props.maxRows))
const chartHeight = computed(() => Math.max(220, displayRows.value.length * 28 + 80) + 'px')

const heatmapOption = computed(() => {
  const rows = displayRows.value
  const cols = props.pivotData.colLabels || []
  const rowIndex = new Map(rows.map((r, i) => [r, i]))
  const colIndex = new Map(cols.map((c, i) => [c, i]))
  const data = []
  let maxVal = 0
  for (const cell of props.pivotData.cells || []) {
    if (!rowIndex.has(cell.rowLabel) || !colIndex.has(cell.colLabel)) continue
    const v = Number(cell[metric.value]) || 0
    maxVal = Math.max(maxVal, v)
    data.push([colIndex.get(cell.colLabel), rowIndex.get(cell.rowLabel), v])
  }
  return {
    grid: { left: 140, right: 24, top: 10, bottom: 60 },
    tooltip: {
      position: 'top',
      formatter: p => `${rows[p.value[1]]} × ${cols[p.value[0]]}<br/>${metricLabel.value}：${fmtValue(p.value[2])}`
    },
    xAxis: { type: 'category', data: cols, splitArea: { show: true }, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } },
    yAxis: { type: 'category', data: rows, splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: maxVal || 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#eaf2fb', '#2a78d6'] }
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } }
    }]
  }
})

const tableColumns = computed(() => [
  { title: props.title.split('×')[0]?.trim() || '行', dataIndex: 'rowLabel', key: 'rowLabel' },
  { title: props.title.split('×')[1]?.trim() || '列', dataIndex: 'colLabel', key: 'colLabel' },
  { title: metricLabel.value, dataIndex: 'value', key: 'value' }
])
const tableRows = computed(() => (props.pivotData.cells || [])
  .map((c, i) => ({ key: i, rowLabel: c.rowLabel, colLabel: c.colLabel, value: fmtValue(c[metric.value]) }))
  .sort((a, b) => (Number(props.pivotData.cells[b.key][metric.value]) || 0) - (Number(props.pivotData.cells[a.key][metric.value]) || 0)))
</script>

<style scoped>
.pivot-card {
  margin-bottom: 24px;
}
.pivot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.pivot-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}
</style>
