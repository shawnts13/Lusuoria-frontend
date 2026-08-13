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
      <a-form-item label="品牌方/团队">
        <div style="font-size:14px;color:#262626">
          <a-tag :color="colorForValue(brandName)">{{ brandName }}</a-tag>
          <a-tag v-if="teamName" :color="colorForValue(teamName)">{{ teamName }}</a-tag>
          <span v-else class="no-team-hint">不涉及团队</span>
        </div>
      </a-form-item>
      <a-form-item label="合同生效日期">
        <a-date-picker v-model:value="startDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>
      <a-form-item label="合同失效日期">
        <a-date-picker v-model:value="endDate" value-format="YYYY-MM-DD" style="width:100%" />
      </a-form-item>
      <a-form-item label="合同链接">
        <a-input v-model:value="contractLink" placeholder="粘贴上传好后的合同链接" />
      </a-form-item>
    </a-form>
    <div class="upload-hint">
      请点击"前往合同上传Google Drive页面"按钮，将合同上传至对应年份的Contracts文件夹里。
      团队下所有红人共用这一份合同，不用每个红人各自上传。
      文件命名规则：年月日-contract-品牌方-团队.pdf（该品牌方下没有团队时省略团队名，
      变成年月日-contract-品牌方.pdf），例如 20260813-contract-TEMU中国-骆辉团队.pdf
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
import { teamContractApi } from '../../api/index'
import { colorForValue } from '../../utils/tagColor'

const props = defineProps({
  visible:   { type: Boolean, default: false },
  brandId:   { type: [Number, String], default: null },
  teamId:    { type: [Number, String], default: null },   // 该品牌方下没有团队层时为 null
  brandName: { type: String, default: null },
  teamName:  { type: String, default: null },
  contract:  { type: Object, default: null }   // 编辑时传入已有记录，新增时为 null
})
const emit = defineEmits(['update:visible', 'saved'])

// 建议命名直接算好显示出来，按北京时间取"今天"（系统约定所有时间都按北京时间，浏览器本地
// 时区不一定是北京时间，不能直接用 new Date() 的本地年月日），跟"上传合同/Invoice/发票"
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
  const teamSegment = props.teamName ? `-${props.teamName}` : ''
  return `${todayYmdBeijing()}-contract-${props.brandName}${teamSegment}.pdf`
})

const saving = ref(false)
const startDate = ref(null)
const endDate = ref(null)
const contractLink = ref('')

watch(() => props.visible, v => {
  if (!v) return
  if (props.contract) {
    startDate.value = props.contract.startDate
    endDate.value = props.contract.endDate
    contractLink.value = props.contract.contractLink || ''
  } else {
    startDate.value = null
    endDate.value = null
    contractLink.value = ''
  }
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (!startDate.value || !endDate.value) {
    message.warning('请选择合同生效日期和失效日期')
    return
  }
  if (startDate.value > endDate.value) {
    message.warning('合同生效日期不能晚于失效日期')
    return
  }
  if (!contractLink.value || !contractLink.value.trim()) {
    message.warning('请填写合同链接')
    return
  }
  saving.value = true
  try {
    const payload = {
      brandId: props.brandId,
      teamId: props.teamId ?? null,
      startDate: startDate.value,
      endDate: endDate.value,
      contractLink: contractLink.value.trim()
    }
    if (props.contract) {
      await teamContractApi.update(props.contract.id, payload)
    } else {
      await teamContractApi.create(payload)
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
/* 建议命名的文件名直接标红加粗，跟上面说明性的文字拉开视觉优先级，一眼就能复制对照，
   跟 RequirementContractModal 等其他"上传XX"弹窗保持同一套样式 */
.suggested-name {
  color: #cf1322;
  font-weight: 600;
}
.no-team-hint {
  color: #595959;
  font-size: 12px;
}
</style>
