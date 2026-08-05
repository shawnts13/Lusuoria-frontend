<template>
  <a-modal :open="visible" title="上传合同链接" width="560px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close" :destroy-on-close="true">
    <div style="margin-bottom:16px">
      <a href="https://drive.google.com/drive/folders/1KNz3r_SDDxkupki7i2b6zXgL_CDdZjAp"
        target="_blank" rel="noopener">
        <a-button>
          <template #icon><LinkOutlined /></template>前往合同上传Google Drive页面
        </a-button>
      </a>
    </div>
    <a-form layout="vertical">
      <a-form-item label="合同链接">
        <a-input v-model:value="contractLink" placeholder="粘贴上传好后的合同链接" />
      </a-form-item>
    </a-form>
    <div class="upload-hint">
      请点击"前往合同上传Google Drive页面"按钮，将合同上传至对应年份的Contracts文件夹里。
      文件命名规则：年月日-contract-红人社媒完整名字，例如 20260723-contract-kam2kute
      <template v-if="suggestedFileName">
        <br>本合同建议命名：<span class="suggested-name">{{ suggestedFileName }}</span>
      </template>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import { requirementApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirement: { type: Object, default: null },
  // 红人社媒完整名字（2026-08 新增，用来直接算出建议命名，不用用户自己拼）
  accountName: { type: String, default: null }
})

// 建议命名直接算好显示出来，按北京时间取"今天"（系统约定所有时间都按北京时间，浏览器本地
// 时区不一定是北京时间，不能直接用 new Date() 的本地年月日），跟"上传Invoice"弹窗同一个套路
function todayYmdBeijing() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const map = {}
  for (const p of parts) map[p.type] = p.value
  return `${map.year}${map.month}${map.day}`
}
const suggestedFileName = computed(() =>
  props.accountName ? `${todayYmdBeijing()}-contract-${props.accountName}` : null)
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const contractLink = ref('')

watch(() => props.visible, v => {
  if (v) contractLink.value = props.requirement?.contractLink || ''
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (!contractLink.value || !contractLink.value.trim()) {
    message.warning('请填写合同链接')
    return
  }
  saving.value = true
  try {
    await requirementApi.uploadContractLink(props.requirement.id, contractLink.value.trim())
    message.success('合同链接已保存')
    emit('saved')
    close()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 命名规则提示：从纯灰色小字改成深色文字+浅色背景提示框，避免这条重要的文件命名规则被忽略
   （跟"上传Invoice"弹窗共用同一套样式，AntD warning 配色） */
.upload-hint {
  font-size: 12px;
  color: #614700;
  line-height: 1.6;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  padding: 8px 12px;
}
/* 建议命名的文件名直接标红加粗，跟上面说明性的文字拉开视觉优先级，一眼就能复制对照 */
.suggested-name {
  color: #cf1322;
  font-weight: 600;
}
</style>
