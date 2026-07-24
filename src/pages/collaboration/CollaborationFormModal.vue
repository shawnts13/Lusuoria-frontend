<template>
  <a-modal :open="visible" :title="form.id ? '编辑合作跟踪' : '新建合作跟踪'"
    width="640px" :confirm-loading="saving"
    @ok="handleSave" @cancel="close" :destroy-on-close="false">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">

      <a-form-item label="内部需求编号">
        <a-input-group compact style="display:flex">
          <a-input :value="form.internalRequirementNo" disabled placeholder="未关联" style="flex:1" />
          <a-button :disabled="!form.influencerId" @click="linkPickerVisible = true">关联红人需求</a-button>
          <a-popconfirm v-if="form.internalRequirementNo && form.id"
            title="确认解除这条记录跟内部需求编号的关联？（误关联到别的需求时用）"
            @confirm="handleUnlinkRequirement">
            <a-button>解绑</a-button>
          </a-popconfirm>
          <a-button v-else-if="form.internalRequirementNo" @click="handleUnlinkRequirement">解绑</a-button>
        </a-input-group>
        <div style="font-size:12px;color:#c00000;margin-top:2px">
          没有内部需求编号？请先在"1.红人需求管理"模块里新增对应红人的需求
        </div>
      </a-form-item>

      <a-form-item v-if="form.internalProjectNo" label="内部项目编号">
        <a-input :value="form.internalProjectNo" disabled />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="红人社媒完整名字" name="influencerId">
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
          <a-form-item label="品牌方" name="brandId">
            <a-select v-model:value="form.brandId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              :placeholder="form.influencerId ? '选择品牌方' : '请先选择红人'"
              :disabled="!form.influencerId || availableBrands.length <= 1"
              @change="onBrandChange">
              <a-select-option v-for="b in availableBrands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
            </a-select>
            <div v-if="form.influencerId && availableBrands.length === 0"
              style="font-size:12px;color:#c00000;margin-top:2px">
              该红人尚未在红人模块关联任何品牌方，请先去红人模块维护
            </div>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16" v-if="form.influencerId">
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
            <div v-if="availableTeams.length > 1" style="font-size:12px;color:#faad14;margin-top:2px">
              该红人在此品牌方下关联了多个团队，请明确选择其中一个
            </div>
          </a-form-item>
        </a-col>
        <a-col :span="12" v-else>
          <div style="font-size:12px;color:#c00000;margin-top:8px">
            请先选择品牌方，才能选择红人团队
          </div>
        </a-col>
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
      <div v-if="form.influencerId" style="font-size:12px;color:#c00000;margin:-8px 0 16px 4px">
        找不到品牌方、红人团队？请先维护"红人管理"模块下该红人的数据。
      </div>

      <a-form-item label="合作平台">
        <a-select v-model:value="form.platforms" mode="multiple" allow-clear placeholder="可多选">
          <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="需求内容">
        <a-textarea v-model:value="form.demandContent" :rows="2" placeholder="填写具体产品名，如 手持游戏机、Padfolio文件夹" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="16">
          <a-form-item label="视频发布链接">
            <div v-for="(link, idx) in form.publishLinks" :key="'pl-' + idx"
              style="display:flex;gap:8px;margin-bottom:6px">
              <a-input v-model:value="form.publishLinks[idx]" placeholder="前期可留空" style="flex:1" />
              <a-button danger size="small" @click="removePublishLink(idx)">删除</a-button>
            </div>
            <a-button type="dashed" size="small" block @click="addPublishLink">+ 添加新链接</a-button>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="视频发布时间">
            <a-date-picker v-if="canEditPublishDate" v-model:value="form.publishDate"
              style="width:100%" value-format="YYYY-MM-DD" />
            <span v-else>{{ form.publishDate || '—' }}</span>
            <div v-if="!canEditPublishDate" style="font-size:12px;color:#888;margin-top:2px">
              仅管理员可编辑，视频项目进度流转至已发布相关状态时系统会自动填写
            </div>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="视频项目进度">
            <a-select v-model:value="form.progress" :disabled="!!form.id" allow-clear placeholder="选择视频项目进度">
              <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value"
                :disabled="FINANCE_ONLY_PROGRESS.includes(o.value) && !authStore.canSetFinanceSettlementProgress">
                {{ o.label }}
              </a-select-option>
            </a-select>
            <div v-if="form.id" style="font-size:12px;color:#ff4d4f;margin-top:2px">视频项目进度请使用"状态流转"功能修改</div>
            <div v-else-if="!authStore.canSetFinanceSettlementProgress" style="font-size:12px;color:#888;margin-top:2px">
              "已加入客户未结算列表"/"客户已结算"仅能由财务/管理层设置
            </div>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="红人结款进度">
            <a-select v-model:value="form.influencerPaymentProgress" allow-clear placeholder="选择红人结款进度"
              :disabled="!!form.id || !paymentProgressEnabled">
              <a-select-option v-for="o in getOptions('influencer_payment_progress')" :key="o.value" :value="o.value"
                :disabled="SYSTEM_MANAGED_PROGRESS.includes(o.value)">
                {{ o.label }}
              </a-select-option>
            </a-select>
            <div v-if="form.id" style="font-size:12px;color:#888;margin-top:2px">
              该状态通过"红人需求管理"的"上传Invoice"（若相关品牌方涉及）、以及管理层的"红人结款"
              功能来流转（项目负责人/执行人员不涉及），不能在这里手动修改
            </div>
            <template v-else>
              <div v-if="!paymentProgressEnabled" style="font-size:12px;color:#888;margin-top:2px">
                仅当视频项目进度为"已发布（未结算）"、"已加入客户未结算列表"、"客户已结算"时才能设置
              </div>
              <div style="font-size:12px;color:#ff4d4f;margin-top:2px">
                "已纳入红人结款批次"/"已纳入红人结款批次（缺少invoice）"仅能由管理层通过"红人结款"功能设置，此处无法选中
              </div>
            </template>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="项目视频类型">
            <a-select v-model:value="form.videoType" allow-clear placeholder="选择视频类型">
              <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="客户方的项目订单">
            <a-input v-model:value="form.clientOrderId" placeholder="拿到后填写" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="客户方付款批次">
            <a-input v-model:value="form.clientPaymentBatch" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item v-if="form.videoType === 'OLD_MATERIAL_REPOST'" label="采买旧视频的原链接">
        <a-input v-model:value="form.oldMaterialSourceLink" placeholder="填写被采买的那条旧视频的原始链接" />
        <div style="font-size:12px;color:#888;margin-top:2px">
          系统会自动查重（同一视频不同链接写法也能识别），重复采买会被拒绝保存
        </div>
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="项目负责人">
            <a-select v-model:value="form.projectManagerId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              placeholder="选择负责人" @change="onManagerChange">
              <a-select-option v-for="e in projectManagerCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="内部执行人员（可选）">
            <a-select v-model:value="form.executorId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              placeholder="选择执行人员">
              <a-select-option v-for="e in executorCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <!-- 这两个字段是"基础财务字段"，GUEST 之外所有角色都能看/改，不受 canViewFinancials（仅 ADMIN/AUDITOR）限制 -->
      <template v-if="canViewBaselineFinancials">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="红人视频制作与发布成本（美金）">
              <a-input-number v-model:value="form.influencerCost"
                style="width:100%" :precision="2" placeholder="金额" @change="calcPreview" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户合作价格（美金）">
              <a-input-number v-model:value="form.clientPrice"
                style="width:100%" :precision="2" placeholder="金额" @change="calcPreview" />
            </a-form-item>
          </a-col>
        </a-row>
      </template>

      <template v-if="canViewFinancials">
        <a-divider orientation="left" style="font-size:13px">财务信息</a-divider>
        <!--
          以下字段 2026-07 从"项目订单"模块迁移过来：
          - 汇率：仅 ADMIN 可编辑，其他角色（AUDITOR/项目负责人/执行人员）只读展示
          - 其他外部成本/内部执行成本：写权限由后端按 ProjectFieldVisibility 分级校验，
            前端这里不满足条件时后端会忽略提交的值，不强行在前端隐藏输入框（跟原项目订单一致）
          - 提成比例：仅 ADMIN 可编辑
        -->
        <a-row :gutter="16">
          <a-col :span="8" v-if="canViewCostBookkeeping">
            <a-form-item label="汇率">
              <a-input-number v-if="canEditCommission" v-model:value="form.exchangeRate"
                style="width:100%" :precision="4" @change="calcPreview" />
              <span v-else>{{ form.exchangeRate ?? '—' }}</span>
            </a-form-item>
          </a-col>
          <a-col :span="8" v-if="canViewCostBookkeeping">
            <a-form-item label="其他外部成本（人民币）">
              <a-input-number v-model:value="form.otherExternalCost"
                style="width:100%" :precision="2" @change="calcPreview" />
            </a-form-item>
          </a-col>
          <a-col :span="canViewCostBookkeeping ? 8 : 24">
            <a-form-item label="内部执行成本（人民币）">
              <a-input-number v-model:value="form.internalExecutionCost"
                style="width:100%" :precision="2" @change="calcPreview" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16" v-if="canViewCostBookkeeping">
          <a-col :span="24">
            <a-form-item label="外部成本备注">
              <a-textarea v-model:value="form.otherExternalCostNote" :rows="2"
                placeholder="记录其他外部成本的来源和其他备注，如物流成本等" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left" style="font-size:13px">提成</a-divider>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="提成比例">
              <template v-if="canEditCommission">
                <a-input-number
                  v-model:value="form.commissionRateDisplay"
                  style="width:100%" :min="0" :max="100" :precision="0"
                  :formatter="v => v + '%'" :parser="v => v.replace('%', '')"
                  @change="v => { form.commissionRate = v / 100; calcPreview() }"
                />
              </template>
              <template v-else>
                <span style="font-size:15px; font-weight:600; color:#1677ff">
                  {{ form.commissionRateDisplay }}%
                </span>
              </template>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider>利润预览（实时计算）</a-divider>
        <a-row :gutter="16" class="profit-preview">
          <a-col :span="6">
            <div class="pv-item">
              <div class="pv-label">项目毛利</div>
              <div class="pv-val" :class="preview.grossProfit >= 0 ? 'pos' : 'neg'">
                {{ fmtNum(preview.grossProfit) }}
              </div>
            </div>
          </a-col>
          <a-col :span="6">
            <div class="pv-item">
              <div class="pv-label">可分配利润</div>
              <div class="pv-val" :class="preview.distributableProfit >= 0 ? 'pos' : 'neg'">
                {{ fmtNum(preview.distributableProfit) }}
              </div>
            </div>
          </a-col>
          <a-col :span="6">
            <div class="pv-item">
              <div class="pv-label">负责人提成</div>
              <div class="pv-val warn">{{ fmtNum(preview.commissionAmount) }}</div>
            </div>
          </a-col>
          <a-col :span="6">
            <div class="pv-item">
              <div class="pv-label">公司利润（美金）</div>
              <div class="pv-val" :class="preview.companyNetProfit >= 0 ? 'pos' : 'neg'">
                {{ fmtNum(preview.companyNetProfit) }}
              </div>
            </div>
          </a-col>
        </a-row>
        <a-row :gutter="16" class="profit-preview" style="margin-top:8px">
          <a-col :span="6" :offset="9">
            <div class="pv-item">
              <div class="pv-label">公司利润（人民币）</div>
              <div class="pv-val" :class="preview.rmbRevenue >= 0 ? 'pos' : 'neg'">
                ¥{{ fmtNum(preview.rmbRevenue) }}
              </div>
            </div>
          </a-col>
        </a-row>
      </template>

      <a-form-item label="备注">
        <a-textarea v-model:value="form.notes" :rows="2" placeholder="记录一些特殊情况" />
      </a-form-item>

    </a-form>

    <RequirementLinkPickerModal
      v-model:visible="linkPickerVisible"
      :influencer-id="form.influencerId"
      @confirm="onRequirementLinked"
    />
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import RequirementLinkPickerModal from '../requirement/RequirementLinkPickerModal.vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { useAuthStore } from '../../store/auth'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null },
  canViewFinancials: { type: Boolean, default: false },
  canViewBaselineFinancials: { type: Boolean, default: false },
  canEditCommission: { type: Boolean, default: false },
  canEditPublishDate: { type: Boolean, default: false },
  brands: { type: Array, default: () => [] },
  influencers: { type: Array, default: () => [] },
  employees: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved', 'need-executor-cost'])

