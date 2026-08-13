<template>
  <a-modal :open="visible" :title="`团队合同 - ${brandName}${teamName ? ' / ' + teamName : ''}`"
    width="640px" :footer="null" @cancel="close" :destroy-on-close="true">
    <div style="font-size:12px;color:#595959;margin-bottom:12px">
      该品牌方是"一年签一次合同"，{{ teamName ? '这个团队' : '该品牌方' }}下所有红人共用同一份合同，
      不用每个红人各自上传。支持保留多条历史合同（不同年份可追溯）。
    </div>

    <a-spin :spinning="loading">
      <div v-if="contracts.length" style="margin-bottom:12px">
        <div v-for="c in contracts" :key="c.id" class="contract-card">
          <div class="contract-card-range">{{ formatDate(c.startDate) }} 至 {{ formatDate(c.endDate) }}</div>
          <div class="contract-card-actions">
            <a :href="c.contractLink" target="_blank" rel="noopener">查看合同</a>
            <template v-if="authStore.canManageTeamContracts">
              <a @click="openForm(c)">编辑</a>
              <a-popconfirm title="确认删除这条合同记录？删除后不可恢复（数据库行会直接删掉，不是软删除）"
                @confirm="handleDelete(c.id)">
                <a style="color:#ff4d4f">删除</a>
              </a-popconfirm>
            </template>
          </div>
        </div>
      </div>
      <span v-else style="color:#595959;font-size:12px;display:block;margin-bottom:12px">
        还没有已签署的合同记录
      </span>

      <a-tooltip :title="authStore.canManageTeamContracts ? null : '只有项目负责人/执行人员/法务/管理层/IT后勤有权限上传'">
        <span>
          <a-button :disabled="!authStore.canManageTeamContracts" @click="openForm(null)">上传合同</a-button>
        </span>
      </a-tooltip>
    </a-spin>

    <TeamContractFormModal v-model:visible="formVisible" :brand-id="brandId" :team-id="teamId"
      :brand-name="brandName" :team-name="teamName" :contract="formRecord" @saved="loadContracts" />
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { teamContractApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { formatDate } from '../../utils/dateFormat'
import TeamContractFormModal from './TeamContractFormModal.vue'

const props = defineProps({
  visible:   { type: Boolean, default: false },
  brandId:   { type: [Number, String], default: null },
  teamId:    { type: [Number, String], default: null },   // 该品牌方下没有团队层时为 null
  brandName: { type: String, default: null },
  teamName:  { type: String, default: null }
})
const emit = defineEmits(['update:visible'])

const authStore = useAuthStore()
const loading = ref(false)
const contracts = ref([])
const formVisible = ref(false)
const formRecord = ref(null)

async function loadContracts() {
  if (!props.brandId) { contracts.value = []; return }
  loading.value = true
  try {
    const res = props.teamId
      ? await teamContractApi.byTeam(props.teamId)
      : await teamContractApi.byBrandNoTeam(props.brandId)
    contracts.value = res.data || []
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, v => { if (v) loadContracts() })

function openForm(existing) {
  formRecord.value = existing || null
  formVisible.value = true
}
async function handleDelete(id) {
  await teamContractApi.delete(id)
  message.success('已删除')
  loadContracts()
}
function close() { emit('update:visible', false) }
</script>

<style scoped>
.contract-card {
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.contract-card-range {
  font-size: 13px;
  color: #262626;
}
.contract-card-actions {
  display: flex;
  gap: 12px;
}
</style>
