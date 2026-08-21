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

// 沿着"待客户出brief → ... → 已收到客户回款"这条流水线渐进上色：早期阶段用中性色，
// 越接近完成越暖/越亮，"已收到客户回款"是真正的终态用绿色，"折损"是异常终态用红色。
// 提取自 CollaborationListPage.vue，供红人结款/进度提醒等其他也展示"视频项目进度"的
// 页面共用，不用各自复制一份
const COLLAB_PROGRESS_COLOR = {
  // 2026-08-17 新增"待红人下单"，插在"合同已发给红人"和"红人已下单"之间——跟这两个一样是
  // 还没真正开始拍摄制作的早期阶段，沿用同一档中性色
  PENDING_CLIENT_BRIEF: 'default', CONTRACT_SENT: 'default', PENDING_INFLUENCER_ORDER: 'default',
  INFLUENCER_ORDERED: 'purple',
  SHOOTING_GUIDE_SENT: 'purple',
  // 2026-08-21 新增"待客户给草稿反馈"，插在"待草稿"和"待红人修改"之间——单独一档颜色
  // (magenta)，跟"待红人修改"(gold)区分开：一个是等客户反馈，一个是等红人动手改
  PENDING_DRAFT: 'default', PENDING_CLIENT_DRAFT_FEEDBACK: 'magenta',
  PENDING_PUBLISH: 'orange', PENDING_REVISION: 'gold',
  PUBLISHED_UNSETTLED: 'blue', JOINED_CLIENT_UNSETTLED_LIST: 'cyan',
  // 2026-08-21："客户已结算"不再是终态（改成"已收到客户回款"之后才算），原来的绿色让给
  // PAYMENT_RECEIVED，SETTLED 改用 lime（比 cyan 更暖、比 green 淡，体现"快到了但还没完全
  // 结束"），保持"越接近完成越暖/越亮"的渐进逻辑
  SETTLED: 'lime', PAYMENT_RECEIVED: 'green', DELAYED: 'red'
}

export function collabProgressColor(value) {
  return COLLAB_PROGRESS_COLOR[value] || 'default'
}

// 项目视频类型是分类，不是状态，随便挑几个能区分开的颜色
const VIDEO_TYPE_COLOR = {
  REAL_SHOT_NEW: 'blue', REAL_SHOT_NEW_PHOTO: 'cyan',
  AI_NEW_MATERIAL: 'purple', OLD_MATERIAL_REPOST: 'default'
}

export function videoTypeColor(value) {
  return VIDEO_TYPE_COLOR[value] || 'default'
}
