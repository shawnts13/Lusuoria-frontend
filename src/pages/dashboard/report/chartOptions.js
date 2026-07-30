// 年度报告/双月对比共用的 ECharts option 构建函数（2026-07 新增），避免两个页面各写一份。

function fmtFactory(prefix, isCount) {
  return (v) => {
    const n = Number(v) || 0
    if (isCount) return n.toLocaleString('en-US')
    return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
}

/** 单维度下钻：横向柱状图，降序，超过 maxCategories 截断为"其他" */
export function buildBarOption(rows, field, currencyPrefix, { maxCategories = 15, isCount = false } = {}) {
  const fmt = fmtFactory(currencyPrefix, isCount)
  let display = rows
  if (rows.length > maxCategories) {
    const head = rows.slice(0, maxCategories)
    const restSum = rows.slice(maxCategories).reduce((s, r) => s + (Number(r[field]) || 0), 0)
    display = [...head, { dimensionLabel: '其他', [field]: restSum }]
  }
  const cats = display.map(r => r.dimensionLabel).reverse()
  const vals = display.map(r => Number(r[field]) || 0).reverse()
  return {
    grid: { left: 120, right: 24, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: cats },
    series: [{ type: 'bar', data: vals, itemStyle: { color: '#2a78d6' }, barMaxWidth: 22 }]
  }
}

/** 单指标折线趋势（月度/季度） */
export function buildLineOption(categories, values, currencyPrefix, { isCount = false } = {}) {
  const fmt = fmtFactory(currencyPrefix, isCount)
  return {
    grid: { left: 60, right: 24, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis', valueFormatter: fmt },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: values, itemStyle: { color: '#2a78d6' }, areaStyle: { opacity: 0.08 } }]
  }
}

/** 单指标柱状趋势（季度对比更适合柱状而不是折线，4个类别） */
export function buildColumnOption(categories, values, currencyPrefix, { isCount = false } = {}) {
  const fmt = fmtFactory(currencyPrefix, isCount)
  return {
    grid: { left: 60, right: 24, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: values, itemStyle: { color: '#2a78d6' }, barMaxWidth: 60 }]
  }
}

/**
 * 双月对比：同一维度两个系列（monthA/monthB）分组横向柱状图。
 * rowsA/rowsB 是两个月各自的下钻行；按并集类别对齐，缺失的补0。
 */
export function buildGroupedBarOption(rowsA, rowsB, labelA, labelB, field, currencyPrefix,
                                       { maxCategories = 15, isCount = false } = {}) {
  const fmt = fmtFactory(currencyPrefix, isCount)
  const mapA = new Map(rowsA.map(r => [r.dimensionLabel, Number(r[field]) || 0]))
  const mapB = new Map(rowsB.map(r => [r.dimensionLabel, Number(r[field]) || 0]))
  // 类别顺序：按两个月合计降序，取前 maxCategories
  const allLabels = Array.from(new Set([...mapA.keys(), ...mapB.keys()]))
  allLabels.sort((x, y) => ((mapB.get(y) || 0) + (mapA.get(y) || 0)) - ((mapB.get(x) || 0) + (mapA.get(x) || 0)))
  const display = allLabels.slice(0, maxCategories).reverse()
  return {
    grid: { left: 120, right: 24, top: 30, bottom: 24 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
    legend: { top: 0, data: [labelA, labelB] },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: display },
    series: [
      { name: labelA, type: 'bar', data: display.map(l => mapA.get(l) || 0), itemStyle: { color: '#2a78d6' } },
      { name: labelB, type: 'bar', data: display.map(l => mapB.get(l) || 0), itemStyle: { color: '#fa8c16' } }
    ]
  }
}

/**
 * 涨跌幅：发散型横向柱状图，蓝表示增加、红表示减少（方向，不是好坏判断）。
 */
export function buildDivergingBarOption(rowsA, rowsB, field, currencyPrefix, { maxCategories = 15, isCount = false } = {}) {
  const fmt = fmtFactory(currencyPrefix, isCount)
  const mapA = new Map(rowsA.map(r => [r.dimensionLabel, Number(r[field]) || 0]))
  const mapB = new Map(rowsB.map(r => [r.dimensionLabel, Number(r[field]) || 0]))
  const allLabels = Array.from(new Set([...mapA.keys(), ...mapB.keys()]))
  const withDelta = allLabels.map(l => ({ label: l, delta: (mapB.get(l) || 0) - (mapA.get(l) || 0) }))
  withDelta.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
  const display = withDelta.slice(0, maxCategories).reverse()
  return {
    grid: { left: 120, right: 24, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmt },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: display.map(d => d.label) },
    series: [{
      type: 'bar',
      data: display.map(d => ({
        value: d.delta,
        itemStyle: { color: d.delta >= 0 ? '#2a78d6' : '#d4380d' }
      })),
      barMaxWidth: 22
    }]
  }
}
