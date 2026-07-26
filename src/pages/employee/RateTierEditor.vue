<template>
  <div class="tier-section">
    <div class="tier-section-header">{{ label }}</div>

    <div v-if="!modelValue.length" class="tier-empty">尚未配置，点击下方按钮新增档位</div>

    <div v-for="(tier, idx) in modelValue" :key="idx" class="tier-card">
      <div class="tier-card-top">
        <span class="tier-badge">第 {{ idx + 1 }} 档</span>
        <a-button type="text" danger size="small" @click="removeTier(idx)">删除</a-button>
      </div>
      <div class="tier-fields">
        <div class="tier-field">
          <label>最低条数</label>
          <a-input-number v-model:value="tier.minCount" :min="1" :precision="0" style="width:100%" />
        </div>
        <div class="tier-field">
          <label>最高条数<span class="tier-field-hint">留空=不封顶</span></label>
          <a-input-number v-model:value="tier.maxCount" :min="1" :precision="0" style="width:100%" placeholder="不封顶" />
        </div>
        <div class="tier-field">
          <label>单价</label>
          <a-input-number v-model:value="tier.rate" :min="0" :precision="2" addon-after="元/条" style="width:100%" />
        </div>
      </div>
      <div v-if="tier.maxCount == null" class="tier-cap-row">
        <label>当月封顶金额<span class="tier-field-hint">留空=不封顶</span></label>
        <a-input-number v-model:value="tier.monthlyCap" :min="0" :precision="2" addon-after="元/月" style="width:220px" />
      </div>
    </div>

    <a-button type="dashed" block size="small" @click="addTier">
      <template #icon><PlusOutlined /></template>新增档位
    </a-button>
    <div class="tier-section-hint">
      只维护一档、且最高条数留空，就等于"每条固定单价"；只有排在最后、最高条数留空的那一档才能设置当月封顶金额
    </div>
  </div>
</template>

<script setup>
/**
 * 执行人员薪资梯度 - 单个视频类型的档位编辑器（按当月累计条数分档），供 ExecutorRateFields.vue
 * 对四个视频类型（实拍新视频/实拍新图片/AI新素材/旧素材重发）各用一份。
 * "每条固定价"就是只维护一档、且不设最高条数（maxCount 留空）。
 */
import { PlusOutlined } from '@ant-design/icons-vue'

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

<style scoped>
.tier-section {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px 14px 14px;
  margin-bottom: 16px;
}
.tier-section-header {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  padding-left: 10px;
  border-left: 3px solid #1677ff;
  margin-bottom: 10px;
  line-height: 1.2;
}
.tier-empty {
  font-size: 12px;
  color: #999;
  background: #fff;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  margin-bottom: 10px;
}
.tier-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.tier-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.tier-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  border-radius: 4px;
  padding: 1px 8px;
}
.tier-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.tier-field {
  flex: 1;
  min-width: 110px;
}
.tier-field label {
  display: block;
  font-size: 12px;
  color: #595959;
  margin-bottom: 4px;
}
.tier-field-hint {
  color: #bbb;
  font-weight: normal;
  margin-left: 4px;
}
.tier-cap-row {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #eee;
}
.tier-cap-row label {
  display: block;
  font-size: 12px;
  color: #595959;
  margin-bottom: 4px;
}
.tier-section-hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  line-height: 1.5;
}
</style>
