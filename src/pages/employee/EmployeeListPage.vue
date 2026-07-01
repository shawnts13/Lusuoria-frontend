<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">员工管理</span>
      <a-button type="primary" @click="openCreate">
        <template #icon><PlusOutlined /></template>新建员工
      </a-button>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading"
        row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'salaryInfo'">
            <template v-if="isCommissionRole(record.role)">
              <span style="color:#888;font-size:12px">默认提成：</span>
              {{ record.defaultCommissionRate
                ? (parseFloat(record.defaultCommissionRate) * 100).toFixed(0) + '%'
                : '—' }}
            </template>
            <template v-else-if="isFixedSalaryRole(record.role)">
              <span style="color:#888;font-size:12px">固定月薪：</span>
              {{ record.fixedMonthlySalary ? '¥' + fmtNum(record.fixedMonthlySalary) : '—' }}
            </template>
            <template v-else-if="isExecutorRole(record.role)">
              <div style="font-size:12px;line-height:1.6">
                <div>实拍新视频：{{ fmtRate(record.rateRealShotNew) }}</div>
                <div>AI新素材：{{ fmtRate(record.rateAiNewMaterial) }}</div>
                <div>旧素材重发(1-50)：{{ fmtRate(record.rateOldMaterialTier1) }}</div>
                <div>旧素材重发(51-100)：{{ fmtRate(record.rateOldMaterialTier2) }}</div>
                <div>旧素材重发(101+)：{{ fmtRate(record.rateOldMaterialTier3) }}，封顶{{ record.oldMaterialMonthlyCap ? '¥' + fmtNum(record.oldMaterialMonthlyCap) : '—' }}/月</div>
              </div>
            </template>
            <span v-else style="color:#bbb">薪资规则待定</span>
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

        <!-- 项目负责人 / 管理层：默认提成比例 -->
        <a-form-item v-if="isCommissionRole(form.role)" label="默认提成比例">
          <a-input-number
            v-model:value="form.commissionRateDisplay"
            style="width:100%" :min="0" :max="100" :precision="0"
            :formatter="v => v + '%'" :parser="v => v.replace('%','')"
            @change="v => form.defaultCommissionRate = v / 100"
          />
          <div style="font-size:12px; color:#888; margin-top:4px">
            可在具体项目中覆盖此比例
          </div>
        </a-form-item>

        <!-- 财务 / IT后勤：固定月薪 -->
        <a-form-item v-if="isFixedSalaryRole(form.role)" label="固定月薪（人民币）">
          <a-input-number v-model:value="form.fixedMonthlySalary"
            style="width:100%" :min="0" :precision="2" addon-after="元/月" />
        </a-form-item>

        <!-- 执行人员：按项目视频类型/件计算工资 -->
        <template v-if="isExecutorRole(form.role)">
          <a-divider orientation="left" style="font-size:13px">工资标准（按项目视频类型/件计算）</a-divider>
          <a-form-item label="实拍新视频">
            <a-input-number v-model:value="form.rateRealShotNew"
              style="width:100%" :min="0" :precision="2" addon-after="元/条" />
          </a-form-item>
          <a-form-item label="AI新素材">
            <a-input-number v-model:value="form.rateAiNewMaterial"
              style="width:100%" :min="0" :precision="2" addon-after="元/条" />
          </a-form-item>
          <a-form-item label="旧素材重发(1-50条)">
            <a-input-number v-model:value="form.rateOldMaterialTier1"
              style="width:100%" :min="0" :precision="2" addon-after="元/条" />
          </a-form-item>
          <a-form-item label="旧素材重发(51-100条)">
            <a-input-number v-model:value="form.rateOldMaterialTier2"
              style="width:100%" :min="0" :precision="2" addon-after="元/条" />
          </a-form-item>
          <a-form-item label="旧素材重发(101条+)单价">
            <a-input-number v-model:value="form.rateOldMaterialTier3"
              style="width:100%" :min="0" :precision="2" addon-after="元/条" />
          </a-form-item>
          <a-form-item label="该部分当月封顶">
            <a-input-number v-model:value="form.oldMaterialMonthlyCap"
              style="width:100%" :min="0" :precision="2" addon-after="元/月封顶" />
            <div style="font-size:12px; color:#888; margin-top:4px">
              第101条及以上部分按单价计算后，当月该部分金额封顶该数值
            </div>
          </a-form-item>
        </template>

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
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { employeeApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'

const { getOptions } = useOptions()

const COMMISSION_ROLES  = ['项目负责人', '管理层']
const FIXED_SALARY_ROLES = ['财务', 'IT后勤']
const EXECUTOR_ROLE = '执行人员'

function isCommissionRole(role)  { return COMMISSION_ROLES.includes(role) }
function isFixedSalaryRole(role) { return FIXED_SALARY_ROLES.includes(role) }
function isExecutorRole(role)    { return role === EXECUTOR_ROLE }

const loading = ref(false)
const list    = ref([])
const modalVisible = ref(false)
const editing  = ref(null)
const saving   = ref(false)
const formRef  = ref()

const emptyForm = () => ({
  id: null, name: '', role: '项目负责人', email: '',
  defaultCommissionRate: null, commissionRateDisplay: 0,
  fixedMonthlySalary: null,
  rateRealShotNew: null, rateAiNewMaterial: null,
  rateOldMaterialTier1: null, rateOldMaterialTier2: null, rateOldMaterialTier3: null,
  oldMaterialMonthlyCap: null,
  notes: ''
})

const form = reactive(emptyForm())

const columns = [
  { title: '姓名',   dataIndex: 'name', key: 'name', width: 120 },
  { title: '角色',   dataIndex: 'role', key: 'role', width: 100 },
  { title: '邮箱',   dataIndex: 'email', key: 'email', width: 160 },
  { title: '薪资信息', key: 'salaryInfo', width: 260 },
  { title: '备注',   dataIndex: 'notes', key: 'notes', ellipsis: true },
  { title: '操作',   key: 'action', width: 100 }
]

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtRate(val) {
  return val != null ? '¥' + fmtNum(val) : '—'
}

async function loadData() {
  loading.value = true
  try {
    const res = await employeeApi.list()
    list.value = res.data || []
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, emptyForm())
  modalVisible.value = true
}

function openEdit(r) {
  editing.value = r
  Object.assign(form, {
    ...emptyForm(),
    ...r,
    commissionRateDisplay: r.defaultCommissionRate
      ? +(parseFloat(r.defaultCommissionRate) * 100).toFixed(0) : 0
  })
  modalVisible.value = true
}

async function handleDelete(id) {
  await employeeApi.delete(id)
  message.success('删除成功')
  loadData()
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await employeeApi.save({ ...form })
    message.success(form.id ? '更新成功' : '创建成功')
    modalVisible.value = false
    loadData()
  } finally { saving.value = false }
}

onMounted(loadData)
</script>