const { getOptions } = useOptions()
const authStore = useAuthStore()
// 跟后端 requireFinanceForSettlementProgress() 保持一致：这两个状态只能由财务/管理层设置
const FINANCE_ONLY_PROGRESS = ['JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']
// 汇率/其他外部成本（人民币）/外部成本备注这几个财务记账细节字段的可见性，统一用
// authStore.canViewCostBookkeeping（跟后端 ProjectFieldVisibility 的 FULL 层级判定保持
// 一致）。"内部执行成本"不受这里影响，因为项目负责人可能涉及设置执行人员的成本，
// 始终按 canViewFinancials 展示
const canViewCostBookkeeping = computed(() => authStore.canViewCostBookkeeping)
const linkPickerVisible = ref(false)
const formRef = ref()
const saving  = ref(false)

const form = reactive({
  id: null,
  internalProjectNo: null,
  internalRequirementNo: null,
  brandId: null, influencerId: null, teamId: null, countryMarket: null,
  platforms: [], demandContent: '',
  publishLinks: [''], publishDate: null,
  progress: null, influencerPaymentProgress: null, videoType: null, oldMaterialSourceLink: null, clientOrderId: '', clientPaymentBatch: '',
  projectManagerId: null, executorId: null,
  influencerCost: null, clientPrice: null, notes: '',
  exchangeRate: null, otherExternalCost: 0, otherExternalCostNote: '', internalExecutionCost: 0,
  commissionRate: 0, commissionRateDisplay: 0
})

