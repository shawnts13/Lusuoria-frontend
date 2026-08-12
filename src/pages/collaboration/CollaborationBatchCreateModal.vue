<template>
  <a-modal :open="visible" title="批量新建合作跟踪" width="1000px"
    :confirm-loading="saving" @ok="handleSaveAll" @cancel="close" :destroy-on-close="false">
    <div style="display:flex;gap:16px">
      <!-- 左侧：视频项目面板列表 -->
      <div style="width:160px;flex-shrink:0;border-right:1px solid #f0f0f0;padding-right:12px">
        <div v-for="(pane, idx) in panes" :key="pane.key"
          class="pane-tab" :class="{ active: idx === activeIndex }"
          @click="activeIndex = idx">
          <span>视频项目{{ idx + 1 }}</span>
          <a-button v-if="panes.length > 1" type="text" size="small" danger @click.stop="removePane(idx)">
            <CloseOutlined />
          </a-button>
        </div>
        <a-button type="dashed" block size="small" style="margin-top:8px" @click="clonePane(activeIndex)">
          <CopyOutlined /> 复制当前窗口
        </a-button>
      </div>

      <!-- 右侧：当前面板的表单 -->
      <div style="flex:1;min-width:0;max-height:65vh;overflow-y:auto">
        <a-form v-for="(pane, idx) in panes" v-show="idx === activeIndex" :key="pane.key"
          :ref="el => { if (el) formRefs[idx] = el }" :model="pane" layout="vertical">

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="红人社媒完整名字" name="influencerId"
                :rules="[{ required: true, message: '请选择红人社媒完整名字' }]">
                <a-select v-model:value="pane.influencerId" allow-clear show-search
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
                  placeholder="从红人库选择" @change="() => onInfluencerChange(pane)">
                  <a-select-option v-for="inf in influencers" :key="inf.id" :value="inf.id" :label="inf.accountName">
                    {{ inf.accountName }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="品牌方">
                <a-select v-model:value="pane.brandId" allow-clear show-search
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
                  :disabled="!pane.influencerId || availableBrands(pane).length <= 1" placeholder="选择品牌方"
                  @change="() => { pane.teamId = null }">
                  <a-select-option v-for="b in availableBrands(pane)" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16" v-if="pane.influencerId">
            <a-col :span="12" v-if="pane.brandId">
              <a-form-item label="红人团队">
                <a-select v-model:value="pane.teamId" allow-clear show-search
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
                  :disabled="availableTeams(pane).length <= 1"
                  :placeholder="availableTeams(pane).length === 0 ? '该品牌方下没有配团队' : '选择团队'">
                  <a-select-option v-for="t in availableTeams(pane)" :key="t.teamId ?? 'none'" :value="t.teamId" :label="t.teamName || '（不涉及团队）'">
                    {{ t.teamName || '（不涉及团队）' }}
                  </a-select-option>
                </a-select>
                <div v-if="availableTeams(pane).length > 1" style="font-size:12px;color:#faad14;margin-top:2px">
                  该红人在此品牌方下关联了多个团队，请明确选择其中一个
                </div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="服务国家/市场">
                <a-select v-if="availableCountryMarkets(pane).length > 1" v-model:value="pane.countryMarket"
                  allow-clear placeholder="选择服务国家/市场">
                  <a-select-option v-for="c in availableCountryMarkets(pane)" :key="c" :value="c">{{ c }}</a-select-option>
                </a-select>
                <a-input v-else :value="pane.countryMarket || '—'" disabled />
                <div v-if="availableCountryMarkets(pane).length > 1" style="font-size:12px;color:#faad14;margin-top:2px">
                  该红人有多个服务国家/市场，请手动选择
                </div>
              </a-form-item>
            </a-col>
          </a-row>
          <div v-if="pane.influencerId" style="font-size:12px;color:#c00000;margin:-8px 0 16px 4px">
            找不到品牌方、红人团队？请先维护"红人管理"模块下该红人的数据。
          </div>

          <a-form-item label="内部需求编号">
            <a-input-group compact style="display:flex">
              <a-input :value="pane.internalRequirementNo" disabled placeholder="未关联" style="flex:1" />
              <a-button :disabled="!pane.influencerId" @click="openLinkPicker(idx)">关联红人需求</a-button>
            </a-input-group>
            <div style="font-size:12px;color:#c00000;margin-top:2px">
              没有内部需求编号？请先在"1.红人需求管理"模块里新增对应红人的需求
            </div>
          </a-form-item>

          <a-form-item label="项目视频类型">
            <a-select v-model:value="pane.videoType" allow-clear placeholder="选择视频类型" :disabled="!!pane.internalRequirementNo">
              <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
            <div v-if="pane.internalRequirementNo" style="font-size:12px;color:#595959;margin-top:2px">
              已根据关联的需求子项自动填入，如需修改请重新点击"关联红人需求"选择其他子项
            </div>
          </a-form-item>

          <a-row :gutter="16" v-if="canViewBaselineFinancials">
            <a-col :span="12">
              <a-form-item label="红人视频制作与发布成本（美金）">
                <a-input-number v-model:value="pane.influencerCost" style="width:100%" :precision="2"
                  placeholder="金额" :disabled="!!pane.internalRequirementNo" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="客户合作价格（美金）">
                <a-input-number v-model:value="pane.clientPrice" style="width:100%" :precision="2"
                  placeholder="金额" :disabled="!!pane.internalRequirementNo" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="合作平台">
            <a-select v-model:value="pane.platforms" mode="multiple" allow-clear placeholder="可多选">
              <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="需求内容">
            <a-textarea v-model:value="pane.demandContent" :rows="2" placeholder="填写具体产品名" />
          </a-form-item>

          <a-form-item label="视频发布链接">
            <div v-for="(link, i2) in pane.publishLinks" :key="'pl-' + i2" style="display:flex;gap:8px;margin-bottom:6px">
              <a-input v-model:value="pane.publishLinks[i2]" placeholder="前期可留空" style="flex:1" />
              <a-button danger size="small" @click="removePublishLink(pane, i2)">删除</a-button>
            </div>
            <a-button type="dashed" size="small" block @click="pane.publishLinks.push('')">+ 添加新链接</a-button>
          </a-form-item>

          <a-row :gutter="16">
            <a-col :span="12" v-if="requiresClientOrderId(pane)">
              <a-form-item label="客户方的项目订单">
                <a-input v-model:value="pane.clientOrderId" placeholder="拿到后填写" />
              </a-form-item>
            </a-col>
            <a-col :span="12" v-if="requiresClientPaymentBatch(pane)">
              <a-form-item label="客户方付款批次">
                <a-input v-model:value="pane.clientPaymentBatch" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="项目负责人">
                <a-select v-model:value="pane.projectManagerId" allow-clear show-search
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())" placeholder="选择负责人">
                  <a-select-option v-for="e in projectManagerCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="内部执行人员（可选）">
                <a-select v-model:value="pane.executorId" allow-clear show-search
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())" placeholder="选择执行人员">
                  <a-select-option v-for="e in executorCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="备注">
            <a-textarea v-model:value="pane.notes" :rows="2" placeholder="记录一些特殊情况" />
          </a-form-item>
        </a-form>
      </div>
    </div>

    <RequirementLinkPickerModal
      v-model:visible="linkPickerVisible"
      :influencer-id="panes[linkPickerPaneIndex]?.influencerId"
      :preset-requirement="linkPickerPresetRequirement"
      @confirm="data => onRequirementLinked(linkPickerPaneIndex, data)"
    />
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { CopyOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { useAuthStore } from '../../store/auth'
import RequirementLinkPickerModal from '../requirement/RequirementLinkPickerModal.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  brands: { type: Array, default: () => [] },
  influencers: { type: Array, default: () => [] },
  employees: { type: Array, default: () => [] },
  canViewBaselineFinancials: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const { getOptions } = useOptions()
const authStore = useAuthStore()
const saving = ref(false)
const activeIndex = ref(0)
const formRefs = ref([])
const linkPickerVisible = ref(false)
const linkPickerPaneIndex = ref(0)
// 从"红人需求管理"页面点击"新建合作跟踪"打开时，指定跳过第一步、直接选这条需求的子项
const linkPickerPresetRequirement = ref(null)
let paneSeq = 0

function createPane() {
  return {
    key: ++paneSeq,
    internalRequirementNo: null,
    influencerId: null, brandId: null, teamId: null, countryMarket: null,
    platforms: [], demandContent: '',
    publishLinks: [''],
    videoType: null, clientOrderId: '', clientPaymentBatch: '',
    // 项目负责人默认填成自己（仅当创建人的员工角色是"项目负责人"/"管理层"时），依然可以改
    projectManagerId: authStore.canDefaultAsProjectManager ? authStore.employeeId : null,
    executorId: null,
    influencerCost: null, clientPrice: null, notes: ''
  }
}

const panes = reactive([createPane()])

const projectManagerCandidates = computed(() =>
  props.employees.filter(e => e.role === '项目负责人' || e.role === '管理层'))
const executorCandidates = computed(() =>
  props.employees.filter(e => e.role === '执行人员'))

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}

