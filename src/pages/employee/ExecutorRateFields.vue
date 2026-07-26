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
import { executorPayRateApi } from '../../api/index'
import RateTierEditor from './RateTierEditor.vue'

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

/** 保存这份费率，供父组件在整体表单保存时调用 */
async function save() {
  if (!props.executorId) return
  const tiersByTypeToSave = {}
  for (const type of VIDEO_TYPES) {
    tiersByTypeToSave[type] = tiersByType[type].filter(t => t.minCount != null && t.rate != null)
  }
  await executorPayRateApi.save({
    managerId: props.managerId || null,
    executorId: props.executorId,
    tiersByType: tiersByTypeToSave
  })
}

defineExpose({ save })
</script>
