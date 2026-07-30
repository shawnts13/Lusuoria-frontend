<template>
  <div class="trend-card">
    <div class="trend-header">
      <span class="trend-title">{{ title }}</span>
      <a-space :size="12" wrap>
        <a-radio-group v-model:value="metric" button-style="solid" size="small">
          <a-radio-button v-for="m in metricOptions" :key="m.value" :value="m.value">{{ m.label }}</a-radio-button>
        </a-radio-group>
        <a-select
          v-model:value="selectedNames"
          mode="multiple"
          size="small"
          style="min-width:260px"
          placeholder="选择要显示的人员"
          :max-tag-count="4"
          :options="allNameOptions"
        />
      </a-space>
    </div>

    <ReportChartCard :title="`${title} · ${metricLabel}`" :option="lineOption" height="340px" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ReportChartCard from './ReportChartCard.vue'

const props = defineProps({
  title: { type: String, required: true },
  trendData: { type: Object, default: () => ({ months: [], series: [] }) },
  currencyPrefix: { type: String, default: '$' },
  role: { type: String, default: 'manager' }, // manager | executor
  defaultCount: { type: Number, default: 6 }
})

const MANAGER_METRICS = [
  { value: 'videoCount', label: '视频数量' },
  { value: 'clientPrice', label: '客户合作价格' },
  { value: 'grossProfit', label: '项目毛利' },
  { value: 'companyProfit', label: '公司利润' },
  { value: 'commissionAmount', label: '提成' }
]
const EXECUTOR_METRICS = [
  { value: 'videoCount', label: '视频数量' },
  { value: 'internalExecutionCost', label: '内部执行成本' }
]
const metricOptions = computed(() => props.role === 'executor' ? EXECUTOR_METRICS : MANAGER_METRICS)
const metric = ref(metricOptions.value[0]?.value || 'videoCount')
watch(() => props.role, () => { metric.value = metricOptions.value[0]?.value || 'videoCount' })

const metricLabel = computed(() => metricOptions.value.find(m => m.value === metric.value)?.label || '')

const allNameOptions = computed(() =>
  (props.trendData.series || []).map(s => ({ value: s.managerName, label: s.managerName })))

// 默认只显示总量前N名（series 后端已按总量降序排好），避免同屏系列数超过色板可辨识上限
const selectedNames = ref([])
watch(() => props.trendData, (data) => {
  selectedNames.value = (data.series || []).slice(0, props.defaultCount).map(s => s.managerName)
}, { immediate: true })

function fmt(v) {
  const n = Number(v) || 0
  if (metric.value === 'videoCount') return n.toLocaleString('en-US')
  return props.currencyPrefix + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const lineOption = computed(() => {
  const months = props.trendData.months || []
  const selected = (props.trendData.series || []).filter(s => selectedNames.value.includes(s.managerName))
  return {
    grid: { left: 60, right: 24, top: 32, bottom: 60 },
    tooltip: { trigger: 'axis', valueFormatter: fmt },
    legend: { bottom: 0, type: 'scroll' },
    xAxis: { type: 'category', data: months, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } },
    yAxis: { type: 'value' },
    series: selected.map(s => ({
      name: s.managerName,
      type: 'line',
      data: s.monthly.map(m => Number(m[metric.value]) || 0)
    }))
  }
})
</script>

<style scoped>
.trend-card {
  margin-bottom: 24px;
}
.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.trend-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}
</style>