function availableBrands(pane) {
  if (!pane.influencerId) return []
  const inf = props.influencers.find(i => i.id === pane.influencerId)
  if (!inf || !inf.brandTeamPairs || !inf.brandTeamPairs.length) return []
  const brandIds = [...new Set(inf.brandTeamPairs.map(p => p.brandId))]
  const opts = props.brands.filter(b => brandIds.includes(b.id))
  if (opts.length === 1 && pane.brandId == null) pane.brandId = opts[0].id
  return opts
}
// 2026-08 修复：这两个字段之前不管品牌方涉不涉及都无条件展示，跟"状态流转"/"编辑"表单里同一对
// 字段的展示条件不一致——批量新建按视频项目分标签页，每页可以选不同品牌方，所以判断要按 pane
// 各自的 brandId 算，不能像单条编辑表单那样用一个全局 computed
function requiresClientOrderId(pane) {
  const brand = props.brands.find(b => b.id === pane.brandId)
  return brand?.involvesClientOrderId !== false
}
function requiresClientPaymentBatch(pane) {
  const brand = props.brands.find(b => b.id === pane.brandId)
  return brand?.involvesClientPaymentBatch !== false
}
function availableTeams(pane) {
  if (!pane.influencerId || !pane.brandId) return []
  const inf = props.influencers.find(i => i.id === pane.influencerId)
  if (!inf || !inf.brandTeamPairs) return []
  const opts = inf.brandTeamPairs.filter(p => p.brandId === pane.brandId)
  if (opts.length === 1 && pane.teamId == null) pane.teamId = opts[0].teamId ?? null
  return opts
}
function availableCountryMarkets(pane) {
  if (!pane.influencerId) return []
  const inf = props.influencers.find(i => i.id === pane.influencerId)
  const opts = inf ? splitMulti(inf.countryMarket) : []
  if (opts.length === 1 && !pane.countryMarket) pane.countryMarket = opts[0]
  return opts
}

