// 年度报告 + 双月对比共用的维度/指标定义（2026-07 新增），只维护一份，避免两个页面各写一份
// 导致以后新增/改维度时漏改其中一个。

export const KPI_METRICS = [
  { field: 'videoProjectCount', label: '视频项目数量', isCount: true },
  { field: 'totalClientPrice', label: '客户合作价格' },
  { field: 'totalInfluencerCost', label: '红人成本' },
  { field: 'totalGrossProfit', label: '项目毛利' },
  { field: 'totalInternalExecutionCostForProfit', label: '内部执行人力成本（计入利润部分）' },
  { field: 'totalCommissionAmount', label: '负责人提成合计（含Bonus）' },
  { field: 'totalCompanyProfit', label: '公司利润' }
]

// 仅年度报告的月度趋势/季度对比用（双月对比只有2个点，不需要趋势线）
export const TREND_METRICS = [
  { field: 'videoProjectCount', label: '视频项目数量', isCount: true },
  { field: 'totalClientPrice', label: '客户合作价格' },
  { field: 'totalGrossProfit', label: '项目毛利' },
  { field: 'totalCompanyProfit', label: '公司利润' }
]

export const CHART_DEFS = [
  { key: 'video_brand', group: '视频数量', title: '按品牌方', metric: 'video', dim: 'brand', field: 'videoCount', isCount: true },
  { key: 'video_manager', group: '视频数量', title: '按项目负责人', metric: 'video', dim: 'manager', field: 'videoCount', isCount: true },
  { key: 'video_executor', group: '视频数量', title: '按执行人员', metric: 'video', dim: 'executor', field: 'videoCount', isCount: true },
  { key: 'video_country', group: '视频数量', title: '按服务国家/市场', metric: 'video', dim: 'countryMarket', field: 'videoCount', isCount: true },
  { key: 'video_platform', group: '视频数量', title: '按合作平台', metric: 'video', dim: 'platform', field: 'videoCount', isCount: true },

  { key: 'price_brand', group: '客户合作价格', title: '按品牌方', metric: 'clientPrice', apiName: 'drilldownClientPrice', dim: 'brand', field: 'amount' },
  { key: 'price_manager', group: '客户合作价格', title: '按项目负责人', metric: 'clientPrice', apiName: 'drilldownClientPrice', dim: 'manager', field: 'amount' },
  { key: 'price_country', group: '客户合作价格', title: '按服务国家/市场', metric: 'clientPrice', apiName: 'drilldownClientPrice', dim: 'countryMarket', field: 'amount' },
  { key: 'price_platform', group: '客户合作价格', title: '按合作平台', metric: 'clientPrice', apiName: 'drilldownClientPrice', dim: 'platform', field: 'amount' },

  { key: 'cost_brand', group: '红人成本', title: '按品牌方', metric: 'influencerCost', apiName: 'drilldownInfluencerCost', dim: 'brand', field: 'amount' },
  { key: 'cost_country', group: '红人成本', title: '按服务国家/市场', metric: 'influencerCost', apiName: 'drilldownInfluencerCost', dim: 'countryMarket', field: 'amount' },
  { key: 'cost_platform', group: '红人成本', title: '按合作平台', metric: 'influencerCost', apiName: 'drilldownInfluencerCost', dim: 'platform', field: 'amount' },

  { key: 'gross_brand', group: '项目毛利', title: '按品牌方', metric: 'grossProfit', apiName: 'drilldownGrossProfit', dim: 'brand', field: 'amount' },
  { key: 'gross_team', group: '项目毛利', title: '按红人团队', metric: 'grossProfit', apiName: 'drilldownGrossProfit', dim: 'team', field: 'amount' },
  { key: 'gross_manager', group: '项目毛利', title: '按项目负责人', metric: 'grossProfit', apiName: 'drilldownGrossProfit', dim: 'manager', field: 'amount' },
  { key: 'gross_country', group: '项目毛利', title: '按服务国家/市场', metric: 'grossProfit', apiName: 'drilldownGrossProfit', dim: 'countryMarket', field: 'amount' },
  { key: 'gross_platform', group: '项目毛利', title: '按合作平台', metric: 'grossProfit', apiName: 'drilldownGrossProfit', dim: 'platform', field: 'amount' },

  { key: 'company_brand', group: '公司利润', title: '按品牌方', metric: 'companyProfit', apiName: 'drilldownCompanyProfit', dim: 'brand', field: 'amount' },
  { key: 'company_team', group: '公司利润', title: '按红人团队', metric: 'companyProfit', apiName: 'drilldownCompanyProfit', dim: 'team', field: 'amount' },
  { key: 'company_manager', group: '公司利润', title: '按项目负责人', metric: 'companyProfit', apiName: 'drilldownCompanyProfit', dim: 'manager', field: 'amount' }
]

export const CHART_GROUP_NAMES = ['视频数量', '客户合作价格', '红人成本', '项目毛利', '公司利润']

// 集中度/风险分析：复用"项目毛利"下钻数据（brand/team/manager/countryMarket），不额外发请求；
// platform 因为多值计数占比之和会超过100%，不做集中度分析
export const PARETO_DEFS = [
  { key: 'gross_brand', title: '品牌方 · 项目毛利' },
  { key: 'gross_team', title: '红人团队 · 项目毛利' },
  { key: 'gross_manager', title: '项目负责人 · 项目毛利' },
  { key: 'gross_country', title: '服务国家/市场 · 项目毛利' }
]

export const PIVOT_DEFS = [
  { key: 'pivot_brand_country', title: '品牌方 × 服务国家/市场', row: 'brand', col: 'countryMarket' },
  { key: 'pivot_brand_platform', title: '品牌方 × 合作平台', row: 'brand', col: 'platform' },
  { key: 'pivot_team_country', title: '红人团队 × 服务国家/市场', row: 'team', col: 'countryMarket' }
]

export function findChartDef(key) {
  return CHART_DEFS.find(d => d.key === key)
}