const preview = reactive({
  grossProfit: 0, distributableProfit: 0,
  commissionAmount: 0, companyNetProfit: 0, rmbRevenue: 0
})

const rules = {
  influencerId: [{ required: true, message: '请选择红人社媒完整名字', trigger: 'change' }]
}

// 服务国家/市场选项：来自选中红人在红人库里维护的服务国家/市场（可能多个，换行分隔）。
// 只有 1 个选项时自动带入（下面的 watch 处理），有多个时才展示下拉框让用户选一个
// ——一条视频/一次合作只会涉及一个国家/市场，不像红人库本身那样允许多选
const availableCountryMarkets = computed(() => {
  if (!form.influencerId) return []
  const inf = props.influencers.find(i => i.id === form.influencerId)
  return inf ? splitMulti(inf.countryMarket) : []
})
watch(availableCountryMarkets, (opts) => {
  if (opts.length === 1) form.countryMarket = opts[0]
})

// 品牌方下拉只显示当前选中红人在红人模块里已关联过的品牌方（不管那个品牌方下有没有配团队）
const availableBrands = computed(() => {
  if (!form.influencerId) return []
  const inf = props.influencers.find(i => i.id === form.influencerId)
  if (!inf || !inf.brandTeamPairs || !inf.brandTeamPairs.length) return []
  const brandIds = [...new Set(inf.brandTeamPairs.map(p => p.brandId))]
  return props.brands.filter(b => brandIds.includes(b.id))
})

