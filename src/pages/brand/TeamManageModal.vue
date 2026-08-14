<template>
  <a-modal :open="visible" :title="`团队管理 - ${brand?.name || ''}`" width="820px"
    :footer="null" @cancel="close" :destroy-on-close="true">
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center">
      <span style="color:#595959">
        该品牌方合同签订周期：
        <a-tag :color="brand?.contractCycleType === 'ANNUAL' ? 'purple' : 'blue'">
          {{ CONTRACT_CYCLE_LABELS[brand?.contractCycleType] || '一次需求签一次合同（默认）' }}
        </a-tag>
      </span>
      <a-tooltip :title="canManage ? null : '只有管理层有权限操作'">
        <span>
          <a-button type="primary" :disabled="!canManage" @click="openCreateTeam">
            <template #icon><PlusOutlined /></template>新建团队
          </a-button>
        </span>
      </a-tooltip>
    </div>

    <a-table :columns="columns" :data-source="teams" :loading="loading" row-key="id" size="middle" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <a-tag :color="colorForValue(record.name)">{{ record.name }}</a-tag>
        </template>
        <template v-if="column.key === 'forcePerRequirementContract'">
          <a-tag v-if="isAnnualBrand && record.forcePerRequirementContract" color="orange">
            特殊：一次需求签一次合同
          </a-tag>
          <span v-else style="color:#8c8c8c">—</span>
        </template>
        <template v-if="column.key === 'defaultContractRange'">
          <span v-if="isAnnualBrand && record.defaultContractEndDate" style="color:#262626">
            {{ record.defaultContractEndDate }}
          </span>
          <span v-else style="color:#8c8c8c">—</span>
        </template>
        <template v-if="column.key === 'involvesCorporateInvoice'">
          <a-tag :color="resolvedInvolvesCorporateInvoice(record) ? 'gold' : 'default'">
            {{ resolvedInvolvesCorporateInvoice(record) ? '涉及' : '不涉及' }}
          </a-tag>
          <span v-if="record.involvesCorporateInvoice == null" style="color:#8c8c8c;font-size:12px">
            （跟随品牌方默认）
          </span>
        </template>
        <template v-if="column.key === 'teamContract'">
          <a v-if="!record.forcePerRequirementContract" @click="openContractModal(record.id, record.name)">
            查看合同
          </a>
          <span v-else style="color:#8c8c8c">一次需求签一次合同，见红人需求管理</span>
        </template>
        <template v-if="column.key === 'action'">
          <a-space v-if="canManage">
            <a @click="openEditTeam(record)">编辑</a>
            <a-divider type="vertical" />
            <a-popconfirm title="确认删除该团队？" @confirm="handleDeleteTeam(record.id)">
              <a style="color:#ff4d4f">删除</a>
            </a-popconfirm>
          </a-space>
          <template v-else>
            <a-tooltip title="只有管理层有权限操作">
              <span style="color:#bbb;cursor:not-allowed">编辑</span>
            </a-tooltip>
            <a-divider type="vertical" />
            <a-tooltip title="只有管理层有权限操作">
              <span style="color:#bbb;cursor:not-allowed">删除</span>
            </a-tooltip>
          </template>
        </template>
      </template>
    </a-table>

    <!-- 该品牌方是"一年签一次合同"、但目前还没有配团队（团队级合同没有团队可挂的场景，
         目前生产环境不存在，但保留支持）：合同直接归属整个品牌方，在这里单独给一个入口 -->
    <div v-if="isAnnualBrand && !loading && teams.length === 0" class="no-team-contract-hint">
      该品牌方目前没有配置团队，合同直接归属整个品牌方：
      <a @click="openContractModal(null, null)">查看合同</a>
    </div>

    <TeamContractModal v-model:visible="contractModalVisible" :brand-id="brand?.id"
      :team-id="contractModalTeamId" :brand-name="brand?.name" :team-name="contractModalTeamName" />

    <!-- 新建/编辑团队：label 用 vertical 布局，避免"特殊：每次需求签一次合同"这类长 label
         在默认水平布局下被截断/挤压显示不全 -->
    <a-modal :open="teamFormVisible" :title="editingTeam ? '编辑团队' : '新建团队'" width="480px"
      :confirm-loading="savingTeam" @ok="handleSaveTeam" @cancel="teamFormVisible = false"
      :destroy-on-close="true">
      <a-form layout="vertical">
        <a-form-item label="团队名称" required>
          <a-input v-model:value="teamForm.name" />
        </a-form-item>
        <template v-if="isAnnualBrand">
          <a-form-item label="特殊：每次需求签一次合同">
            <a-switch v-model:checked="teamForm.forcePerRequirementContract" />
            <div class="hint-box">
              该品牌方整体是"一年签一次合同"，如果这个团队要按"每次需求单独签一次合同"处理
              （例如某些特殊团队的合作模式跟品牌方整体不一样），打开这个开关。
            </div>
          </a-form-item>
          <template v-if="!teamForm.forcePerRequirementContract">
            <a-form-item label="兜底默认合同到期日期">
              <a-date-picker v-model:value="teamForm.defaultContractEndDate" value-format="YYYY-MM-DD" style="width:100%" />
              <div class="hint-box">
                如果这个团队还没有上传过任何团队合同，系统会按这个合同到期日期判断合同是否快到期。
              </div>
            </a-form-item>
          </template>
        </template>
        <a-form-item label="是否涉及公对公发票">
          <a-select v-model:value="teamForm.involvesCorporateInvoice" allow-clear
            :placeholder="`跟随品牌方默认（当前：${brand?.defaultInvolvesCorporateInvoice === true ? '涉及' : '不涉及'}）`">
            <a-select-option :value="true">涉及</a-select-option>
            <a-select-option :value="false">不涉及</a-select-option>
          </a-select>
          <div class="hint-box">
            留空=跟随品牌方"是否涉及公对公发票（默认值）"配置；这里单独选了"涉及"或"不涉及"，
            就以这个团队的配置为准（覆盖品牌方默认值）。涉及时，"红人结款"里这个品牌方-团队组合的
            记录才能使用"上传发票"功能。
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { influencerTeamApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { colorForValue } from '../../utils/tagColor'
import TeamContractModal from './TeamContractModal.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  brand:   { type: Object, default: null },
  // 深链自动打开某个团队（或该品牌方没有团队时的"无团队合同"）的合同列表——供"红人需求管理"
  // 的"上传合同"按钮、"待处理"合同到期提醒的"查看详情"跳转过来时用，见 BrandListPage.vue
  autoOpenTeamId: { type: [Number, String], default: undefined },
  autoOpenNoTeam: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible'])

const authStore = useAuthStore()
const canManage = computed(() => authStore.canManageBrands)

const loading = ref(false)
const teams = ref([])
const isAnnualBrand = computed(() => props.brand?.contractCycleType === 'ANNUAL')

const CONTRACT_CYCLE_LABELS = { ANNUAL: '一年签一次合同', PER_REQUIREMENT: '一次需求签一次合同' }

// "团队合同"列只有"一年签一次合同"的品牌方才有意义，跟其余固定列拼在一起
const columns = computed(() => {
  const base = [
    { title: '团队名称', key: 'name' },
    { title: '合同周期覆盖', key: 'forcePerRequirementContract' },
    { title: '兜底默认合同到期日期', key: 'defaultContractRange' },
    { title: '是否涉及公对公发票', key: 'involvesCorporateInvoice' }
  ]
  if (isAnnualBrand.value) base.push({ title: '团队合同', key: 'teamContract', width: 110 })
  base.push({ title: '操作', key: 'action', width: 140 })
  return base
})

// 团队级合同列表弹窗
const contractModalVisible  = ref(false)
const contractModalTeamId   = ref(null)
const contractModalTeamName = ref(null)
function openContractModal(teamId, teamName) {
  contractModalTeamId.value = teamId
  contractModalTeamName.value = teamName
  contractModalVisible.value = true
}

// 解析这个团队最终是否涉及公对公发票：团队有单独配置（非null）就用团队的值，
// 没配置就落回品牌方默认值——跟后端 InfluencerTeam.involvesCorporateInvoice() 保持一致
function resolvedInvolvesCorporateInvoice(record) {
  if (record.involvesCorporateInvoice != null) return record.involvesCorporateInvoice === true
  return props.brand?.defaultInvolvesCorporateInvoice === true
}

const teamFormVisible = ref(false)
const editingTeam = ref(null)
const savingTeam = ref(false)
const teamForm = reactive({
  id: null, name: '', forcePerRequirementContract: false,
  defaultContractEndDate: null, involvesCorporateInvoice: null
})

async function loadTeams() {
  if (!props.brand?.id) return
  loading.value = true
  try {
    const res = await influencerTeamApi.listByBrand(props.brand.id)
    teams.value = res.data || []
  } finally {
    loading.value = false
  }
  autoOpenContractIfRequested()
}

// 深链打开（见 props.autoOpenTeamId/autoOpenNoTeam 的注释）：teams 加载完之后才有数据可以
// 匹配，所以放在 loadTeams() 末尾调用，不是单独监听 props
function autoOpenContractIfRequested() {
  if (props.autoOpenNoTeam) {
    openContractModal(null, null)
  } else if (props.autoOpenTeamId != null) {
    const team = teams.value.find(t => String(t.id) === String(props.autoOpenTeamId))
    if (team) openContractModal(team.id, team.name)
  }
}

watch(() => props.visible, v => { if (v) loadTeams() })

function openCreateTeam() {
  editingTeam.value = null
  Object.assign(teamForm, { id: null, name: '', forcePerRequirementContract: false,
    defaultContractEndDate: null, involvesCorporateInvoice: null })
  teamFormVisible.value = true
}

function openEditTeam(record) {
  editingTeam.value = record
  Object.assign(teamForm, {
    id: record.id, name: record.name,
    forcePerRequirementContract: !!record.forcePerRequirementContract,
    defaultContractEndDate: record.defaultContractEndDate || null,
    involvesCorporateInvoice: record.involvesCorporateInvoice ?? null
  })
  teamFormVisible.value = true
}

async function handleSaveTeam() {
  if (!teamForm.name || !teamForm.name.trim()) {
    message.warning('请填写团队名称')
    return
  }
  savingTeam.value = true
  try {
    await influencerTeamApi.save({
      id: teamForm.id,
      name: teamForm.name.trim(),
      brandId: props.brand.id,
      forcePerRequirementContract: teamForm.forcePerRequirementContract,
      defaultContractEndDate: teamForm.defaultContractEndDate,
      involvesCorporateInvoice: teamForm.involvesCorporateInvoice
    })
    message.success(teamForm.id ? '更新成功' : '创建成功')
    teamFormVisible.value = false
    loadTeams()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingTeam.value = false
  }
}

async function handleDeleteTeam(id) {
  await influencerTeamApi.delete(id)
  message.success('删除成功')
  loadTeams()
}

function close() { emit('update:visible', false) }
</script>

<style scoped>
.hint-box {
  font-size: 12px;
  color: #614700;
  line-height: 1.6;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  padding: 6px 10px;
  margin-top: 6px;
}
.no-team-contract-hint {
  font-size: 12px;
  color: #595959;
  margin-top: 12px;
  padding: 8px 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}
</style>
