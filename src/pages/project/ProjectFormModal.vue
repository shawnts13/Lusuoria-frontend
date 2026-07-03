<template>
  <a-modal :open="visible" :title="record ? '编辑项目' : '新建项目'"
    width="860px" :destroy-on-close="true" :confirm-loading="saving"
    @ok="handleSave" @cancel="emit('update:visible', false)">
    <a-form ref="formRef" :model="form"
      :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }" size="middle">
      <a-row :gutter="24">

        <!-- 左列：基本信息（所有角色可见可填） -->
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">基本信息</a-divider>

          <a-form-item label="项目建立月份" name="projectMonth"
            :rules="[{ required: true, message: '请选择项目建立月份' }]">
            <a-date-picker v-model:value="form.projectMonthVal" picker="month"
              format="YYYYMM" value-format="YYYYMM" style="width:100%"
              @change="v => form.projectMonth = v" />
          </a-form-item>

          <a-form-item label="项目类型" name="projectType"
            :rules="[{ required: true, message: '请选择项目类型' }]">
            <a-select v-model:value="form.projectType" @change="onTypeChange">
              <a-select-option value="OVERSEAS_INFLUENCER">海外红人</a-select-option>
              <a-select-option value="CHINA_INFLUENCER">中国红人</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="项目视频类型">
            <a-select v-model:value="form.videoType" allow-clear placeholder="选择视频类型">
              <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="品牌方" name="brandId"
            :rules="[{ required: true, message: '请选择品牌方' }]">
            <a-select v-model:value="form.brandId" show-search option-filter-prop="label">
              <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">
                {{ b.name }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="红人社媒完整名字">
            <a-select v-model:value="form.influencerId"
              show-search option-filter-prop="label" allow-clear>
              <a-select-option v-for="inf in influencers" :key="inf.id" :value="inf.id"
                :label="inf.accountName">
                {{ inf.teamNames ? `[${inf.teamNames.split(',')[0]}] ` : '' }}{{ inf.accountName }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="甲方订单号">
            <a-input v-model:value="form.clientOrderNo" />
          </a-form-item>

          <a-form-item label="合作内容">
            <a-input v-model:value="form.cooperationContent" />
          </a-form-item>

          <a-form-item label="自带资源/供应商">
            <a-switch v-model:checked="form.isOwnResource"
              checked-children="是" un-checked-children="否" />
          </a-form-item>

          <!--
            汇率：
            - ADMIN   → 可编辑
            - 其他角色（项目负责人/执行人员等）→ 只读展示，不渲染输入框
          -->
          <a-form-item label="汇率">
            <a-input-number v-if="canEditCommission" v-model:value="form.exchangeRate"
              style="width:100%" :precision="4" @change="calcPreview" />
            <span v-else>{{ form.exchangeRate ?? '—' }}</span>
          </a-form-item>

          <!-- 项目负责人：所有有写权限的角色都可以指定负责人 -->
          <a-form-item label="项目负责人">
            <a-select v-model:value="form.projectManagerId" allow-clear
              @change="onManagerChange">
              <a-select-option v-for="e in employees" :key="e.id" :value="e.id">
                {{ e.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <!-- 右列：财务信息（仅 ADMIN / AUDITOR 可见，其他角色此列完全不渲染） -->
        <a-col :span="12">
          <template v-if="canViewFinancials">
            <a-divider orientation="left" style="font-size:13px">收入 & 利润</a-divider>

            <a-form-item label="客户合作价格" name="clientPrice"
              :rules="[{ required: true, message: '请填写客户合作价格' }]">
              <a-input-number v-model:value="form.clientPrice"
                style="width:100%" :precision="2" @change="calcPreview" />
            </a-form-item>

            <a-form-item label="红人成本" v-if="form.projectType !== 'CHINA_INFLUENCER'">
              <a-input-number v-model:value="form.influencerCost"
                style="width:100%" :precision="2" @change="calcPreview" />
            </a-form-item>
            <a-form-item label="红人成本" v-else>
              <a-input-number :value="autoInfluencerCost" disabled style="width:100%" :precision="2" />
              <div style="font-size:12px;color:#888;margin-top:2px">中国红人按客户合作价格 65% 自动计算</div>
            </a-form-item>

            <a-form-item label="其他外部成本">
              <a-input-number v-model:value="form.otherExternalCost"
                style="width:100%" :precision="2" @change="calcPreview" />
            </a-form-item>

            <a-form-item label="内部执行成本">
              <a-input-number v-model:value="form.internalExecutionCost"
                style="width:100%" :precision="2" @change="calcPreview" />
            </a-form-item>

            <a-divider orientation="left" style="font-size:13px">提成</a-divider>

            <!--
              提成比例：
              - ADMIN         → 可编辑
              - AUDITOR       → 只读（canViewFinancials=true 但 canEditCommission=false）
                               直接不渲染输入框，用文本展示
            -->
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
                <!-- AUDITOR 可以看到提成比例但不能修改，直接用文本展示 -->
                <span style="font-size:15px; font-weight:600; color:#1677ff">
                  {{ form.commissionRateDisplay }}%
                </span>
              </template>
            </a-form-item>
          </template>
        </a-col>
      </a-row>

      <!-- 利润预览（仅 ADMIN / AUDITOR 可见） -->
      <template v-if="canViewFinancials">
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

      <!-- 状态区（所有角色可见，STAFF 可填） -->
      <a-row :gutter="24" style="margin-top:16px">
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">甲方状态</a-divider>
          <a-form-item label="甲方状态"
            :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
            <a-select v-model:value="form.clientStatus" :disabled="!!form.id">
              <a-select-option v-for="s in clientStatuses"
                :key="s.value" :value="s.value">{{ s.label }}</a-select-option>
            </a-select>
            <div v-if="form.id" style="font-size:12px;color:#ff4d4f">状态请使用"状态流转"功能修改</div>
          </a-form-item>
          <a-form-item label="合同签署"
            :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
            <a-switch v-model:checked="form.contractSigned"
              checked-children="已签" un-checked-children="未签" />
          </a-form-item>
          <a-form-item label="预计到账日"
            :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
            <a-date-picker v-model:value="form.expectedReceiptDate" value-format="YYYY-MM-DD" style="width:100%" />
          </a-form-item>
          <a-form-item label="实际到账日"
            :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
            <a-date-picker v-model:value="form.actualReceiptDate" value-format="YYYY-MM-DD" style="width:100%" />
          </a-form-item>
          <!-- 已到账金额：所有有写权限的角色均可填写 -->
          <a-form-item label="已到账金额"
            :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
            <a-input-number v-model:value="form.receivedAmount"
              style="width:100%" :precision="2" />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">内部状态</a-divider>
          <a-form-item label="内部结算状态"
            :label-col="{ span: 8 }" :wrapper-col="{ span: 14 }">
            <a-select v-model:value="form.internalStatus" :disabled="!!form.id">
              <a-select-option
                v-for="s in availableInternalStatuses"
                :key="s.value" :value="s.value">
                {{ s.label }}
              </a-select-option>
            </a-select>
            <div v-if="form.id" style="font-size:12px;color:#ff4d4f">状态请使用"状态流转"功能修改</div>
          </a-form-item>
          <a-form-item label="备注"
            :label-col="{ span: 8 }" :wrapper-col="{ span: 14 }">
            <a-textarea v-model:value="form.notes" :rows="4" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { projectApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { formatDate } from '../../utils/dateFormat'

const props = defineProps({
  visible:           Boolean,
  record:            Object,
  brands:            Array,
  influencers:       Array,
  employees:         Array,
  canApprove:        { type: Boolean, default: false },
  canViewFinancials: { type: Boolean, default: false },
  canEditCommission: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const { getOptions } = useOptions()
const formRef = ref()
const saving  = ref(false)

const clientStatuses = [
  { value: 'PENDING_SUBMIT',    label: '待提交' },
  { value: 'SUBMITTED',         label: '已提交' },
  { value: 'CLIENT_CONFIRMED',  label: '甲方已确认' },
  { value: 'CLIENT_RECONCILED', label: '甲方已对账' },
  { value: 'CONTRACT_SIGNED',   label: '合同已签署' },
  { value: 'PENDING_PAYMENT',   label: '待到账' },
  { value: 'PARTIAL_PAYMENT',   label: '部分到账' },
  { value: 'PAID',              label: '已到账' },
  { value: 'ABNORMAL',          label: '异常' }
]

const allInternalStatuses = [
  { value: 'PENDING_CALC',     label: '待核算',    adminOnly: false },
  { value: 'CALCULATED',       label: '已核算',    adminOnly: false },
  { value: 'PENDING_APPROVAL', label: '待老板审核', adminOnly: false },
  { value: 'CONFIRMED',        label: '已确认',    adminOnly: true  }, // 只有 ADMIN 可手动设为已确认
  { value: 'IN_PAYROLL',       label: '已进入工资', adminOnly: true  },
  { value: 'ARCHIVED',         label: '已归档',    adminOnly: true  }
]

// 非 ADMIN 看不到 adminOnly 的状态选项
const availableInternalStatuses = computed(() =>
  allInternalStatuses.filter(s => !s.adminOnly || props.canApprove)
)

const form = reactive({
  id: null,
  projectMonth: null, projectMonthVal: null,
  projectType: 'OVERSEAS_INFLUENCER',
  videoType: null,
  brandId: null, influencerId: null, projectManagerId: null,
  clientOrderNo: '', cooperationContent: '',
  isOwnResource: false,
  clientPrice: null,
  exchangeRate: 7.25,
  influencerCost: null,
  otherExternalCost: 0, internalExecutionCost: 0,
  commissionRate: 0, commissionRateDisplay: 0,
  clientStatus: 'PENDING_SUBMIT', internalStatus: 'PENDING_CALC',
  contractSigned: false,
  expectedReceiptDate: null, actualReceiptDate: null,
  receivedAmount: null, notes: ''
})

// 中国红人模式下，红人成本由客户合作价格自动算出（只读展示）
const autoInfluencerCost = computed(() => {
  if (form.projectType !== 'CHINA_INFLUENCER') return form.influencerCost
  return +((+form.clientPrice || 0) * 0.65).toFixed(2)
})

const preview = reactive({
  grossProfit: 0, distributableProfit: 0,
  commissionAmount: 0, companyNetProfit: 0, rmbRevenue: 0
})

watch(() => props.record, rec => {
  if (rec) {
    Object.assign(form, {
      id:                   rec.id,
      projectMonth:         rec.projectMonth,
      projectMonthVal:      rec.projectMonth,
      projectType:          rec.projectType,
      videoType:            rec.videoType             || null,
      brandId:              rec.brandId,
      influencerId:         rec.influencerId,
      projectManagerId:     rec.projectManagerId,
      clientOrderNo:        rec.clientOrderNo        || '',
      cooperationContent:   rec.cooperationContent   || '',
      isOwnResource:        rec.isOwnResource         || false,
      clientPrice:          rec.clientPrice,
      exchangeRate:         rec.exchangeRate          || 7.25,
      influencerCost:       rec.influencerCost,
      otherExternalCost:    rec.otherExternalCost     || 0,
      internalExecutionCost:rec.internalExecutionCost || 0,
      commissionRate:       rec.commissionRate        || 0,
      commissionRateDisplay:rec.commissionRate
                              ? +(rec.commissionRate * 100).toFixed(0) : 0,
      clientStatus:         rec.clientStatus          || 'PENDING_SUBMIT',
      internalStatus:       rec.internalStatus        || 'PENDING_CALC',
      contractSigned:       rec.contractSigned        || false,
      expectedReceiptDate:  rec.expectedReceiptDate
                              ? formatDate(rec.expectedReceiptDate) : null,
      actualReceiptDate:    rec.actualReceiptDate
                              ? formatDate(rec.actualReceiptDate)   : null,
      receivedAmount:       rec.receivedAmount,
      notes:                rec.notes                 || ''
    })
    calcPreview()
  } else {
    Object.assign(form, {
      id: null, projectMonth: null, projectMonthVal: null,
      projectType: 'OVERSEAS_INFLUENCER', videoType: null, brandId: null,
      influencerId: null, projectManagerId: null,
      clientOrderNo: '', cooperationContent: '',
      isOwnResource: false,
      clientPrice: null,
      exchangeRate: 7.25,
      influencerCost: null,
      otherExternalCost: 0, internalExecutionCost: 0,
      commissionRate: 0, commissionRateDisplay: 0,
      clientStatus: 'PENDING_SUBMIT', internalStatus: 'PENDING_CALC',
      contractSigned: false, expectedReceiptDate: null,
      actualReceiptDate: null, receivedAmount: null, notes: ''
    })
    Object.assign(preview, {
      grossProfit: 0, distributableProfit: 0,
      commissionAmount: 0, companyNetProfit: 0, rmbRevenue: 0
    })
  }
}, { immediate: true })

function onTypeChange() { form.influencerCost = null; calcPreview() }

function onManagerChange(id) {
  if (!id || !props.canEditCommission) return
  const emp = props.employees?.find(e => e.id === id)
  if (emp?.defaultCommissionRate) {
    form.commissionRate        = emp.defaultCommissionRate
    form.commissionRateDisplay = +(emp.defaultCommissionRate * 100).toFixed(0)
    calcPreview()
  }
}

function calcPreview() {
  const price = +form.clientPrice         || 0
  const other = +form.otherExternalCost   || 0
  const exec  = +form.internalExecutionCost || 0
  const rate  = +form.commissionRate      || 0
  const rate2 = +form.exchangeRate        || 0
  let infCost = 0, gross = 0, distrib = 0

  if (form.projectType === 'CHINA_INFLUENCER') {
    infCost = +(price * 0.65).toFixed(2)
    gross   = +(price * 0.35).toFixed(2)
    distrib = +(gross - other - exec).toFixed(2)
  } else {
    infCost = +form.influencerCost || 0
    gross   = +(price - infCost - other).toFixed(2)
    distrib = +(gross - exec).toFixed(2)
  }
  const commission = +(distrib * rate).toFixed(2)
  const companyUsd  = +(distrib - commission).toFixed(2)
  preview.grossProfit          = gross
  preview.distributableProfit  = distrib
  preview.commissionAmount     = commission
  preview.companyNetProfit     = companyUsd
  preview.rmbRevenue           = rate2 > 0 ? +(companyUsd * rate2).toFixed(2) : 0
}

async function handleSave() {
  if (saving.value) return   // 防止表单校验期间被连续点击导致重复提交
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await projectApi.save({ ...form })
    message.success(form.id ? '更新成功' : '创建成功')
    emit('update:visible', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
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