// 团队选项：跟着选中的品牌方走。0个选项时不允许选；1个选项时自动带入且禁用选择框；
// 多个选项时列出来让用户明确选择其中一个（可能包含"不涉及团队"这个选项）
const availableTeams = computed(() => {
  if (!form.influencerId || !form.brandId) return []
  const inf = props.influencers.find(i => i.id === form.influencerId)
  if (!inf || !inf.brandTeamPairs) return []
  return inf.brandTeamPairs.filter(p => p.brandId === form.brandId)
})

// 项目负责人只能选"项目负责人"或"管理层"角色；内部执行人员只能选"执行人员"角色
const projectManagerCandidates = computed(() =>
  props.employees.filter(e => e.role === '项目负责人' || e.role === '管理层'))
const executorCandidates = computed(() =>
  props.employees.filter(e => e.role === '执行人员'))

// 红人结款进度只有在视频项目进度达到前置条件时才能设置，跟后端
// CollaborationProgress.allowsPaymentProgress() 保持一致。这个字段只有"新建"时能在这里手动填
// 一个初始值（编辑已有记录时这里永远禁用，见上面的提示文案）——2026-07 起"状态流转"弹窗已经
// 不再提供这个字段的编辑入口，改成完全由"红人需求管理"上传Invoice/"红人结款"纳入批次来流转
const QUALIFYING_PROGRESS = ['PUBLISHED_UNSETTLED', 'JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']
const paymentProgressEnabled = computed(() => !!form.progress && QUALIFYING_PROGRESS.includes(form.progress))

