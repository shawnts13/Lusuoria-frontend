// 数据看板年度报告/双月对比专用的 ECharts 按需注册（2026-07 新增）。
// 只在 AnnualReportPage.vue / TwoMonthComparisonPage.vue 里 import 这个文件，不放进 main.js——
// 这两个页面本身是路由懒加载的，放进 main.js 会让 echarts 变成每个页面都要加载的主包体积。
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, HeatmapChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  VisualMapComponent,
  MarkLineComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  VisualMapComponent,
  MarkLineComponent
])
