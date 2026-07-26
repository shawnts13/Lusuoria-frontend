<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">工资单</span>
      <a-space :size="16">
        <a-date-picker v-model:value="selectedMonth" picker="month" format="YYYYMM" value-format="YYYYMM"
          placeholder="选择月份" @change="loadAll" />
        <a-radio-group v-model:value="currency" button-style="solid" @change="loadAll">
          <a-radio-button value="USD">USD</a-radio-button>
          <a-radio-button value="RMB">RMB</a-radio-button>
        </a-radio-group>
      </a-space>
    </div>

    <template v-if="authStore.canManagePayslips">
      <!-- 管理层自己 -->
      <div class="management-card">
        <a-spin :spinning="loadingManagement">
          <template v-if="managementRow">
            <div class="mgmt-top">
              <span class="mgmt-title">管理层（{{ managementRow.employeeName }}）</span>
              <a-tag :color="managementRow.confirmed ? 'green' : 'orange'">
                {{ managementRow.confirmed ? '已确认' : '预计（实时更新）' }}
              </a-tag>
            </div>
            <div class="mgmt-body">
              <span class="mgmt-label">公司利润</span>
              <a class="mgmt-amount" @click="openDetail(managementRow)">{{ fmt(managementRow.totalAmount) }}</a>
              <a-space style="margin-left:24px">
                <a-button size="small" @click="openDetail(managementRow)">查看明细</a-button>
                <a-tooltip :title="managementRow.blockedReason">
                  <span>
                    <a-button v-if="!managementRow.confirmed" type="primary" size="small"
                      :disabled="!!managementRow.blockedReason" @click="confirmRow(managementRow)">确认</a-button>
                    <a-popconfirm v-else title="确认取消这份工资单的确认？" @confirm="unconfirmRow(managementRow)">
                      <a-button size="small">取消确认</a-button>
                    </a-popconfirm>
                  </span>
                </a-tooltip>
              </a-space>
            </div>
            <div v-if="managementRow.blockedReason && !managementRow.confirmed" class="mgmt-hint">
              {{ managementRow.blockedReason }}
            </div>
          </template>
        </a-spin>
      </div>

      <div class="filter-bar">
        <a-select v-model:value="roleFilter" placeholder="角色（默认全部）" style="width:180px" allow-clear @change="loadList">
          <a-select-option value="项目负责人">项目负责人</a-select-option>
          <a-select-option value="执行人员">执行人员</a-select-option>
          <a-select-option value="财务和IT后勤">财务和IT后勤</a-select-option>
          <a-select-option value="法务">法务</a-select-option>
        </a-select>
      </div>

      <a-table :columns="columns" :data-source="rows" :loading="loadingList" :pagination="false" row-key="employeeId">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="colorForValue(record.employeeRole)">{{ record.employeeRole }}</a-tag>
          </template>

          <template v-if="column.key === 'pay'">
            <template v-if="record.employeeRole === '项目负责人' || record.employeeRole === '执行人员'">
              <a @click="openDetail(record)">{{ record.videoCount ?? 0 }} 条</a>
              <span style="margin:0 4px">/</span>
              <a @click="openDetail(record)">{{ fmt(record.baseAmount) }}</a>
            </template>
            <template v-else-if="record.employeeRole === '财务' || record.employeeRole === 'IT后勤'">
              {{ fmt(record.baseAmount) }}
            </template>
            <template v-else-if="record.employeeRole === '法务'">
              <template v-if="record.legalSalarySet">
                {{ fmt(record.baseAmount) }}
                <a style="margin-left:8px" @click="openLegalSalaryModal(record)">编辑工资</a>
              </template>
              <a-button v-else size="small" @click="openLegalSalaryModal(record)">输入法务本月工资</a-button>
            </template>
          </template>

          <template v-if="column.key === 'tierBonus'">
            <span :style="record.tierBonusAmount != null ? '' : 'color:#bbb'">
              {{ record.tierBonusAmount != null ? fmt(record.tierBonusAmount) : '—' }}
            </span>
          </template>

          <template v-if="column.key === 'extraBonus'">
            <span>{{ record.extraBonusAmount != null ? fmt(record.extraBonusAmount) : '未设置' }}</span>
            <a style="margin-left:8px" @click="openExtraBonusModal(record)">设置奖金</a>
          </template>

          <template v-if="column.key === 'total'">{{ fmt(record.totalAmount) }}</template>

          <template v-if="column.key === 'confirm'">
            <a-space>
              <a-tag :color="record.confirmed ? 'green' : 'orange'">{{ record.confirmed ? '已确认' : '预计' }}</a-tag>
              <a-button v-if="!record.confirmed" type="primary" size="small" @click="confirmRow(record)">确认</a-button>
              <a-popconfirm v-else title="确认取消这份工资单的确认？" @confirm="unconfirmRow(record)">
                <a-button size="small">取消确认</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </template>

    <template v-else>
      <!-- 普通员工自己 -->
      <a-spin :spinning="loadingSelf">
        <div v-if="!authStore.employeeId" class="empty-hint">当前账号未关联员工记录，没有个人工资单。</div>
        <div v-else-if="selfDetail" class="self-card">
          <a-tag :color="selfDetail.confirmed ? 'green' : 'orange'">
            {{ selfDetail.confirmed ? '已确认' : '工资单预计（实时更新）' }}
          </a-tag>

          <div v-if="selfDetail.type === 'PROJECT_MANAGER'" class="self-line">
            <span>提成金额</span><span>{{ fmt(selfDetail.baseAmount) }}</span>
          </div>
          <div v-else-if="selfDetail.type === 'EXECUTOR'" class="self-line">
            <span>薪酬合计</span><span>{{ fmt(selfDetail.baseAmount) }}</span>
          </div>
          <div v-else class="self-line">
            <span>工资</span><span>{{ fmt(selfDetail.baseAmount) }}</span>
          </div>

          <div v-if="selfDetail.tierBonusAmount != null" class="self-line">
            <span>Bonus</span><span>{{ fmt(selfDetail.tierBonusAmount) }}</span>
          </div>
          <div v-if="selfDetail.extraBonusAmount != null" class="self-line">
            <span>奖金</span><span>{{ fmt(selfDetail.extraBonusAmount) }}</span>
          </div>

          <div class="self-line total">
            <span>总工资</span>
            <a v-if="selfDetail.type === 'PROJECT_MANAGER' || selfDetail.type === 'EXECUTOR'"
              @click="openSelfDetail">{{ fmt(selfDetail.totalAmount) }}</a>
            <span v-else>{{ fmt(selfDetail.totalAmount) }}</span>
          </div>

          <div v-if="selfDetail.confirmed" class="footer-hint">若有疑问，请向管理层联系。</div>
        </div>
      </a-spin>
    </template>

    <PayslipDetailModal v-model:visible="detailModalVisible" :employee-id="detailEmployeeId"
      :employee-name="detailEmployeeName" :year-month="selectedMonth" :currency="currency" />

    <a-modal v-model:open="extraBonusModalVisible" title="设置奖金" width="420px" @ok="submitExtraBonus"
      :confirm-loading="savingExtraBonus">
      <a-form layout="vertical">
        <a-form-item label="奖金金额（留空表示不发放/清除已设置的奖金）">
          <a-input-number v-model:value="extraBonusForm.amount" style="width:100%" :precision="2" placeholder="金额" />
        </a-form-item>
        <a-form-item label="币种">
          <a-radio-group v-model:value="extraBonusForm.currency">
            <a-radio-button value="USD">USD</a-radio-button>
            <a-radio-button value="RMB">RMB</a-radio-button>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="legalSalaryModalVisible" title="法务本月工资" width="360px" @ok="submitLegalSalary"
      :confirm-loading="savingLegalSalary">
      <a-form layout="vertical">
        <a-form-item label="本月工资（人民币）">
          <a-input-number v-model:value="legalSalaryForm.amountRmb" style="width:100%" :precision="2" placeholder="金额" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { payslipApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { colorForValue } from '../../utils/tagColor'
import PayslipDetailModal from './PayslipDetailModal.vue'

const authStore = useAuthStore()

const selectedMonth = ref(dayjs().format('YYYYMM'))
const currency = ref('USD')
const roleFilter = ref(undefined)

const loadingManagement = ref(false)
const loadingList = ref(false)
const loadingSelf = ref(false)

const managementRow = ref(null)
const rows = ref([])
const selfDetail = ref(null)

const detailModalVisible = ref(false)
const detailEmployeeId = ref(null)
const detailEmployeeName = ref('')

const columns = [
  { title: '姓名', dataIndex: 'employeeName', key: 'employeeName', width: 110 },
  { title: '角色', key: 'role', width: 110 },
  { title: '薪酬', key: 'pay', width: 220 },
  { title: '阶梯Bonus', key: 'tierBonus', width: 120 },
  { title: '奖金', key: 'extraBonus', width: 200 },
  { title: '总工资', key: 'total', width: 130 },
  { title: '状态/操作', key: 'confirm', width: 220 }
]

function fmt(val) {
  if (val == null) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  const prefix = currency.value === 'RMB' ? '¥' : '$'
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function openDetail(record) {
  detailEmployeeId.value = record.employeeId
  detailEmployeeName.value = record.employeeName
  detailModalVisible.value = true
}
function openSelfDetail() {
  detailEmployeeId.value = authStore.employeeId
  detailEmployeeName.value = authStore.displayName
  detailModalVisible.value = true
}

async function loadManagement() {
  if (!selectedMonth.value) return
  loadingManagement.value = true
  try {
    const res = await payslipApi.management(selectedMonth.value, currency.value)
    managementRow.value = res.data || null
  } finally {
    loadingManagement.value = false
  }
}

async function loadList() {
  if (!selectedMonth.value) return
  loadingList.value = true
  try {
    const res = await payslipApi.list(selectedMonth.value, roleFilter.value, currency.value)
    rows.value = res.data || []
  } finally {
    loadingList.value = false
  }
}

async function loadSelf() {
  if (!selectedMonth.value || !authStore.employeeId) return
  loadingSelf.value = true
  try {
    const res = await payslipApi.me(selectedMonth.value, currency.value)
    selfDetail.value = res.data || null
  } finally {
    loadingSelf.value = false
  }
}

function loadAll() {
  if (authStore.canManagePayslips) {
    loadManagement()
    loadList()
  } else {
    loadSelf()
  }
}

async function confirmRow(record) {
  try {
    await payslipApi.confirm(record.employeeId, selectedMonth.value)
    message.success('已确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '确认失败')
  }
}
async function unconfirmRow(record) {
  try {
    await payslipApi.unconfirm(record.employeeId, selectedMonth.value)
    message.success('已取消确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '取消确认失败')
  }
}

// ===== 设置奖金 =====
const extraBonusModalVisible = ref(false)
const savingExtraBonus = ref(false)
const extraBonusForm = reactive({ employeeId: null, amount: null, currency: 'USD' })

function openExtraBonusModal(record) {
  extraBonusForm.employeeId = record.employeeId
  extraBonusForm.amount = record.extraBonusAmountNative ?? null
  extraBonusForm.currency = record.extraBonusCurrencyNative
    || (['财务', 'IT后勤', '法务'].includes(record.employeeRole) ? 'RMB' : 'USD')
  extraBonusModalVisible.value = true
}
async function submitExtraBonus() {
  savingExtraBonus.value = true
  try {
    await payslipApi.setExtraBonus(extraBonusForm.employeeId, selectedMonth.value,
      extraBonusForm.amount, extraBonusForm.currency)
    message.success('已保存')
    extraBonusModalVisible.value = false
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingExtraBonus.value = false
  }
}

// ===== 法务本月工资 =====
const legalSalaryModalVisible = ref(false)
const savingLegalSalary = ref(false)
const legalSalaryForm = reactive({ employeeId: null, amountRmb: null })

function openLegalSalaryModal(record) {
  legalSalaryForm.employeeId = record.employeeId
  legalSalaryForm.amountRmb = record.legalSalarySet ? record.baseAmount : null
  legalSalaryModalVisible.value = true
}
async function submitLegalSalary() {
  if (legalSalaryForm.amountRmb == null) {
    message.error('请填写本月工资')
    return
  }
  savingLegalSalary.value = true
  try {
    await payslipApi.setLegalSalary(legalSalaryForm.employeeId, selectedMonth.value, legalSalaryForm.amountRmb)
    message.success('已保存')
    legalSalaryModalVisible.value = false
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingLegalSalary.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.management-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: #fafafa;
}
.mgmt-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.mgmt-title {
  font-size: 15px;
  font-weight: 600;
}
.mgmt-body {
  display: flex;
  align-items: center;
}
.mgmt-label {
  color: #666;
  margin-right: 12px;
}
.mgmt-amount {
  font-size: 20px;
  font-weight: 700;
}
.mgmt-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #fa8c16;
}
.filter-bar {
  margin-bottom: 12px;
}
.empty-hint {
  color: #888;
  padding: 40px 0;
  text-align: center;
}
.self-card {
  max-width: 480px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 20px;
}
.self-line {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}
.self-line.total {
  font-weight: 700;
  font-size: 18px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
  padding-top: 12px;
}
.footer-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
  text-align: right;
}
</style>
