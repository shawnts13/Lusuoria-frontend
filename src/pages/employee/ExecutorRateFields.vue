<template>
  <div>
    <a-spin :spinning="loading">
      <RateTierEditor v-model="tiersByType.REAL_SHOT_NEW" label="实拍新视频" />
      <RateTierEditor v-model="tiersByType.REAL_SHOT_NEW_PHOTO" label="实拍新图片" />
      <RateTierEditor v-model="tiersByType.AI_NEW_MATERIAL" label="AI新素材" />
      <RateTierEditor v-model="tiersByType.OLD_MATERIAL_REPOST" label="旧素材重发" />
    </a-spin>
  </div>
</template>

<script setup>
/**
 * 执行人员薪资梯度 - 共享编辑区块，由 (managerId, executorId) 唯一确定一份，四个视频类型
 * （实拍新视频/实拍新图片/AI新素材/旧素材重发）各自独立维护一份"按当月累计条数分档"的梯度
 * （"每条固定价"就是只维护一档、且不设最高条数）。供两处复用：
 *   - EmployeeListPage.vue（ADMIN/管理层"员工管理"页面编辑某个执行人员时，
 *     managerId 固定传系统里唯一的"管理层"员工 id）
 *   - ExecutorPayRateListPage.vue（项目负责人"执行人员管理"页面，managerId 不传，
 *     后端自动用当前登录账号自己的员工 id）
 * 组件内部自己拉取/保存数据，父组件只需要在保存整体表单时调用 exposed 的 save() 方法。
 */
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { executorPayRateApi } from '../../api/index'
import RateTierEditor from './RateTierEditor.vue'

const VIDEO_TYPE_LABELS = {
  REAL_SHOT_NEW: '实拍新视频', REAL_SHOT_NEW_PHOTO: '实拍新图片',
  AI_NEW_MATERIAL: 'AI新素材', OLD_MATERIAL_REPOST: '旧素材重发'
}

const props = defineProps({
  executorId: { type: [Number, String], default: null },
  managerId: { type: [Number, String], default: null } // 不传时后端自动用当前登录账号自己的员工id
})

const VIDEO_TYPES = ['REAL_SHOT_NEW', 'REAL_SHOT_NEW_PHOTO', 'AI_NEW_MATERIAL', 'OLD_MATERIAL_REPOST']

const loading = ref(false)
const tiersByType = reactive({
  REAL_SHOT_NEW: [], REAL_SHOT_NEW_PHOTO: [], AI_NEW_MATERIAL: [], OLD_MATERIAL_REPOST: []
})

function emptyTiers() {
  return { REAL_SHOT_NEW: [], REAL_SHOT_NEW_PHOTO: [], AI_NEW_MATERIAL: [], OLD_MATERIAL_REPOST: [] }
}

async function load() {
  Object.assign(tiersByType, emptyTiers())
  if (!props.executorId) return
  loading.value = true
  try {
    const res = await executorPayRateApi.list(props.managerId)
    const mine = (res.data || []).filter(t => t.executorId === props.executorId)
    for (const t of mine) {
      if (tiersByType[t.videoType]) {
        tiersByType[t.videoType].push({
          minCount: t.minCount, maxCount: t.maxCount, rate: t.rate, monthlyCap: t.monthlyCap
        })
      }
    }
    for (const type of VIDEO_TYPES) {
      tiersByType[type].sort((a, b) => (a.minCount || 0) - (b.minCount || 0))
    }
  } finally { loading.value = false }
}

watch(() => [props.executorId, props.managerId], load, { immediate: true })

/**
 * 保存这份费率，供父组件在整体表单保存时调用。
 *
 * 2026-08 修复：之前对"最低条数"/"单价"任意一个没填的档位直接静默过滤掉不提交，
 * 导致用户以为填了单价就保存成功了，实际上那一档整个被丢弃、什么都没存进去，
 * 没有任何提示（Shawn 反馈）。现在改成：只要这一档"沾了手"（任意一个字段有值），
 * 就必须同时填了"最低条数"和"单价"才允许保存，否则直接拦下来报错，不再悄悄丢弃。
 * 真正完全没碰过的空行（比如点了"新增档位"又反悔不填了）才会被当成没意义的空行忽略。
 */
async function save() {
  if (!props.executorId) return
  const tiersByTypeToSave = {}
  for (const type of VIDEO_TYPES) {
    const rows = tiersByType[type]
    const touchedRows = rows.filter(t =>
      t.minCount != null || t.maxCount != null || t.rate != null || t.monthlyCap != null)
    const incompleteIdx = touchedRows.findIndex(t => t.minCount == null || t.rate == null)
    if (incompleteIdx !== -1) {
      message.error(`${VIDEO_TYPE_LABELS[type]}：第 ${incompleteIdx + 1} 档"最低条数"和"单价"必须都填写，请检查后再保存`)
      throw new Error('executor-rate-tier-incomplete')
    }
    tiersByTypeToSave[type] = touchedRows
  }
  await executorPayRateApi.save({
    managerId: props.managerId || null,
    executorId: props.executorId,
    tiersByType: tiersByTypeToSave
  })
}

defineExpose({ save })
</script>
