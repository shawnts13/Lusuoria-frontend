<template>
  <a-spin :spinning="loading">
    <div v-if="reminders.length" class="reminder-cards">
      <div v-for="r in reminders" :key="r.id" class="reminder-card" :class="'urgency-' + urgencyColor(r)">
        <div class="card-main">
          <a-tag :color="categoryTagColor(r.category)" class="category-tag">{{ categoryLabel(r.category) }}</a-tag>
          <a-tag :color="urgencyColor(r)">{{ urgencyLabel(r) }}</a-tag>
          <span class="card-text" :style="{ color: textColor(r) }">{{ r.title }}</span>
        </div>
        <a v-if="showDetailButton && r.category !== 'BRAND_MONTH_END_PAYMENT_DUE'" @click="$emit('view-detail', r)">查看详情</a>
      </div>
    </div>
    <a-empty v-else description="暂无进度提醒" style="margin:24px 0" />
  </a-spin>
</template>

<script setup>
defineProps({
  reminders: { type: Array, default: () => [] },
  showDetailButton: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
})
defineEmits(['view-detail'])

// 跟后端 ReminderUrgency 保持一致：0天或已超期=红，1-3天=橙，3-7天=绿（"临近提醒"方向，倒数天数）
const URGENCY_COLOR = { OVERDUE: 'red', NEAR: 'orange', UPCOMING: 'green' }
const URGENCY_LABEL = { OVERDUE: '0天或已超期', NEAR: '1-3天', UPCOMING: '3-7天' }
// 跟后端 OverdueUrgency 保持一致：1-3天=黄，3-7天=橙，超出7天=红（"超期提醒"方向，正数累加）
const OVERDUE_COLOR = { MILD: 'gold', MODERATE: 'orange', SEVERE: 'red' }
const OVERDUE_LABEL = { MILD: '1-3天', MODERATE: '3-7天', SEVERE: '超出7天' }
// 卡片文字颜色：比左边框/徽标用的鲜艳色稍深，保证白底可读（存量的临近结款提醒之前是纯黑色，
// 对比度不好，这次一起改）
const TEXT_COLOR = { red: '#cf1322', orange: '#d46b08', gold: '#ad8b00', green: '#237804' }
const CATEGORY_LABEL = {
  COLLAB_PAYMENT_DUE: '红人合作跟踪临近结款',
  BRAND_MONTH_END_PAYMENT_DUE: '品牌方月结临近结款',
  PM_EXECUTOR_PROGRESS_STALL: '进度滞留-项目',
  FINANCE_PROGRESS_STALL: '进度滞留-财务',
  REQUIREMENT_INVOICE_OVERDUE: 'Invoice逾期'
}

function isOverdueStyle(r) { return r.overdueUrgency != null }
function urgencyColor(r) {
  return isOverdueStyle(r) ? (OVERDUE_COLOR[r.overdueUrgency] || 'default') : (URGENCY_COLOR[r.urgency] || 'default')
}
function urgencyLabel(r) {
  return isOverdueStyle(r) ? (OVERDUE_LABEL[r.overdueUrgency] || r.overdueUrgency) : (URGENCY_LABEL[r.urgency] || r.urgency)
}
function textColor(r) { return TEXT_COLOR[urgencyColor(r)] || '#333' }
function categoryLabel(c) { return CATEGORY_LABEL[c] || c }
// 分类小标签用中性色，跟严重度色（红/橙/黄/绿）区分开，不会互相干扰
function categoryTagColor(c) {
  return ['PM_EXECUTOR_PROGRESS_STALL', 'FINANCE_PROGRESS_STALL', 'REQUIREMENT_INVOICE_OVERDUE'].includes(c)
    ? 'purple' : 'blue'
}
</script>

<style scoped>
.reminder-cards { display: flex; flex-direction: column; gap: 10px; }
.reminder-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #eee;
  background: #fafafa;
  border-left: 4px solid #ccc;
}
.reminder-card.urgency-red    { border-left-color: #ff4d4f; }
.reminder-card.urgency-orange { border-left-color: #fa8c16; }
.reminder-card.urgency-gold   { border-left-color: #faad14; }
.reminder-card.urgency-green  { border-left-color: #52c41a; }
.card-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.card-text { font-size: 14px; font-weight: 500; }
.category-tag { font-size: 12px; }
</style>
