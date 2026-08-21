<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">员工管理</span>
      <a-space>
        <a-button @click="employeeApi.exportExcel()">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <a-button type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新建员工
        </a-button>
      </a-space>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading"
        row-key="id" size="middle" :pagination="tablePagination">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag v-if="record.role" :color="colorForValue(record.role)">{{ record.role }}</a-tag>
            <span v-else style="color:#bbb">—</span>
            <!-- "项目管理员"是叠加在角色之上的独立身份（2026-08-21 新增），不是 role 本身的值，
                 所以单独加一个标签，不跟角色标签合并，颜色特意跟角色标签体系区分开（用固定的
                 紫色而不是 colorForValue 生成色，避免恰好撞上某个角色本身的颜色） -->
            <a-tag v-if="record.projectAdminSince" color="purple" style="margin-left:4px">项目管理员</a-tag>
          </template>
          <template v-if="column.key === 'email'">
            <span v-if="record.email">{{ record.email }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'notes'">
            <span v-if="record.notes" :title="record.notes">{{ record.notes }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'salaryInfo'">
            <template v-if="isCommissionRole(record.role)">
              <div style="font-size:12px;line-height:1.8">
                <div>
                  <span style="color:#595959">默认提成：</span>
                  <span v-if="record.defaultCommissionRate != null"
                    v-html="highlightAmounts((parseFloat(record.defaultCommissionRate) * 100).toFixed(0) + '%')"></span>
                  <span v-else style="color:#bbb">—</span>
                </div>
                <div v-if="bonusTierSummary(record.id, record.bonusTierCurrency)">
                  <span style="color:#595959">Bonus：</span>
                  <span v-html="highlightAmounts(bonusTierSummary(record.id, record.bonusTierCurrency))"></span>
                </div>
              </div>
            </template>
            <template v-else-if="isFixedSalaryRole(record.role)">
              <span style="color:#595959;font-size:12px">固定月薪：</span>
              <span style="font-size:12px" v-if="record.fixedMonthlySalary"
                v-html="highlightAmounts('¥' + fmtNum(record.fixedMonthlySalary))"></span>
              <span v-else style="color:#bbb;font-size:12px">—</span>
            </template>
            <template v-else-if="isExecutorRole(record.role)">
              <div v-if="hasAnyRate(record.id)" style="font-size:12px;line-height:1.8">
                <div v-for="type in VIDEO_TYPES" :key="type">
                  <template v-if="tierSummary(record.id, type)">
                    <a-tag :color="videoTypeColor(type)" style="margin-right:4px">{{ VIDEO_TYPE_LABELS[type] }}</a-tag>
                    <span v-html="highlightAmounts(tierSummary(record.id, type))"></span>
                  </template>
                </div>
              </div>
              <span v-else style="color:#c00000;font-size:12px">请项目负责人设置对应执行人员的薪资规则</span>
            </template>
            <template v-else-if="isLegalRole(record.role)">
              <span style="color:#262626;font-size:12px">法务每月薪资由管理层手动在"工资单"模块设置</span>
            </template>
            <span v-else style="color:#595959">薪资规则待定</span>
            <!-- 项目管理员固定月薪 + 负责管理的品牌方（2026-08-21 新增）：跟上面按角色互斥展示
                 的薪资块不同，这块是"叠加"展示的——项目负责人同时是项目管理员时，提成信息
                 跟这块会一起显示，不是二选一 -->
            <div v-if="record.projectAdminSince" style="font-size:12px;line-height:1.8;margin-top:4px;padding-top:4px;border-top:1px dashed #e8e8e8">
              <div>
                <span style="color:#595959">项目管理员月薪：</span>
                <span v-if="record.projectAdminFixedMonthlySalary != null"
                  v-html="highlightAmounts('¥' + fmtNum(record.projectAdminFixedMonthlySalary))"></span>
                <span v-else style="color:#bbb">—</span>
              </div>
              <div v-if="managedBrandsByEmployeeId[record.id]?.length">
                <span style="color:#595959">负责品牌方：</span>
                <a-tag v-for="bid in managedBrandsByEmployeeId[record.id]" :key="bid"
                  :color="colorForValue(brandNameById[bid])" style="margin:1px 2px 1px 0">{{ brandNameById[bid] || bid }}</a-tag>
              </div>
              <div v-else style="color:#c00000">尚未配置负责管理的品牌方</div>
            </div>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
                <a style="color:#ff4d4f">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal :open="modalVisible" :title="editing ? '编辑员工' : '新建员工'"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false"
      :destroy-on-close="true" width="560px">
      <a-form ref="formRef" :model="form" :label-col="{ span: 8 }" :wrapper-col="{ span: 15 }">
        <a-form-item label="姓名" name="name"
          :rules="[{ required: true, message: '请填写员工姓名' }]">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="角色" name="role">
          <a-select v-model:value="form.role" placeholder="选择角色">
            <a-select-option v-for="o in getOptions('employee_role')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="邮箱" name="email">
          <a-input v-model:value="form.email" />
        </a-form-item>
        <a-form-item label="联系电话" name="contactPhone">
          <a-input v-model:value="form.contactPhone" />
        </a-form-item>
        <a-form-item label="入职时间" name="hireDate">
          <a-date-picker v-model:value="form.hireDate" value-format="YYYY-MM-DD" style="width:100%" />
        </a-form-item>
        <a-form-item label="离职时间" name="resignDate">
          <a-date-picker v-model:value="form.resignDate" value-format="YYYY-MM-DD" style="width:100%" allow-clear />
        </a-form-item>

        <!-- 项目负责人 / 管理层：默认提成比例 + bonus 阶梯 -->
        <template v-if="isCommissionRole(form.role)">
          <a-form-item label="默认提成比例">
            <a-input-number
              v-model:value="form.commissionRateDisplay"
              style="width:100%" :min="0" :max="100" :precision="0"
              :formatter="v => v + '%'" :parser="v => v.replace('%','')"
              @change="v => form.defaultCommissionRate = v / 100"
            />
            <div style="font-size:12px; color:#595959; margin-top:4px">
              可在具体项目中覆盖此比例
            </div>
          </a-form-item>

          <div class="bonus-section">
            <div class="bonus-section-header">提成 Bonus 阶梯</div>

            <div class="bonus-currency-row">
              <label>判档币种</label>
              <a-radio-group v-model:value="form.bonusTierCurrency">
                <a-radio value="RMB">人民币</a-radio>
                <a-radio value="USD">美元</a-radio>
              </a-radio-group>
            </div>
            <div class="bonus-section-hint" style="margin-bottom:10px">
              按该负责人某时间范围内的提成总额（换算成这个币种后）判档，命中区间额外奖励对应比例
            </div>

            <div v-if="!form.bonusTiers.length" class="bonus-empty">尚未配置，点击下方按钮新增档位</div>

            <div v-for="(tier, idx) in form.bonusTiers" :key="idx" class="bonus-card">
              <div class="bonus-card-top">
                <span class="bonus-badge">第 {{ idx + 1 }} 档</span>
                <a-button type="text" danger size="small" @click="form.bonusTiers.splice(idx, 1)">删除</a-button>
              </div>
              <div class="bonus-fields">
                <div class="bonus-field">
                  <label>最低金额</label>
                  <a-input-number v-model:value="tier.minAmount" :min="0" :precision="2" style="width:100%" />
                </div>
                <div class="bonus-field">
                  <label>最高金额<span class="bonus-field-hint">留空=不封顶</span></label>
                  <a-input-number v-model:value="tier.maxAmount" :min="0" :precision="2" style="width:100%" placeholder="不封顶" />
                </div>
                <div class="bonus-field">
                  <label>bonus 比例</label>
                  <a-input-number v-model:value="tier.bonusRateDisplay" :min="0" :max="100" :precision="0"
                    :formatter="v => v + '%'" :parser="v => v.replace('%','')"
                    @change="v => tier.bonusRate = v / 100"
                    style="width:100%" />
                </div>
              </div>
            </div>

            <a-button type="dashed" block size="small" @click="addBonusTier">
              <template #icon><PlusOutlined /></template>新增档位
            </a-button>
          </div>
        </template>

        <!-- "项目管理员"身份（2026-08-21 新增）：只能叠加在"项目负责人"角色上（管理层本身已经
             包含这些权限，不需要也不允许再叠加，见 CLAUDE.md 项目管理员需求说明），跟上面
             提成/bonus 是"同时展示"关系，不是互斥的 tab 切换 -->
        <div v-if="form.role === '项目负责人'" class="bonus-section">
          <div class="bonus-section-header">项目管理员身份</div>
          <a-form-item label="同时是项目管理员" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }">
            <a-switch v-model:checked="form.isProjectAdmin" @change="onToggleProjectAdmin" />
          </a-form-item>
          <template v-if="form.isProjectAdmin">
            <a-form-item label="负责管理的品牌方" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }">
              <a-select v-model:value="form.managedBrandIds" mode="multiple" allow-clear show-search
                option-filter-prop="label" placeholder="选择该项目管理员负责的品牌方（自动覆盖品牌方下全部团队）">
                <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
              </a-select>
              <div style="font-size:12px;color:#595959;margin-top:4px">
                可以先留空、后续再配置；不选品牌方时不影响项目管理员身份本身的其他权限
              </div>
            </a-form-item>
            <a-form-item label="项目管理员固定月薪" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }"
              name="projectAdminFixedMonthlySalary" :rules="[{ required: true, message: '请填写项目管理员固定月薪' }]">
              <a-input-number v-model:value="form.projectAdminFixedMonthlySalary"
                style="width:100%" :min="0" :precision="2" addon-after="元/月" />
            </a-form-item>
            <a-form-item label="成为项目管理员的时间" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }"
              name="projectAdminSince" :rules="[{ required: true, message: '请选择成为项目管理员的时间' }]">
              <a-date-picker v-model:value="form.projectAdminSince" value-format="YYYY-MM-DD" style="width:100%" />
              <div style="font-size:12px;color:#595959;margin-top:4px">
                只有这个月份及以后的工资单/数据看板才会计入项目管理员固定月薪；已经确认过的工资单
                不会因为改这个日期而变动
              </div>
            </a-form-item>
          </template>
        </div>

        <!-- 财务 / IT后勤：固定月薪 -->
        <a-form-item v-if="isFixedSalaryRole(form.role)" label="固定月薪（人民币）">
          <a-input-number v-model:value="form.fixedMonthlySalary"
            style="width:100%" :min="0" :precision="2" addon-after="元/月" />
        </a-form-item>

        <!-- 执行人员：薪资标准改由各项目负责人独立维护，员工管理页面里编辑执行人员时，
             代表"管理层"（这里的登录账号本身就是ADMIN或管理层）维护自己那份 -->
        <ExecutorRateFields v-if="isExecutorRole(form.role) && form.id" ref="executorRateFieldsRef" :executor-id="form.id" />
        <a-alert v-if="isExecutorRole(form.role) && !form.id"
          type="info" show-icon message="请先保存该员工，再编辑其薪资标准" style="margin-bottom:16px" />

        <a-alert v-if="form.role && !isCommissionRole(form.role) && !isFixedSalaryRole(form.role) && !isExecutorRole(form.role)"
          type="info" show-icon message="该角色的工资规则待补充，暂无需填写薪资信息" style="margin-bottom:16px" />

        <a-form-item label="备注">
          <a-textarea v-model:value="form.notes" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ExportOutlined } from '@ant-design/icons-vue'
