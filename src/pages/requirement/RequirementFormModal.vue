<template>
  <a-modal :open="visible" :title="form.id ? '编辑红人需求' : '新建红人需求'"
    width="720px" :confirm-loading="saving"
    @ok="handleSave" @cancel="close" :destroy-on-close="false">
    <a-form ref="formRef" :model="form" layout="vertical">

      <a-form-item v-if="form.internalRequirementNo" label="内部需求编号">
        <a-input :value="form.internalRequirementNo" disabled />
      </a-form-item>

      <a-form-item label="完整需求内容">
        <a-textarea v-model:value="form.fullRequirementContent" :rows="8"
          placeholder="粘贴客户提需求时的原始聊天记录/邮件文本" />
        <a-button style="margin-top:8px" :loading="parsing" @click="handleParseContent">提取需求内容</a-button>
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="红人社媒完整名字" name="influencerId"
            :rules="[{ required: true, message: '请选择红人社媒完整名字' }]">
            <a-select v-model:value="form.influencerId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
              placeholder="从红人库选择" @change="onInfluencerChange">
              <a-select-option v-for="inf in influencers" :key="inf.id" :value="inf.id" :label="inf.accountName">
                {{ inf.accountName }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="需求月份">
            <a-date-picker v-model:value="form.requirementMonth" picker="month"
              format="YYYYMM" value-format="YYYYMM" style="width:100%" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16" v-if="form.influencerId">
        <a-col :span="12">
          <a-form-item label="品牌方">
            <a-select v-model:value="form.brandId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              :disabled="availableBrands.length <= 1"
              placeholder="选择品牌方" @change="onBrandChange">
              <a-select-option v-for="b in availableBrands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
            </a-select>
            <div v-if="availableBrands.length > 1" style="font-size:12px;color:#faad14;margin-top:2px">
              该红人有多个品牌方-团队，请手动选择
            </div>
          </a-form-item>
        </a-col>
        <a-col :span="12" v-if="form.brandId">
          <a-form-item label="红人团队">
            <a-select v-model:value="form.teamId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              :disabled="availableTeams.length <= 1"
              :placeholder="availableTeams.length === 0 ? '该品牌方下没有配团队' : '选择团队'">
              <a-select-option v-for="t in availableTeams" :key="t.teamId ?? 'none'" :value="t.teamId" :label="t.teamName || '（不涉及团队）'">
                {{ t.teamName || '（不涉及团队）' }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <div v-if="form.influencerId" style="font-size:12px;color:#c00000;margin:-8px 0 16px 4px">
        找不到品牌方、红人团队？请先维护"红人管理"模块下该红人的数据。
      </div>

      <a-row :gutter="16" v-if="form.influencerId">
        <a-col :span="12">
          <a-form-item label="服务国家/市场">
            <a-select v-if="availableCountryMarkets.length > 1" v-model:value="form.countryMarket"
              allow-clear placeholder="选择服务国家/市场">
              <a-select-option v-for="c in availableCountryMarkets" :key="c" :value="c">{{ c }}</a-select-option>
            </a-select>
            <a-input v-else :value="form.countryMarket || '—'" disabled />
            <div v-if="availableCountryMarkets.length > 1" style="font-size:12px;color:#faad14;margin-top:2px">
              该红人有多个服务国家/市场，请手动选择
            </div>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="备注">
        <a-textarea v-model:value="form.notes" :rows="2" placeholder="记录一些特殊情况" />
      </a-form-item>

      <a-divider orientation="left" style="font-size:13px">涉及的红人需求条目</a-divider>
      <a-table :columns="itemColumns" :data-source="form.items" :pagination="false" size="small" row-key="tempId">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'videoType'">
            <span v-if="!record.videoType" style="color:#faad14">（未选择）</span>
            <span v-else>{{ videoTypeLabel(record.videoType) }}</span>
          </template>
          <template v-if="column.key === 'platform'">{{ (record.platform || []).join('、') || '—' }}</template>
          <template v-if="column.key === 'clientUnitPrice'">
            <span style="color:#c00000">{{ record.clientUnitPrice ?? '—' }}</span>
          </template>
          <template v-if="column.key === 'influencerUnitCostPrice'">
            <span style="color:#c00000">{{ record.influencerUnitCostPrice ?? '—' }}</span>
          </template>
          <template v-if="column.key === 'action'">
            <a @click="openItemModal(record)">编辑</a>
            <a-divider type="vertical" />
            <a-tooltip v-if="record.fulfilledCount > 0" title="已经有关联的红人合作跟踪记录，不能删除">
              <span style="color:#bbb">已实施{{ record.fulfilledCount }}条</span>
            </a-tooltip>
            <a v-else style="color:#ff4d4f" @click="removeItem(record)">删除</a>
          </template>
        </template>
      </a-table>
      <a-button type="dashed" block style="margin-top:8px" @click="openItemModal()">
        + 新增涉及的红人需求条目
      </a-button>

      <a-row :gutter="16" style="margin-top:16px">
        <a-col :span="8">
          <div class="summary-item">
            <div class="summary-label">需求条目总数</div>
            <div class="summary-val">{{ totalItemCount }}</div>
          </div>
        </a-col>
        <a-col :span="8">
          <div class="summary-item">
            <div class="summary-label">客户合作总价格（$）</div>
            <div class="summary-val">{{ fmtNum(totalClientPrice) }}</div>
          </div>
        </a-col>
        <a-col :span="8">
          <div class="summary-item">
            <div class="summary-label">红人视频制作与发布总成本（$）</div>
            <div class="summary-val">{{ fmtNum(totalInfluencerCost) }}</div>
          </div>
        </a-col>
      </a-row>
    </a-form>

    <!-- 新增/编辑需求条目弹窗 -->
    <a-modal v-model:open="itemModalVisible" :title="editingTempId ? '编辑涉及的红人需求条目' : '新增涉及的红人需求条目'" width="480px" @ok="confirmAddItem">
      <a-form layout="vertical">
        <a-form-item label="项目视频类型" required>
          <a-select v-model:value="itemDraft.videoType" placeholder="选择项目视频类型">
            <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="合作平台" required>
          <a-select v-model:value="itemDraft.platform" mode="multiple" placeholder="可多选">
            <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="项目视频数目" required>
          <a-input-number v-model:value="itemDraft.videoCount" style="width:100%" :min="1" :precision="0" />
        </a-form-item>
        <a-form-item label="客户合作单价（$）">
          <template #label><span style="color:#c00000">客户合作单价（$，注意是单价）</span></template>
          <a-input-number v-model:value="itemDraft.clientUnitPrice" style="width:100%" :min="0" :precision="2" />
        </a-form-item>
        <a-form-item>
          <template #label><span style="color:#c00000">红人视频制作与发布单价成本（$，注意是单价）</span></template>
          <a-input-number v-model:value="itemDraft.influencerUnitCostPrice" style="width:100%" :min="0" :precision="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { requirementApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null },
  brands: { type: Array, default: () => [] },
  influencers: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved'])

const { getOptions } = useOptions()
const formRef = ref()
const saving  = ref(false)
const parsing = ref(false)
let itemSeq = 0

const form = reactive({
  id: null,
  internalRequirementNo: null,
  fullRequirementContent: '',
  influencerId: null,
  brandId: null,
  teamId: null,
  countryMarket: null,
  requirementMonth: currentMonth(),
  notes: '',
  items: []
})

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

const itemColumns = [
  { title: '项目视频类型', key: 'videoType', width: 130 },
  { title: '合作平台', key: 'platform', width: 160 },
  { title: '项目视频数目', dataIndex: 'videoCount', key: 'videoCount', width: 100 },
  { title: '客户合作单价（$）', key: 'clientUnitPrice', width: 130 },
  { title: '红人视频制作与发布单价成本（$）', key: 'influencerUnitCostPrice', width: 180 },
  { title: '操作', key: 'action', width: 140 }
]

const itemModalVisible = ref(false)
const editingTempId = ref(null)
const itemDraft = reactive({ videoType: null, platform: [], videoCount: null, clientUnitPrice: null, influencerUnitCostPrice: null })

function videoTypeLabel(v) {
  return getOptions('video_type').find(o => o.value === v)?.label
}

function comboKey(videoType, platform) {
  return videoType + '|' + [...(platform || [])].sort().join(',')
}

function openItemModal(record) {
  if (record) {
    editingTempId.value = record.tempId
    Object.assign(itemDraft, {
      videoType: record.videoType,
      platform: [...(record.platform || [])],
      videoCount: record.videoCount,
      clientUnitPrice: record.clientUnitPrice,
      influencerUnitCostPrice: record.influencerUnitCostPrice
    })
  } else {
    editingTempId.value = null
    Object.assign(itemDraft, { videoType: null, platform: [], videoCount: null, clientUnitPrice: null, influencerUnitCostPrice: null })
  }
  itemModalVisible.value = true
}

function confirmAddItem() {
  if (!itemDraft.videoType) { message.warning('请选择项目视频类型'); return }
  if (!itemDraft.platform || itemDraft.platform.length === 0) { message.warning('请选择合作平台'); return }
  if (!itemDraft.videoCount || itemDraft.videoCount <= 0) { message.warning('请填写项目视频数目'); return }
  const key = comboKey(itemDraft.videoType, itemDraft.platform)
  const dup = form.items.some(i => comboKey(i.videoType, i.platform) === key && i.tempId !== editingTempId.value)
  if (dup) {
    message.warning('这个项目视频类型-合作平台组合已经存在，不能重复添加')
    return
  }
  if (editingTempId.value) {
    const item = form.items.find(i => i.tempId === editingTempId.value)
    if (item.fulfilledCount > 0 && itemDraft.videoCount < item.fulfilledCount) {
      message.warning(`该条目已实施 ${item.fulfilledCount} 条，项目视频数目不能小于这个数`)
      return
    }
    Object.assign(item, {
      videoType: itemDraft.videoType,
      platform: [...itemDraft.platform],
      videoCount: itemDraft.videoCount,
      clientUnitPrice: itemDraft.clientUnitPrice,
      influencerUnitCostPrice: itemDraft.influencerUnitCostPrice
    })
  } else {
    form.items.push({
      tempId: ++itemSeq,
      id: null,
      videoType: itemDraft.videoType,
      platform: [...itemDraft.platform],
      videoCount: itemDraft.videoCount,
      clientUnitPrice: itemDraft.clientUnitPrice,
      influencerUnitCostPrice: itemDraft.influencerUnitCostPrice,
      fulfilledCount: 0
    })
  }
  itemModalVisible.value = false
}

function removeItem(record) {
  form.items = form.items.filter(i => i.tempId !== record.tempId)
}

const totalItemCount = computed(() => form.items.reduce((sum, i) => sum + (+i.videoCount || 0), 0))
const totalClientPrice = computed(() => form.items.reduce((sum, i) => sum + (+i.videoCount || 0) * (+i.clientUnitPrice || 0), 0))
const totalInfluencerCost = computed(() => form.items.reduce((sum, i) => sum + (+i.videoCount || 0) * (+i.influencerUnitCostPrice || 0), 0))
function fmtNum(v) {
  return parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 品牌方下拉只显示当前选中红人在红人模块里已关联过的品牌方
const availableBrands = computed(() => {
  if (!form.influencerId) return []
  const inf = props.influencers.find(i => i.id === form.influencerId)
  if (!inf || !inf.brandTeamPairs || !inf.brandTeamPairs.length) return []
  const brandIds = [...new Set(inf.brandTeamPairs.map(p => p.brandId))]
  return props.brands.filter(b => brandIds.includes(b.id))
})
const availableTeams = computed(() => {
  if (!form.influencerId || !form.brandId) return []
  const inf = props.influencers.find(i => i.id === form.influencerId)
  if (!inf || !inf.brandTeamPairs) return []
  return inf.brandTeamPairs.filter(p => p.brandId === form.brandId)
})
watch(availableTeams, (opts) => {
  if (opts.length === 1) form.teamId = opts[0].teamId ?? null
})
watch(availableBrands, (opts) => {
  if (opts.length === 1) form.brandId = opts[0].id
})

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
const availableCountryMarkets = computed(() => {
  if (!form.influencerId) return []
  const inf = props.influencers.find(i => i.id === form.influencerId)
  return inf ? splitMulti(inf.countryMarket) : []
})
watch(availableCountryMarkets, (opts) => {
  if (opts.length === 1) form.countryMarket = opts[0]
})

function onInfluencerChange() {
  form.brandId = null
  form.teamId = null
  form.countryMarket = null
}
function onBrandChange() {
  form.teamId = null
}

async function handleParseContent() {
  if (!form.fullRequirementContent || !form.fullRequirementContent.trim()) {
    message.warning('请先填写完整需求内容')
    return
  }
  parsing.value = true
  try {
    const res = await requirementApi.parseContent(form.fullRequirementContent)
    const data = res.data
    // 只有识别出的红人变了才清空品牌方/团队/服务国家市场——重新识别时如果还是同一个红人
    // （比如用户只是改了需求内容里的数量/单价重新提取），赋值同一个 id 不会触发响应式更新，
    // 之前已经自动带入的字段会被 onInfluencerChange 清空后再也填不回来，所以这里改成有条件清空
    if (form.influencerId !== data.influencerId) {
      form.brandId = null
      form.teamId = null
      form.countryMarket = null
    }
    form.influencerId = data.influencerId
    // 清空之前"提取需求内容"生成的、还没被合作跟踪实施过的条目，避免重新识别后条目越堆越多；
    // 已经被合作跟踪实施过的条目（fulfilledCount > 0）保留，不能凭空丢弃
    form.items = form.items.filter(i => i.fulfilledCount > 0)
    for (const item of data.items || []) {
      form.items.push({
        tempId: ++itemSeq,
        id: null,
        videoType: null,
        platform: item.platform || [],
        videoCount: item.videoCount,
        clientUnitPrice: item.clientUnitPrice,
        influencerUnitCostPrice: item.influencerUnitCostPrice,
        fulfilledCount: 0
      })
    }
    message.success(`已识别红人「${data.accountName}」，请手动选择识别出的条目的项目视频类型`)
  } catch {
    // 后端已返回具体报错文案，全局错误提示已经弹出，这里不用重复处理
  } finally {
    parsing.value = false
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    if (props.record) {
      const rec = props.record
      Object.assign(form, {
        id: rec.id,
        internalRequirementNo: rec.internalRequirementNo || null,
        fullRequirementContent: rec.fullRequirementContent || '',
        influencerId: rec.influencerId || null,
        brandId: rec.brandId || null,
        teamId: rec.teamId || null,
        countryMarket: rec.countryMarket || null,
        requirementMonth: rec.requirementMonth || currentMonth(),
        notes: rec.notes || '',
        items: []
      })
      loadItems(rec.id)
    } else {
      Object.assign(form, {
        id: null, internalRequirementNo: null, fullRequirementContent: '',
        influencerId: null, brandId: null, teamId: null, countryMarket: null,
        requirementMonth: currentMonth(), notes: '', items: []
      })
    }
  }
})

async function loadItems(requirementId) {
  const res = await requirementApi.items(requirementId)
  form.items = (res.data || []).map(i => ({
    tempId: ++itemSeq,
    id: i.id,
    videoType: i.videoType,
    platform: splitMulti(i.platform),
    videoCount: i.videoCount,
    clientUnitPrice: i.clientUnitPrice,
    influencerUnitCostPrice: i.influencerUnitCostPrice,
    fulfilledCount: i.fulfilledCount || 0
  }))
}

function close() { emit('update:visible', false) }

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  if (form.items.length === 0) {
    message.warning('请至少新增一条涉及的红人需求条目')
    return
  }
  if (form.items.some(i => !i.videoType)) {
    message.warning('有条目还没选择项目视频类型，请检查涉及的红人需求条目')
    return
  }
  saving.value = true
  try {
    await requirementApi.save({
      id: form.id,
      influencerId: form.influencerId,
      brandId: form.brandId,
      teamId: form.teamId,
      countryMarket: form.countryMarket,
      requirementMonth: form.requirementMonth,
      fullRequirementContent: form.fullRequirementContent || null,
      notes: form.notes || null,
      items: form.items.map(i => ({
        id: i.id,
        videoType: i.videoType,
        platform: i.platform,
        videoCount: i.videoCount,
        clientUnitPrice: i.clientUnitPrice,
        influencerUnitCostPrice: i.influencerUnitCostPrice
      }))
    })
    message.success(form.id ? '更新成功' : '创建成功')
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
.summary-item { text-align: center; background: #f8faff; border-radius: 8px; padding: 10px; }
.summary-label { font-size: 12px; color: #888; margin-bottom: 4px; }
.summary-val { font-size: 16px; font-weight: 700; }
</style>
