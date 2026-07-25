<template>
  <a-modal :open="visible" :title="contract ? '编辑合同' : '新增合同'" width="560px"
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
      <a-form-item label="年份">
        <span v-if="yearFixed" style="font-size:14px">{{ year }}年</span>
        <a-date-picker v-else v-model:value="yearStr" picker="year" format="YYYY" value-format="YYYY"
          placeholder="选择年份" style="width:200px" />
      </a-form-item>
      <a-form-item label="合同链接">
        <a-input v-model:value="contractLink" placeholder="粘贴上传好后的合同链接" />
      </a-form-item>
    </a-form>
    <div class="upload-hint">
      请点击"前往合同上传Google Drive页面"按钮，将合同上传至对应年份的Contracts文件夹里。
      文件命名规则：年月日-contract-红人社媒完整名字，例如 20260723-contract-kam2kute
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import { influencerContractApi } from '../../api/index'

const props = defineProps({
  visible:      { type: Boolean, default: false },
  influencerId: { type: [Number, String], default: null },
  contract:     { type: Object, default: null },   // 编辑时传入已有记录，新增时为 null
  yearFixed:    { type: Boolean, default: false }   // true="新增本年度合同"：年份固定不可选
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const year = ref(new Date().getFullYear())
const yearStr = ref(String(new Date().getFullYear()))
const contractLink = ref('')

watch(() => props.visible, v => {
  if (!v) return
  if (props.contract) {
    year.value = props.contract.year
    contractLink.value = props.contract.contractLink || ''
  } else {
    year.value = new Date().getFullYear()
    contractLink.value = ''
  }
  yearStr.value = String(year.value)
})
watch(yearStr, v => { if (v) year.value = parseInt(v, 10) })

function close() { emit('update:visible', false) }

async function handleSave() {
  if (!year.value) {
    message.warning('请选择合同年份')
    return
  }
  if (!contractLink.value || !contractLink.value.trim()) {
    message.warning('请填写合同链接')
    return
  }
  saving.value = true
  try {
    const payload = { influencerId: props.influencerId, year: year.value, contractLink: contractLink.value.trim() }
    if (props.contract) {
      await influencerContractApi.update(props.contract.id, payload)
    } else {
      await influencerContractApi.create(payload)
    }
    message.success('合同已保存')
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
