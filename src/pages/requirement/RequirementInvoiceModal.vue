<template>
  <a-modal :open="visible" title="上传Invoice链接" width="560px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close" :destroy-on-close="true">
    <div style="margin-bottom:16px">
      <a href="https://drive.google.com/drive/folders/1KNz3r_SDDxkupki7i2b6zXgL_CDdZjAp"
        target="_blank" rel="noopener">
        <a-button>
          <template #icon><LinkOutlined /></template>前往Invoice上传Google Drive页面
        </a-button>
      </a>
    </div>
    <a-form layout="vertical">
      <a-form-item label="Invoice链接">
        <a-input v-model:value="invoiceLink" placeholder="粘贴上传好后的Invoice链接" />
      </a-form-item>
    </a-form>
    <div style="font-size:12px;color:#888;line-height:1.6">
      请点击"前往Invoice上传Google Drive页面"按钮，将Invoice上传至对应年份的Invoices文件夹里。
      文件命名规则：年月日-红人社媒完整名字，例如 20260723-kam2kute
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import { requirementApi } from '../../api/index'

const props = defineProps({
  visible: { type: Boolean, default: false },
  requirement: { type: Object, default: null }
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const invoiceLink = ref('')

watch(() => props.visible, v => {
  if (v) invoiceLink.value = props.requirement?.invoiceLink || ''
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (!invoiceLink.value || !invoiceLink.value.trim()) {
    message.warning('请填写Invoice链接')
    return
  }
  saving.value = true
  try {
    await requirementApi.uploadInvoiceLink(props.requirement.id, invoiceLink.value.trim())
    message.success('Invoice链接已保存，关联的红人合作跟踪记录的红人结款进度已自动更新为"红人已提供invoice"')
    emit('saved')
    close()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>
