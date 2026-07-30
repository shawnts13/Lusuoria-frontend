// 年度报告/双月对比用的纯函数：涨跌幅、环比、集中度占比。不依赖任何请求，
// 都是对已经拉取回来的数据做二次计算，2026-07 新增。

/** b 相对 a 的差值 */
export function delta(a, b) {
  return (Number(b) || 0) - (Number(a) || 0)
}

/** b 相对 a 的涨跌幅（a 为 0 时涨跌幅没有意义，返回 null，前端显示"—"） */
export function pctChange(a, b) {
  const x = Number(a) || 0
  const y = Number(b) || 0
  if (x === 0) return null
  return (y - x) / Math.abs(x)
}

/**
 * 相邻元素两两求差值/涨跌幅（环比）。
 * @param arr 顺序数组（如按月排好序的 monthly 数组，或按季度排好序的 4 个季度总计）
 * @param field 取哪个字段参与计算
 * @returns [{ delta, pct }]，长度比 arr 少 1（第一项没有"上一期"可比）
 */
export function sequentialDeltas(arr, field) {
  const result = []
  for (let i = 1; i < arr.length; i++) {
    const prev = Number(arr[i - 1]?.[field]) || 0
    const cur = Number(arr[i]?.[field]) || 0
    result.push({ delta: cur - prev, pct: prev === 0 ? null : (cur - prev) / Math.abs(prev) })
  }
  return result
}

/**
 * 集中度分析：前 N 名占总体的比例。
 * @param rows 已按 field 降序排好序的行（下钻接口返回的 rows 本身就是降序的）
 */
export function topNShare(rows, n, field = 'amount') {
  const total = rows.reduce((s, r) => s + (Number(r[field]) || 0), 0)
  if (total === 0) return 0
  const topSum = rows.slice(0, n).reduce((s, r) => s + (Number(r[field]) || 0), 0)
  return topSum / total
}

/**
 * 累计占比曲线（Pareto 图的折线部分），保持传入顺序（应传已降序排好的 rows）。
 * @returns 每一项对应的"累计到这一项为止占总体的百分比"（0-100）
 */
export function cumulativeShareCurve(rows, field = 'amount') {
  const total = rows.reduce((s, r) => s + (Number(r[field]) || 0), 0)
  let running = 0
  return rows.map(r => {
    running += Number(r[field]) || 0
    return total === 0 ? 0 : (running / total) * 100
  })
}