// "已纳入红人结款批次"这两个状态只能由红人结款模块内部设置：选项本身仍然展示出来（不隐藏），
// 只是单独禁用这两项，不让用户选中，跟后端 InfluencerPaymentProgress.isSystemManagedOnly() 保持一致
const SYSTEM_MANAGED_PROGRESS = ['INCLUDED_IN_PAYMENT_BATCH', 'INCLUDED_IN_PAYMENT_BATCH_MISSING_INVOICE']
watch(() => form.progress, () => {
  if (!paymentProgressEnabled.value) form.influencerPaymentProgress = null
})

watch(() => props.visible, (v) => {
  if (v) {
    if (props.record) {
      const rec = props.record
      Object.assign(form, {
        id:            rec.id,
        internalProjectNo: rec.internalProjectNo || null,
        internalRequirementNo: rec.internalRequirementNo || null,
        brandId:       rec.brandId      || null,
        teamId:        rec.teamId       || null,
        influencerId:  rec.influencerId || null,
        countryMarket: rec.countryMarket || null,
        platforms:     splitMulti(rec.platform),
        demandContent: rec.demandContent || '',
        publishLinks:  rec.publishLink ? splitLinks(rec.publishLink) : [''],
        publishDate:   rec.publishDate ? formatDate(rec.publishDate) : null,
        progress:      rec.progress      || null,
        influencerPaymentProgress: rec.influencerPaymentProgress || null,
        videoType:     rec.videoType     || null,
        oldMaterialSourceLink: rec.oldMaterialSourceLink || null,
        clientOrderId: rec.clientOrderId || '',
        clientPaymentBatch: rec.clientPaymentBatch || '',
        projectManagerId: rec.projectManagerId || null,
        executorId: rec.executorId || null,
        influencerCost: rec.influencerCost ?? null,
        clientPrice:    rec.clientPrice    ?? null,
        notes:          rec.notes          || '',
        exchangeRate:   rec.exchangeRate   ?? null,
        otherExternalCost:     rec.otherExternalCost     || 0,
        otherExternalCostNote: rec.otherExternalCostNote || '',
        internalExecutionCost: rec.internalExecutionCost || 0,
        commissionRate:        rec.commissionRate        || 0,
        commissionRateDisplay: rec.commissionRate
                                  ? +(rec.commissionRate * 100).toFixed(0) : 0
      })
      calcPreview()
    } else {
      Object.assign(form, {
        id:null, internalProjectNo:null, internalRequirementNo:null, brandId:null, influencerId:null, teamId:null, countryMarket:null, platforms:[], demandContent:'',
        publishLinks:[''], publishDate:null, progress:null, influencerPaymentProgress:null, videoType:null, oldMaterialSourceLink:null, clientOrderId:'', clientPaymentBatch:'',
        // 项目负责人默认填成自己（仅当创建人的员工角色是"项目负责人"/"管理层"时），依然可以改；
        // 执行人员角色理论上不会新建跟踪，万一新建也不自动填，保持空
        projectManagerId: authStore.canDefaultAsProjectManager ? authStore.employeeId : null,
        executorId:null,
        influencerCost:null, clientPrice:null, notes:'',
        exchangeRate:null, otherExternalCost:0, otherExternalCostNote:'', internalExecutionCost:0,
        commissionRate:0, commissionRateDisplay:0
      })
      Object.assign(preview, {
        grossProfit: 0, distributableProfit: 0,
        commissionAmount: 0, companyNetProfit: 0, rmbRevenue: 0
      })
    }
  }
})

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
// 链接只能按换行拆分，不能按逗号——链接本身（query string）里经常带逗号，按逗号拆会拆坏
function splitLinks(str) {
  if (!str) return []
  return str.split('\n').map(s => s.trim()).filter(Boolean)
}
function addPublishLink() { form.publishLinks.push('') }
function removePublishLink(idx) {
  form.publishLinks.splice(idx, 1)
  if (form.publishLinks.length === 0) form.publishLinks.push('')
}
function onInfluencerChange() {
  // 切换红人后，原选中的品牌方/服务国家/市场可能不再适用，清空让用户重新选
  form.brandId = null
  form.teamId = null
  form.countryMarket = null
}

