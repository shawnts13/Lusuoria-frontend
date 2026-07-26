<template>
  <div>
    <a-divider orientation="left" style="font-size:13px">工资标准（按项目视频类型/件计算）</a-divider>
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <a-form-item label="实拍新视频">
          <a-input-number v-model:value="form.rateRealShotNew"
            style="width:100%" :min="0" :precision="2" addon-after="元/条" />
        </a-form-item>
        <a-form-item label="AI新素材">
          <a-input-number v-model:value="form.rateAiNewMaterial"
            style="width:100%" :min="0" :precision="2" addon-after="元/条" />
        </a-form-item>
        <a-form-item label="旧素材重发(1-50条)">
          <a-input-number v-model:value="form.rateOldMaterialTier1"
            style="width:100%" :min="0" :precision="2" addon-after="元/条" />
        </a-form-item>
        <a-form-item label="旧素材重发(51-100条)">
          <a-input-number v-model:value="form.rateOldMaterialTier2"
            style="width:100%" :min="0" :precision="2" addon-after="元/条" />
        </a-form-item>
        <a-form-item label="旧素材重发(101条+)单价">
          <a-input-number v-model:value="form.rateOldMaterialTier3"
            style="width:100%" :min="0" :precision="2" addon-after="元/条" />
        </a-form-item>
        <a-form-item label="该部分当月封顶">
          <a-input-number v-model:value="form.oldMaterialMonthlyCap"
            style="width:100%" :min="0" :precision="2" addon-after="元/月封顶" />
          <div style="font-size:12px; color:#888; margin-top:4px">
            第101条及以上部分按单价计算后，当月该部分金额封顶该数值
          </div>
        </a-form-item>
      </a-form>
    </a-spin>
  </div>
</template>

<script setup>
/**
 * 执行人员薪资梯度 - 共享编辑区块，由 (managerId, executorId) 唯一确定一份。
 * 供两处复用：
 *   - EmployeeListPage.vue（ADMIN/管理层"员工管理"页面编辑某个执行人员时，
 *     managerId 固定传系统里唯一的"管理层"员工 id）
 *   - ExecutorPayRateListPage.vue（项目负责人"执行人员管理"页面，managerId 不传，
 *     后端自动用当前登录账号自己的员工 id）
 * 组件内部自己拉取/保存数据，父组件只需要在保存整体表单时调用 exposed 的 save() 方法。
 */
import { reactive, ref, watch } from 'vue'
import { executorPayRateApi } from '../../api/index'

const props = defineProps({
  executorId: { type: [Number, String], default: null },
  managerId: { type: [Number, String], default: null } // 不传时后端自动用当前登录账号自己的员工id
})

const loading = ref(false)
const emptyRate = () => ({
  rateRealShotNew: null, rateAiNewMaterial: null,
  rateOldMaterialTier1: null, rateOldMaterialTier2: null, rateOldMaterialTier3: null,
  oldMaterialMonthlyCap: null
})
const form = reactive(emptyRate())

async function load() {
  if (!props.executorId) { Object.assign(form, emptyRate()); return }
  loading.value = true
  try {
    const res = await executorPayRateApi.list(props.managerId)
    const mine = (res.data || []).find(r => r.executorId === props.executorId)
    Object.assign(form, emptyRate(), mine || {})
  } finally { loading.value = false }
}

watch(() => [props.executorId, props.managerId], load, { immediate: true })

/** 保存这份费率，供父组件在整体表单保存时调用 */
async function save() {
  if (!props.executorId) return
  await executorPayRateApi.save({
    managerId: props.managerId || null,
    executorId: props.executorId,
    ...form
  })
}

defineExpose({ save })
</script>
