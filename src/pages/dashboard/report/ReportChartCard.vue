<template>
  <div class="report-chart-card">
    <div class="card-header">
      <span class="card-title">{{ title }}</span>
      <span v-if="subtitle" class="card-subtitle">{{ subtitle }}</span>
    </div>
    <v-chart ref="chartRef" class="card-chart" :option="mergedOption" :style="{ height }" autoresize />
    <div v-if="$slots.table" class="card-table">
      <a-collapse ghost>
        <a-collapse-panel key="table" header="查看明细表格">
          <slot name="table" />
        </a-collapse-panel>
      </a-collapse>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import VChart from 'vue-echarts'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  option: { type: Object, required: true },
  height: { type: String, default: '320px' },
  // ECharts 画布在打印时不会随 @media print 的 CSS 尺寸变化自动重排，必须在 beforeprint/
  // afterprint 里手动 resize，见 AnnualReportPage/TwoMonthComparisonPage 顶部注释——这里每个
  // 卡片各自监听，不需要父页面统一协调
  toolbox: { type: Boolean, default: true }
})

const chartRef = ref(null)

const mergedOption = computed(() => {
  if (!props.toolbox) return props.option
  return {
    ...props.option,
    toolbox: {
      right: 8,
      top: 0,
      feature: { saveAsImage: { title: '保存为图片' } },
      ...(props.option.toolbox || {})
    }
  }
})

function handlePrintResize() {
  chartRef.value?.resize()
}

onMounted(() => {
  window.addEventListener('beforeprint', handlePrintResize)
  window.addEventListener('afterprint', handlePrintResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', handlePrintResize)
  window.removeEventListener('afterprint', handlePrintResize)
})
</script>

<style scoped>
.report-chart-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
}
.card-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #262626;
}
.card-subtitle {
  font-size: 12px;
  color: #595959;
}
.card-chart {
  width: 100%;
}
.card-table {
  margin-top: 4px;
}
@media print {
  .report-chart-card {
    break-inside: avoid;
    box-shadow: none;
  }
}
</style>
