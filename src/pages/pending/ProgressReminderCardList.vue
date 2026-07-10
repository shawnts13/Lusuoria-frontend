<template>
  <a-spin :spinning="loading">
    <div v-if="reminders.length" class="reminder-cards">
      <div v-for="r in reminders" :key="r.id" class="reminder-card" :class="'urgency-' + urgencyColor(r.urgency)">
        <template v-if="r.category === 'COLLAB_PAYMENT_DUE'">
          <div class="card-main">
            <a-tag :color="urgencyColor(r.urgency)">{{ urgencyLabel(r.urgency) }}</a-tag>
            <span class="card-text">{{ r.count }} 笔临近结款的红人合作跟踪记录</span>
          </div>
          <a v-if="showDetailButton" @click="$emit('view-detail', r)">查看详情</a>
        </template>
        <template v-else>
          <div class="card-main">
            <a-tag :color="urgencyColor(r.urgency)">{{ urgencyLabel(r.urgency) }}</a-tag>
            <span class="card-text">{{ r.title }}</span>
          </div>
        </template>
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

// 跟后端 ReminderUrgency 保持一致：0天或已超期=红，1-3天=橙，3-7天=绿
const URGENCY_COLOR = { OVERDUE: 'red', NEAR: 'orange', UPCOMING: 'green' }
const URGENCY_LABEL = { OVERDUE: '0天或已超期', NEAR: '1-3天', UPCOMING: '3-7天' }
function urgencyColor(u) { return URGENCY_COLOR[u] || 'default' }
function urgencyLabel(u) { return URGENCY_LABEL[u] || u }
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
.reminder-card.urgency-green  { border-left-color: #52c41a; }
.card-main { display: flex; align-items: center; gap: 10px; }
.card-text { font-size: 14px; color: #333; }
</style>
