<template>
  <a-modal :open="visible" title="状态流转" width="420px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:16px; color:#666; font-size:13px">
      {{ record?.accountName }}
      <span v-if="record?.internalProjectNo">（{{ record.internalProjectNo }}）</span>
    </div>
    <a-form layout="vertical">
      <a-form-item label="进度">
        <a-select v-model:value="progress" placeholder="选择进度">
          <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'

const { getOptions } = useOptions()

const props = defineProps({
  visible: Boolean,
  record: Object
})
const emit = defineEmits(['update:visible', 'saved'])

const progress = ref(null)
const saving = ref(false)

watch(() => props.visible, v => {
  if (v && props.record) progress.value = props.record.progress || null
})

function close() { emit('update:visible', false) }

async function handleSave() {
  saving.value = true
  try {
    await collaborationApi.updateStatus(props.record.id, { progress: progress.value })
    message.success('状态已更新')
    emit('saved')
    close()
  } finally { saving.value = false }
}
</script>
