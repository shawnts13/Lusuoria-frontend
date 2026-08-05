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
      （跟Invoice共用同一个Google Drive）。文件命名规则：年月日-receipt-品牌方-团队，
      例如20260805-receipt-TEMU中国-田震团队
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import { paymentApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null }
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
</style>