// "关联红人需求"选择器确认后：自动带入内部需求编号 + 红人社媒完整名字/品牌方/红人团队/
// 服务国家/市场/合作平台/项目视频类型
function onRequirementLinked(data) {
  form.internalRequirementNo = data.internalRequirementNo
  form.influencerId = data.influencerId
  form.brandId = data.brandId
  form.teamId = data.teamId
  form.countryMarket = data.countryMarket
  form.platforms = data.platform || []
  form.videoType = data.videoType
}

// "解绑"：还没保存过的新记录只是本地暂存的值，直接清空即可；已经保存过的记录，
// 内部需求编号已经落库了，要调专门的解绑接口（立即生效，不用等这个表单的"保存"按钮）
async function handleUnlinkRequirement() {
  if (!form.internalRequirementNo) return
  if (!form.id) {
    form.internalRequirementNo = null
    return
  }
  try {
    await collaborationApi.unlinkRequirement(form.id)
    form.internalRequirementNo = null
    message.success('已解除内部需求编号关联')
    emit('saved')
  } catch (e) {
    message.error(e?.response?.data?.message || '解绑失败')
  }
}

function onManagerChange(id) {
  if (!id || !props.canEditCommission) return
  const emp = props.employees?.find(e => e.id === id)
  // 用 != null 而不是真值判断：提成比例可以合法地是 0（0%），真值判断会把 0 当成"没有默认值"
  // 从而漏掉覆盖，导致重新选负责人后提成比例还残留着上一个负责人的值（一个已确认过的 bug）
  if (emp && emp.defaultCommissionRate != null) {
    form.commissionRate        = emp.defaultCommissionRate
    form.commissionRateDisplay = +(emp.defaultCommissionRate * 100).toFixed(0)
    calcPreview()
  }
}

