<template>
  <a-spin :spinning="loading">
    <div v-if="reminders.length" class="reminder-cards">
      <div v-for="r in reminders" :key="r.id" class="reminder-card" :class="'urgency-' + urgencyColor(r)">
        <div class="card-main">
          <a-tag :color="categoryTagColor(r.category)" class="category-tag">{{ categoryLabel(r.category) }}</a-tag>
          <a-tag :color="urgencyColor(r)">{{ urgencyLabel(r) }}</a-tag>
          <!-- 2026-08-21 新增：标题里"（包含X笔特殊回款的红人合作跟踪记录）"这一段不管这条
               提醒本身的紧迫程度（urgency）是什么颜色，都固定用红色标出——只要涉及特殊回款周期
               的红人就要显眼，不能被"这条提醒还不算紧急所以颜色浅"这个逻辑盖过去 -->
          <span class="card-text" :style="{ color: textColor(r) }">{{ titleBase(r) }}</span>
          <span v-if="titleSpecial(r)" class="card-text" style="color:#c00000">{{ titleSpecial(r) }}</span>
        </div>
        <!-- 删除审核/进度倒退审核/执行成本修改审核这3类没有明细快照，具体处理走"待处理"页面
             已有的审批表格/"待我审核"入口，不提供只读的"查看详情"弹窗（见 NO_DETAIL_CATEGORIES） -->
        <a v-if="showDetailButton && !NO_DETAIL_CATEGORIES.includes(r.category)" @click="$emit('view-detail', r)">查看详情</a>
      </div>
    </div>
    <a-empty v-else description="暂无进度提醒" style="margin:24px 0" />
  </a-spin>
</template>

<script setup>
import { urgencyColor, urgencyLabel, categoryLabel, categoryTagColor, NO_DETAIL_CATEGORIES } from '../../utils/reminderLabels'

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

// 2026-08-21 新增：把后端拼好的标题拆成"主体"+"（包含X笔特殊回款的红人合作跟踪记录）"两段，
// 后者固定标红、不跟随 urgency 颜色，见后端 ProgressReminderService.runCollabPaymentDue()
// 拼标题那一段的注释。用同一个正则一次性拆，避免 base/special 两个函数各自重复匹配一遍
const SPECIAL_TITLE_SUFFIX = /(（包含\d+笔特殊回款的红人合作跟踪记录）)$/
function titleBase(r) { return (r.title || '').replace(SPECIAL_TITLE_SUFFIX, '') }
function titleSpecial(r) { return (r.title || '').match(SPECIAL_TITLE_SUFFIX)?.[1] || '' }
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
