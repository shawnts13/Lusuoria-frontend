<template>
  <div>
    <a-divider orientation="left" style="font-size:13px">{{ label }}</a-divider>
    <div v-for="(tier, idx) in modelValue" :key="idx" style="margin-bottom:8px">
      <div style="display:flex; align-items:center; gap:8px">
        <span style="font-size:12px; color:#888">第</span>
        <a-input-number v-model:value="tier.minCount" placeholder="最低条数" :min="1" :precision="0" style="width:100px" />
        <span style="font-size:12px; color:#888">~</span>
        <a-input-number v-model:value="tier.maxCount" placeholder="不封顶" :min="1" :precision="0" style="width:100px" />
        <span style="font-size:12px; color:#888">条</span>
        <a-input-number v-model:value="tier.rate" placeholder="单价" :min="0" :precision="2" addon-after="元/条" style="width:150px" />
        <a-button type="text" danger @click="removeTier(idx)">删除</a-button>
      </div>
      <div v-if="tier.maxCount == null" style="margin-left:0; margin-top:4px">
        <a-input-number v-model:value="tier.monthlyCap" placeholder="不封顶"
          :min="0" :precision="2" addon-before="当月封顶" addon-after="元/月" style="width:260px" />
        <span style="font-size:12px; color:#888; margin-left:8px">留空表示这一档不封顶金额</span>
      </div>
    </div>
    <a-button type="dashed" block size="small" @click="addTier">+ 新增档位</a-button>
    <div style="font-size:12px; color:#888; margin-top:4px">
      只维护一档、且不设最高条数，就等于"每条固定单价"；只有排在最后、不设最高条数的那一档才能设置当月封顶金额
    </div>
  </div>
</template>

<script setup>
/**
 * 执行人员薪资梯度 - 单个视频类型的档位编辑器（按当月累计条数分档），供 ExecutorRateFields.vue
 * 对四个视频类型（实拍新视频/实拍新图片/AI新素材/旧素材重发）各用一份。
 * "每条固定价"就是只维护一档、且不设最高条数（maxCount 留空）。
 */
const props = defineProps({
  modelValue: { type: Array, required: true },
  label: { type: String, required: true }
})
const emit = defineEmits(['update:modelValue'])

function addTier() {
  emit('update:modelValue', [...props.modelValue, { minCount: null, maxCount: null, rate: null, monthlyCap: null }])
}
function removeTier(idx) {
  const next = [...props.modelValue]
  next.splice(idx, 1)
  emit('update:modelValue', next)
}
</script>
