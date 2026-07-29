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
      <a-form-item label="品牌方">
        <a-select v-model:value="brandId" placeholder="选择品牌方" style="width:100%"
          :disabled="!!contract">
          <a-select-option v-for="b in availableBrands" :key="b.id" :value="b.id">{{ b.name }}</a-select-option>
        </a-select>
        <div style="font-size:12px;color:#595959;margin-top:2px">
          只列出这个红人关联过的"一年签一次合同"品牌方；"一次需求签一次合同"的品牌方请在红人需求管理处上传
        </div>
      </a-form-item>
      <a-form-item label="团队" v-if="brandId">
        <a-select v-model:value="teamId" :placeholder="teamPlaceholder" style="width:100%"
          allow-clear :disabled="!!contract || availableTeams.length <= 1">
          <a-select-option v-for="t in availableTeams" :key="t.teamId ?? 'none'" :value="t.teamId">
            {{ t.teamName || '（不涉及团队）' }}
          </a-select-option>
        </a-select>
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
      文件命名规则：年月日-contract-红人社媒完整名字，例如 20260723-contract-kam2kute
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { LinkOutlined } from '@ant-design/icons-vue'
import { influencerContractApi } from '../../api/index'

const props = defineProps({
  visible:      { type: Boolean, default: false },
  influencerId: { type: [Number, String], default: null },
  contract:     { type: Object, default: null },   // 编辑时传入已有记录，新增时为 null
  // 这个红人关联的、且品牌方是"一年签一次合同"的 (品牌方,团队) 对，供级联选择
  brandTeamPairs: { type: Array, default: () => [] },
  brands:       { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const brandId = ref(null)
const teamId = ref(null)
const startDate = ref(null)
const endDate = ref(null)
const contractLink = ref('')

const availableBrandIds = computed(() => [...new Set(props.brandTeamPairs.map(p => p.brandId))])
const availableBrands = computed(() => props.brands.filter(b => availableBrandIds.value.includes(b.id)))
const availableTeams = computed(() => props.brandTeamPairs.filter(p => p.brandId === brandId.value))
// 这个品牌方下如果确实存在真实团队关系，提示词就不该暗示"可以不选"（看起来奇怪）——
// 只有当这个红人在这个品牌方下的历史关系里压根没有任何真实团队（只有"不涉及团队"这一种）时，
// 才用"可不选"的措辞；下拉选项本身该有的"（不涉及团队）"选项不受这个影响，该有还是有
const teamPlaceholder = computed(() =>
  availableTeams.value.some(t => t.teamId != null) ? '请选择团队' : '团队（可不选）')

// 该品牌方下只有一个团队选项（含"不涉及团队"这一个选项）时自动带入——用于用户在弹窗打开后
// 手动切换"品牌方"下拉框的场景。注意：这个组件不会随弹窗关闭销毁（只有外层"编辑红人"弹窗
// 的 destroy-on-close 会销毁它），如果 brandId 被重新赋值成上一次打开时同一个值，
// watch 不会判定为"变化"、不会触发，所以下面弹窗打开时的初始填充不能只依赖这个 watch，
// 必须直接同步读取 availableTeams 当下的值来兜底（见 props.visible 的 watch）
watch(brandId, () => {
  if (availableTeams.value.length === 1) teamId.value = availableTeams.value[0].teamId ?? null
})

watch(() => props.visible, v => {
  if (!v) return
  if (props.contract) {
    brandId.value = props.contract.brandId
    teamId.value = props.contract.teamId ?? null
    startDate.value = props.contract.startDate
    endDate.value = props.contract.endDate
    contractLink.value = props.contract.contractLink || ''
  } else {
    brandId.value = availableBrands.value.length === 1 ? availableBrands.value[0].id : null
    // 直接同步读取 availableTeams（不依赖上面的 watch(brandId,...) 异步触发），
    // 避免 brandId 被赋成跟上次打开时相同的值导致 watch 不触发、团队漏填
    teamId.value = availableTeams.value.length === 1 ? (availableTeams.value[0].teamId ?? null) : null
    startDate.value = null
    endDate.value = null
    contractLink.value = ''
  }
})

function close() { emit('update:visible', false) }

async function handleSave() {
  if (!brandId.value) {
    message.warning('请选择品牌方')
    return
  }
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
      influencerId: props.influencerId,
      brandId: brandId.value,
      teamId: teamId.value ?? null,
      startDate: startDate.value,
      endDate: endDate.value,
      contractLink: contractLink.value.trim()
    }
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