// 利润预览：跟后端 ProfitCalculator 保持一致的计算口径（2026-07 从"项目订单"模块迁移过来）
function calcPreview() {
  const price = +form.clientPrice || 0
  const otherRmb = +form.otherExternalCost      || 0
  const execRmb  = +form.internalExecutionCost  || 0
  const rate  = +form.commissionRate            || 0
  const rate2 = +form.exchangeRate              || 0
  const other = rate2 > 0 ? +(otherRmb / rate2).toFixed(2) : 0
  const exec  = rate2 > 0 ? +(execRmb / rate2).toFixed(2) : 0

  const infCost = +form.influencerCost || 0
  const gross   = +(price - infCost - other).toFixed(2)
  const distrib = +(gross - exec).toFixed(2)
  const commission = +(distrib * rate).toFixed(2)
  const companyUsd  = +(distrib - commission).toFixed(2)
  preview.grossProfit          = gross
  preview.distributableProfit  = distrib
  preview.commissionAmount     = commission
  preview.companyNetProfit     = companyUsd
  preview.rmbRevenue           = rate2 > 0 ? +(companyUsd * rate2).toFixed(2) : 0
}

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
}

function onBrandChange() {
  form.teamId = null
}

// 团队只有1个选项时自动带入（不管是不是"不涉及团队"这个唯一选项）；0个或多个都不自动填
watch(availableTeams, (opts) => {
  if (opts.length === 1) {
    form.teamId = opts[0].teamId ?? null
  }
})
// 品牌方只有1个选项时同样自动带入，省得再手动选一次
watch(availableBrands, (opts) => {
  if (opts.length === 1) {
    form.brandId = opts[0].id
  }
})

function close() { emit('update:visible', false) }

async function doSave() {
  if (saving.value) return   // 防止连续点击导致重复提交
  saving.value = true
  try {
    const payload = {
      id:            form.id,
      internalRequirementNo: form.internalRequirementNo || null,
      brandId:       form.brandId,
      teamId:        form.teamId,
      influencerId:  form.influencerId,
      countryMarket: form.countryMarket || null,
      platform:      form.platforms.join('\n') || null,
      demandContent: form.demandContent || null,
      publishLink:   form.publishLinks.map(l => l.trim()).filter(Boolean).join('\n') || null,
      publishDate:   form.publishDate || null,
      progress:      form.progress || null,
      influencerPaymentProgress: paymentProgressEnabled.value ? (form.influencerPaymentProgress || null) : null,
      videoType:     form.videoType || null,
      oldMaterialSourceLink: form.videoType === 'OLD_MATERIAL_REPOST' ? (form.oldMaterialSourceLink || null) : null,
      clientOrderId: form.clientOrderId || null,
      clientPaymentBatch: form.clientPaymentBatch || null,
      projectManagerId: form.projectManagerId || null,
      executorId: form.executorId || null,
      influencerCost: form.influencerCost,
      clientPrice:    form.clientPrice,
      exchangeRate:   form.exchangeRate,
      otherExternalCost:     form.otherExternalCost,
      otherExternalCostNote: form.otherExternalCostNote || null,
      internalExecutionCost: form.internalExecutionCost,
      commissionRate:        form.commissionRate,
      notes:          form.notes
    }
    const res = await collaborationApi.save(payload)

    // 后端用特殊 code 表示：去重命中
    if (res.code === 4091) {
      saving.value = false
      Modal.warning({ title: '无法保存', content: res.message })
      return
    }

    message.success('保存成功')
    emit('saved')
    close()

    // 编辑时如果因为填写了"视频发布链接"触发了自动流转到"已发布（未结算）"，
    // 后端会跟正常状态流转一样判断要不要弹"设置内部执行成本"，这里按标记弹出即可
    // （accountName/executorName 由上层列表页统一按 id 补齐，这里传原始记录即可）
    if (res.data?.needExecutorCost) {
      emit('need-executor-cost', res.data)
    }
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  doSave()
}
</script>

<style scoped>
.profit-preview {
  background: #f8faff;
  border-radius: 8px;
  padding: 16px 8px;
  border: 1px solid #e6f0ff;
}
.pv-item  { text-align: center; }
.pv-label { font-size: 12px; color: #888; margin-bottom: 4px; }
.pv-val   { font-size: 18px; font-weight: 700; }
.pos  { color: #52c41a; }
.neg  { color: #ff4d4f; }
.warn { color: #faad14; }
</style>
