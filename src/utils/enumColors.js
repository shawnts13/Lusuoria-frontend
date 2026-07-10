/**
 * 有明确业务含义的枚举 -> 标签颜色映射（区别于 tagColor.js 那种"任意字符串随便分个颜色"）。
 * 这里的颜色是按状态是否终态/是否异常特意选的，不是随便分配的，所以要跨组件共用同一份映射，
 * 不能各自复制一份容易改歪。
 */

// "已纳入红人结款批次（缺少invoice）"是异常情况（本不该在没有invoice时被纳入批次）用红色；
// "待红人发送invoice"是待办/需要跟进用橙色；"已纳入红人结款批次"是正常终态用绿色；
// 中间这两个（已提供invoice / 待结款不涉及invoice）都是"没有invoice障碍、等待被选入结款批次"
// 的中间态，性质相同，统一用粉色
const PAYMENT_PROGRESS_COLOR = {
  PENDING_INVOICE: 'orange',
  INVOICE_PROVIDED: 'pink',
  PENDING_SETTLEMENT_NO_INVOICE: 'pink',
  INCLUDED_IN_PAYMENT_BATCH: 'green',
  INCLUDED_IN_PAYMENT_BATCH_MISSING_INVOICE: 'red'
}

export function paymentProgressColor(value) {
  return PAYMENT_PROGRESS_COLOR[value] || 'default'
}