function onInfluencerChange(pane) {
  pane.brandId = null
  pane.teamId = null
  pane.countryMarket = null
}
function removePublishLink(pane, idx) {
  pane.publishLinks.splice(idx, 1)
  if (pane.publishLinks.length === 0) pane.publishLinks.push('')
}

function clonePane(idx) {
  const source = panes[idx]
  const clone = JSON.parse(JSON.stringify(source))
  clone.key = ++paneSeq
  panes.push(clone)
  activeIndex.value = panes.length - 1
}
function removePane(idx) {
  panes.splice(idx, 1)
  if (activeIndex.value >= panes.length) activeIndex.value = panes.length - 1
}

function openLinkPicker(idx) {
  linkPickerPaneIndex.value = idx
  linkPickerPresetRequirement.value = null
  linkPickerVisible.value = true
}
function onRequirementLinked(idx, data) {
  const pane = panes[idx]
  pane.internalRequirementNo = data.internalRequirementNo
  pane.influencerId = data.influencerId
  pane.brandId = data.brandId
  pane.teamId = data.teamId
  pane.countryMarket = data.countryMarket
  pane.platforms = data.platform || []
  pane.videoType = data.videoType
  pane.influencerCost = data.influencerUnitCostPrice ?? null
  pane.clientPrice = data.clientUnitPrice ?? null
  // 项目负责人默认值联动：创建人自己是"项目负责人"角色时仍优先填自己；否则采用需求配置的
  // 默认项目负责人；都没有则保留原先算好的默认值。跟 CollaborationFormModal.vue 的同名逻辑保持一致
  if (authStore.employeeRole === '项目负责人') {
    pane.projectManagerId = authStore.employeeId
  } else if (data.defaultProjectManagerId != null) {
    pane.projectManagerId = data.defaultProjectManagerId
  }
}

