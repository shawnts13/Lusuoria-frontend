// 进度提醒的类别/紧急程度中文标签+颜色映射（2026-07-29 从 ProgressReminderCardList.vue 抽出来
// 共享，供卡片列表和详情弹窗标题统一使用，避免各写一份容易走偏）

export const CATEGORY_LABEL = {
  COLLAB_PAYMENT_DUE: '红人合作跟踪临近结款',
  INFLUENCER_PAYMENT_DUE: '红人结款临近付款日',
  PM_EXECUTOR_PROGRESS_STALL: '进度滞留-项目',
  FINANCE_PROGRESS_STALL: '进度滞留-财务',
  REQUIREMENT_INVOICE_OVERDUE: 'Invoice逾期',
  REQUIREMENT_CONTRACT_OVERDUE: '合同上传逾期',
  CONTRACT_EXPIRING_SOON: '合同即将到期',
  INFLUENCER_PAYMENT_RECEIPT_OVERDUE: '红人结款上传发票逾期'
}

// 跟后端 ReminderUrgency 保持一致：0天或已超期=红，1-3天=橙，3-7天=绿（"临近提醒"方向，倒数天数）
const URGENCY_COLOR = { OVERDUE: 'red', NEAR: 'orange', UPCOMING: 'green' }
const URGENCY_LABEL = { OVERDUE: '0天或已超期', NEAR: '1-3天', UPCOMING: '3-7天' }
// "进度滞留-财务"用的是同一套 ReminderUrgency，但语义是"距离阈值还有几天"，光写"1-3天"/"3-7天"
// 容易让人搞不清是"已经超了几天"还是"还剩几天"，这里单独换一套更明确的文案；
// COLLAB_PAYMENT_DUE 保持原样不变
const FINANCE_URGENCY_LABEL = { OVERDUE: '0天或已超期', NEAR: '距离超期还剩1-3天', UPCOMING: '距离超期还剩3-7天' }
// "合同即将到期"也是同一套 ReminderUrgency，但语义是"距离合同到期还有几天"，窗口是0/14/30天
// （不是原来的0/3/7天），颜色也换成黄/橙/红，单独一套映射，不跟其他类别混用
const CONTRACT_EXPIRY_URGENCY_LABEL = { OVERDUE: '0天或已过期', NEAR: '1-14天', UPCOMING: '14-30天' }
const CONTRACT_EXPIRY_URGENCY_COLOR = { OVERDUE: 'red', NEAR: 'orange', UPCOMING: 'gold' }
// 跟后端 OverdueUrgency 保持一致：1-3天=黄，3-7天=橙，超出7天=红（"超期提醒"方向，正数累加）
const OVERDUE_COLOR = { MILD: 'gold', MODERATE: 'orange', SEVERE: 'red' }
const OVERDUE_LABEL = { MILD: '1-3天', MODERATE: '3-7天', SEVERE: '超出7天' }

export function isOverdueStyle(r) { return r.overdueUrgency != null }

export function urgencyColor(r) {
  if (isOverdueStyle(r)) return OVERDUE_COLOR[r.overdueUrgency] || 'default'
  if (r.category === 'CONTRACT_EXPIRING_SOON') return CONTRACT_EXPIRY_URGENCY_COLOR[r.urgency] || 'default'
  return URGENCY_COLOR[r.urgency] || 'default'
}

export function urgencyLabel(r) {
  if (isOverdueStyle(r)) return OVERDUE_LABEL[r.overdueUrgency] || r.overdueUrgency
  if (r.category === 'CONTRACT_EXPIRING_SOON') return CONTRACT_EXPIRY_URGENCY_LABEL[r.urgency] || r.urgency
  const labels = r.category === 'FINANCE_PROGRESS_STALL' ? FINANCE_URGENCY_LABEL : URGENCY_LABEL
  return labels[r.urgency] || r.urgency
}

export function categoryLabel(c) { return CATEGORY_LABEL[c] || c }

// 分类小标签用中性色，跟严重度色（红/橙/黄/绿）区分开，不会互相干扰
export function categoryTagColor(c) {
  return ['PM_EXECUTOR_PROGRESS_STALL', 'FINANCE_PROGRESS_STALL', 'REQUIREMENT_INVOICE_OVERDUE',
    'REQUIREMENT_CONTRACT_OVERDUE', 'CONTRACT_EXPIRING_SOON',
    'INFLUENCER_PAYMENT_RECEIPT_OVERDUE'].includes(c) ? 'purple' : 'blue'
}
