<template>
  <a-modal :open="visible" title="上传发票链接" width="560px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close" :destroy-on-close="true">
    <div style="margin-bottom:16px">
      <a href="https://drive.google.com/drive/folders/1KNz3r_SDDxkupki7i2b6zXgL_CDdZjAp"
        target="_blank" rel="noopener">
        <a-button>
          <template #icon><LinkOutlined /></template>前往Receipts上传Google Drive页面
        </a-button>
      </a>
    </div>
    <a-form layout="vertical">
      <a-form-item label="发票链接">
        <a-input v-model:value="receiptLink" placeholder="粘贴上传好后的发票链接" />
      </a-form-item>
    </a-form>
    <div class="upload-hint">
      请点击"前往Receipts上传Google Drive页面"按钮，将发票上传至对应年份的Receipts文件夹里
      （跟Invoice共用同一个Google Drive）。文件命名规则：年月日-receipt-品牌方-团队.pdf，
      例如20260805-receipt-TEMU中国-田震团队.pdf
      <template v-if="suggestedFileName">
        <br>本发票建议命名：<span class="suggested-name">{{ suggestedFileName }}</span>
      </template>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import { paymentApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null },
  // 品牌方名称 + 团队名称（2026-08 新增，用来直接算出建议命名，不用用户自己拼）。
  // teamName 为空代表这条结款记录"不涉及团队"，命名里就不带团队这一段
  brandName: { type: String, default: null },
  teamName: { type: String, default: null }
})

// 建议命名直接算好显示出来，按北京时间取"今天"（系统约定所有时间都按北京时间，浏览器本地
// 时区不一定是北京时间，不能直接用 new Date() 的本地年月日），跟"上传Invoice"/"上传合同"
// 弹窗同一个套路
function todayYmdBeijing() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const map = {}
  for (const p of parts) map[p.type] = p.value
  return `${map.year}${map.month}${map.day}`
}
const suggestedFileName = computed(() => {
  if (!props.brandName) return null
  const suffix = props.teamName ? `${props.brandName}-${props.teamName}` : props.brandName
  return `${todayYmdBeijing()}-receipt-${suffix}.pdf`
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const receiptLink = ref('')

watch(() => props.visible, v => {
  if (v) receiptLink.value = props.record?.receiptLink || ''
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (!receiptLink.value || !receiptLink.value.trim()) {
    message.warning('请填写发票链接')
    return
  }
  saving.value = true
  try {
    await paymentApi.uploadReceiptLink(props.record.id, receiptLink.value.trim())
    message.success('发票链接已保存')
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
   （跟"上传Invoice"/"上传合同"弹窗共用同一套样式，AntD warning 配色） */
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