import { employeeApi, executorPayRateApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { useReferenceData } from '../../composables/useReferenceData'
import { formatDate } from '../../utils/dateFormat'
import { colorForValue } from '../../utils/tagColor'
import { videoTypeColor } from '../../utils/enumColors'
import { highlightAmounts } from '../../utils/textHighlight'
import { VIDEO_TYPES, VIDEO_TYPE_LABELS, formatVideoTypeTiers } from '../../utils/executorRateFormat'
import ExecutorRateFields from './ExecutorRateFields.vue'

const { getOptions } = useOptions()
const { loadBrands } = useReferenceData()

const COMMISSION_ROLES  = ['项目负责人', '管理层']
const FIXED_SALARY_ROLES = ['财务', 'IT后勤']
const EXECUTOR_ROLE = '执行人员'
const LEGAL_ROLE = '法务'

// 员工管理列表默认排序：先按角色（跟"员工角色"下拉框的既有顺序保持一致），角色内部再按姓名
const ROLE_ORDER = ['项目负责人', '执行人员', '管理层', '财务', '法务', 'IT后勤']
function roleSortIndex(role) {
  const idx = ROLE_ORDER.indexOf(role)
  return idx === -1 ? ROLE_ORDER.length : idx
}
function sortByRoleThenName(employees) {
  return [...employees].sort((a, b) => {
    const roleDiff = roleSortIndex(a.role) - roleSortIndex(b.role)
    if (roleDiff !== 0) return roleDiff
    return (a.name || '').localeCompare(b.name || '', 'zh')
  })
}

function isCommissionRole(role)  { return COMMISSION_ROLES.includes(role) }
function isFixedSalaryRole(role) { return FIXED_SALARY_ROLES.includes(role) }
function isExecutorRole(role)    { return role === EXECUTOR_ROLE }
function isLegalRole(role)       { return role === LEGAL_ROLE }

const loading = ref(false)
const list    = ref([])
// "项目管理员"负责管理的品牌方（2026-08-21 新增）：brands 供表单多选下拉+列表标签取名用，
// brandNameById 是按 id 索引的 Map（普通对象），managedBrandsByEmployeeId 是列表页批量展示用，
// 结构跟 bonusTiersByEmployeeId 是同一个思路（key 为员工 id）
const brands = ref([])
const brandNameById = computed(() => Object.fromEntries(brands.value.map(b => [b.id, b.name])))
const managedBrandsByEmployeeId = ref({})
// 执行人员薪资标准（这里代表"管理层"那份配置，见 ExecutorRateFields 的 managerId 解析规则），
// 结构：{ [executorId]: { [videoType]: [tier, ...] } }，供列表"薪资信息"列直接展示当前已配置的档位
const executorRates = ref({})

function tierSummary(executorId, videoType) {
  return formatVideoTypeTiers(executorRates.value[executorId]?.[videoType])
}
function hasAnyRate(executorId) {
  return VIDEO_TYPES.some(type => tierSummary(executorId, type))
}

// 项目负责人/管理层的提成 bonus 阶梯，key 为员工 id，value 为该员工配置的档位列表，
// 供列表"薪资信息"列直接展示已配置的 bonus 规则，不用打开编辑弹窗才能看到
const bonusTiersByEmployeeId = ref({})

// currency 直接拼进每个档位的金额里（而不是像以前那样只在外层标签上显示一次货币符号），
// 这样这段文案本身就是自包含的"¥金额→比例"结构，highlightAmounts 才能按"¥开头"识别出金额来上色
function bonusTierSummary(employeeId, currency) {
  const tiers = bonusTiersByEmployeeId.value[employeeId]
  if (!tiers || !tiers.length) return null
  const symbol = currency === 'RMB' ? '¥' : '$'
  const sorted = [...tiers].sort((a, b) => (a.minAmount || 0) - (b.minAmount || 0))
  return sorted.map(t => {
    const range = t.maxAmount == null
      ? `${symbol}${fmtNum(t.minAmount)}+`
      : `${symbol}${fmtNum(t.minAmount)}-${symbol}${fmtNum(t.maxAmount)}`
    const pct = (parseFloat(t.bonusRate) * 100).toFixed(0) + '%'
    return `${range}→${pct}`
  }).join('，')
}
const modalVisible = ref(false)
const editing  = ref(null)
const saving   = ref(false)
const formRef  = ref()
const executorRateFieldsRef = ref()

const emptyForm = () => ({
  id: null, name: '', role: '项目负责人', email: '',
  contactPhone: '', hireDate: null, resignDate: null,
  defaultCommissionRate: null, commissionRateDisplay: 0,
  bonusTierCurrency: 'RMB', bonusTiers: [],
  fixedMonthlySalary: null,
  // "项目管理员"身份（2026-08-21 新增），见表单里对应的开关+三个字段
  isProjectAdmin: false, managedBrandIds: [],
  projectAdminFixedMonthlySalary: null, projectAdminSince: null,
  notes: ''
})

function addBonusTier() {
  form.bonusTiers.push({ minAmount: null, maxAmount: null, bonusRate: null, bonusRateDisplay: 0 })
}

// 关闭"同时是项目管理员"开关时清空三个关联字段，避免用户开了又关、提交时残留旧值
// （后端本身也会在 isProjectAdmin=false 时无条件清空这三个字段，这里只是让表单显示跟提交结果一致）
function onToggleProjectAdmin(checked) {
  if (!checked) {
    form.managedBrandIds = []
    form.projectAdminFixedMonthlySalary = null
    form.projectAdminSince = null
  }
}

const form = reactive(emptyForm())

const columns = [
  { title: '姓名',   dataIndex: 'name', key: 'name', width: 120,
    sorter: (a, b) => (a.name || '').localeCompare(b.name || '', 'zh') },
  { title: '角色',   dataIndex: 'role', key: 'role', width: 100,
    sorter: (a, b) => (a.role || '').localeCompare(b.role || '', 'zh') },
  { title: '邮箱',   dataIndex: 'email', key: 'email', width: 160,
    sorter: (a, b) => (a.email || '').localeCompare(b.email || '') },
  { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone', width: 130,
    customRender: ({ text }) => text || '—',
    sorter: (a, b) => (a.contactPhone || '').localeCompare(b.contactPhone || '') },
  { title: '入职时间', key: 'hireDate', width: 110,
    customRender: ({ record }) => record.hireDate ? formatDate(record.hireDate) : '—',
    sorter: (a, b) => new Date(a.hireDate || 0) - new Date(b.hireDate || 0) },
  { title: '离职时间', key: 'resignDate', width: 110,
    customRender: ({ record }) => record.resignDate ? formatDate(record.resignDate) : '-',
    sorter: (a, b) => new Date(a.resignDate || 0) - new Date(b.resignDate || 0) },
  { title: '薪资信息', key: 'salaryInfo', width: 260,
    sorter: (a, b) => salaryValue(a) - salaryValue(b) },
  { title: '备注',   dataIndex: 'notes', key: 'notes', ellipsis: true,
    sorter: (a, b) => (a.notes || '').localeCompare(b.notes || '', 'zh') },
  { title: '操作',   key: 'action', width: 100 }
]

/** 薪资信息排序用：按角色取对应的主要数值，便于粗略比较（不同角色量纲不同，仅供排序参考） */
function salaryValue(record) {
  if (isCommissionRole(record.role))  return record.defaultCommissionRate != null ? parseFloat(record.defaultCommissionRate) : -1
  if (isFixedSalaryRole(record.role)) return record.fixedMonthlySalary   != null ? parseFloat(record.fixedMonthlySalary)   : -1
  return -1
}

const tablePagination = {
  pageSize: 20,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100'],
  showTotal: t => `共 ${t} 条`
}

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
async function loadData() {
  loading.value = true
  try {
    const [empRes, rateRes, brandsData] = await Promise.all([
      employeeApi.list(),
      executorPayRateApi.list(),
      loadBrands() // 品牌方引用数据（60秒内存缓存），供"负责管理的品牌方"多选下拉+列表标签取名用
    ])
    list.value = sortByRoleThenName(empRes.data || [])
    brands.value = brandsData
    const map = {}
    for (const t of (rateRes.data || [])) {
      if (!map[t.executorId]) map[t.executorId] = {}
      if (!map[t.executorId][t.videoType]) map[t.executorId][t.videoType] = []
      map[t.executorId][t.videoType].push(t)
    }
    executorRates.value = map

    const commissionIds = list.value.filter(e => isCommissionRole(e.role)).map(e => e.id)
    if (commissionIds.length) {
      const bonusRes = await employeeApi.getBonusTiersBulk(commissionIds)
      bonusTiersByEmployeeId.value = bonusRes.data || {}
    } else {
      bonusTiersByEmployeeId.value = {}
    }

    // "项目管理员"负责管理的品牌方：只对已经开通身份（projectAdminSince 不为空）的员工批量查
    const projectAdminIds = list.value.filter(e => e.projectAdminSince).map(e => e.id)
    if (projectAdminIds.length) {
      const managedRes = await employeeApi.getManagedBrandsBulk(projectAdminIds)
      managedBrandsByEmployeeId.value = managedRes.data || {}
    } else {
      managedBrandsByEmployeeId.value = {}
    }
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, emptyForm())
  modalVisible.value = true
}

async function openEdit(r) {
  editing.value = r
  Object.assign(form, {
    ...emptyForm(),
    ...r,
    hireDate:   r.hireDate   ? formatDate(r.hireDate)   : null,
    resignDate: r.resignDate ? formatDate(r.resignDate) : null,
    commissionRateDisplay: r.defaultCommissionRate != null
      ? +(parseFloat(r.defaultCommissionRate) * 100).toFixed(0) : 0,
    bonusTierCurrency: r.bonusTierCurrency || 'RMB',
    bonusTiers: [],
    // "项目管理员"身份：projectAdminSince 不为空即代表已开通，回显日期时同样要格式化成
    // value-format 需要的 'YYYY-MM-DD' 字符串，否则 a-date-picker 认不出后端返回的原始时间戳
    isProjectAdmin: !!r.projectAdminSince,
    projectAdminSince: r.projectAdminSince ? formatDate(r.projectAdminSince) : null,
    projectAdminFixedMonthlySalary: r.projectAdminFixedMonthlySalary,
    managedBrandIds: []
  })
  modalVisible.value = true
  if (isCommissionRole(r.role)) {
    const res = await employeeApi.getBonusTiers(r.id)
    form.bonusTiers = (res.data || []).map(t => ({
      ...t,
      bonusRateDisplay: t.bonusRate != null ? +(parseFloat(t.bonusRate) * 100).toFixed(0) : 0
    }))
  }
  // 已开通项目管理员身份的，额外拉一次已配置的负责品牌方列表回显到多选框
  if (r.projectAdminSince) {
    const managedRes = await employeeApi.getManagedBrands(r.id)
    form.managedBrandIds = managedRes.data || []
  }
}

async function handleDelete(id) {
  await employeeApi.delete(id)
  message.success('删除成功')
  loadData()
}

async function handleSave() {
  if (saving.value) return   // 防止表单校验期间被连续点击导致重复提交
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await employeeApi.save({ ...form })
    if (isExecutorRole(form.role) && executorRateFieldsRef.value) {
      await executorRateFieldsRef.value.save()
    }
    message.success(form.id ? '更新成功' : '创建成功')
    modalVisible.value = false
    loadData()
  } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.bonus-section {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px 14px 14px;
  margin-bottom: 16px;
}
.bonus-section-header {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  padding-left: 10px;
  border-left: 3px solid #1677ff;
  margin-bottom: 10px;
  line-height: 1.2;
}
.bonus-currency-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.bonus-currency-row label {
  font-size: 12px;
  color: #595959;
}
.bonus-section-hint {
  font-size: 12px;
  color: #595959;
  line-height: 1.5;
}
.bonus-empty {
  font-size: 12px;
  color: #595959;
  background: #fff;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  margin-bottom: 10px;
}
.bonus-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.bonus-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.bonus-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  border-radius: 4px;
  padding: 1px 8px;
}
.bonus-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.bonus-field {
  flex: 1;
  min-width: 110px;
}
.bonus-field label {
  display: block;
  font-size: 12px;
  color: #595959;
  margin-bottom: 4px;
}
.bonus-field-hint {
  color: #595959;
  font-weight: normal;
  margin-left: 4px;
}
</style>
