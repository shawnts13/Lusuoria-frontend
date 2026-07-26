// 执行人员薪资梯度 - 展示格式化工具，供"员工管理"/"执行人员管理"列表的"薪资标准"列复用

export const VIDEO_TYPE_LABELS = {
  REAL_SHOT_NEW: '实拍新视频',
  REAL_SHOT_NEW_PHOTO: '实拍新图片',
  AI_NEW_MATERIAL: 'AI新素材',
  OLD_MATERIAL_REPOST: '旧素材重发'
}
export const VIDEO_TYPES = Object.keys(VIDEO_TYPE_LABELS)

function fmtMoney(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 单个档位的展示文案，如 "¥30.00/条" 或 "51条+：¥20.00/条，当月封顶¥3000.00" */
function formatTier(tier, showRange) {
  const rangeLabel = showRange
    ? (tier.maxCount == null
        ? `${tier.minCount}条+：`
        : tier.minCount === tier.maxCount ? `第${tier.minCount}条：` : `${tier.minCount}-${tier.maxCount}条：`)
    : ''
  const capLabel = tier.monthlyCap != null ? `，当月封顶¥${fmtMoney(tier.monthlyCap)}` : ''
  return `${rangeLabel}¥${fmtMoney(tier.rate)}/条${capLabel}`
}

/** 某个视频类型下配置的档位列表 -> 展示文案；未配置（空数组/未传）返回 null */
export function formatVideoTypeTiers(tiers) {
  if (!tiers || tiers.length === 0) return null
  const sorted = [...tiers].sort((a, b) => (a.minCount || 0) - (b.minCount || 0))
  return sorted.map(t => formatTier(t, sorted.length > 1)).join('；')
}