// "红人需求管理"页面"新建合作跟踪"按钮的入口：跳过手动选红人/关联需求这两步，直接定位到
// 这条需求，只需要用户选一个需求子项，然后正常填写其余字段
function openForRequirement(record) {
  resetPanes()
  const pane = panes[0]
  pane.influencerId = record.influencerId
  pane.brandId = record.brandId
  pane.teamId = record.teamId
  pane.countryMarket = record.countryMarket
  linkPickerPaneIndex.value = 0
  linkPickerPresetRequirement.value = record
  linkPickerVisible.value = true
  emit('update:visible', true)
}

function close() {
  // 关闭整个"新建跟踪"弹窗时，如果"关联红人需求"子弹窗还开着（比如直接点了外层弹窗的
  // 取消/关闭，没有先关掉内层选择器），linkPickerVisible 会一直卡在 true——下次再打开时
  // （无论是手动点"关联红人需求"还是"新建合作跟踪"预设流程）它已经是 true，值没有变化，
  // RequirementLinkPickerModal 内部监听 visible 的 watch 不会重新触发，就会停留在上次
  // 关闭前的状态（可能是第一步、需求列表还是空的），看起来像是"第一次查不到、第二次才有"。
  // 这里显式复位，保证下次打开一定是一次干净的 false→true 转变。
  linkPickerVisible.value = false
  emit('update:visible', false)
}

async function handleSaveAll() {
  if (saving.value) return
  for (const formRef of formRefs.value) {
    if (formRef) { try { await formRef.validate() } catch { return } }
  }
  saving.value = true
  try {
    const payloads = panes.map(pane => ({
      internalRequirementNo: pane.internalRequirementNo || null,
      brandId: pane.brandId,
      teamId: pane.teamId,
      influencerId: pane.influencerId,
      countryMarket: pane.countryMarket || null,
      platform: pane.platforms.join('\n') || null,
      demandContent: pane.demandContent || null,
      publishLink: pane.publishLinks.map(l => l.trim()).filter(Boolean).join('\n') || null,
      videoType: pane.videoType || null,
      clientOrderId: pane.clientOrderId || null,
      clientPaymentBatch: pane.clientPaymentBatch || null,
      projectManagerId: pane.projectManagerId || null,
      executorId: pane.executorId || null,
      influencerCost: pane.influencerCost,
      clientPrice: pane.clientPrice,
      notes: pane.notes
    }))
    await collaborationApi.batchCreate(payloads)
    message.success(`已成功新建 ${payloads.length} 条视频项目`)
    emit('saved')
    resetPanes()
    close()
  } catch (e) {
    // 超量/校验失败：不关闭弹窗，保留所有面板让用户修改
    message.error(e?.response?.data?.message || '批量新建失败，请检查各面板内容')
  } finally {
    saving.value = false
  }
}

function resetPanes() {
  panes.splice(0, panes.length, createPane())
  activeIndex.value = 0
  formRefs.value = []
}

defineExpose({ resetPanes, openForRequirement })
</script>

<style scoped>
.pane-tab {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;
  margin-bottom: 4px;
}
.pane-tab:hover { background: #f5f5f5; }
.pane-tab.active { background: #e6f4ff; color: #1677ff; font-weight: 600; }
</style>
