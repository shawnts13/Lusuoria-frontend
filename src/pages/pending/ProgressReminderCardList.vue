<template>
  <a-spin :spinning="loading">
    <div v-if="reminders.length" class="reminder-cards">
      <div v-for="r in reminders" :key="r.id" class="reminder-card" :class="'urgency-' + urgencyColor(r)">
        <div class="card-main">
          <a-tag :color="categoryTagColor(r.category)" class="category-tag">{{ categoryLabel(r.category) }}</a-tag>
          <a-tag :color="urgencyColor(r)">{{ urgencyLabel(r) }}</a-tag>
          <span class="card-text" :style="{ color: textColor(r) }">{{ r.title }}</span>
        </div>
        <a v-if="showDetailButton" @click="$emit('view-detail', r)">查看详情</a>
      </div>
    </div>
    <a-empty v-else description="暂无进度提醒" style="margin:24px 0" />
  </a-spin>
</template>

<script setup>
import { urgencyColor, urgencyLabel, categoryLabel, categoryTagColor } from '../../utils/reminderLabels'

defineProps({
  reminders: { type: Array, default: () => [] },
  showDetailButton: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
})
defineEmits(['view-detail'])

// 卡片文字颜色：比左边框/徽标用的鲜艳色稍深，保证白底可读（存量的临近结款提醒之前是纯黑色，
// 对比度不好，这次一起改）
const TEXT_COLOR = { red: '#cf1322', orange: '#d46b08', gold: '#ad8b00', green: '#237804' }
function textColor(r) { return TEXT_COLOR[urgencyColor(r)] || '#333' }
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
