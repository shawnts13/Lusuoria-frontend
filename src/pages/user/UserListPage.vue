<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">账号管理</span>
      <a-button type="primary" @click="openCreate">
        <template #icon><PlusOutlined /></template>新建账号
      </a-button>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="roleColor(record.role)">{{ record.roleLabel }}</a-tag>
          </template>
          <template v-if="column.key === 'enabled'">
            <a-badge :status="record.enabled ? 'success' : 'error'"
              :text="record.enabled ? '启用' : '禁用'" />
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a-popconfirm :title="record.enabled ? '确认禁用此账号？' : '确认启用此账号？'"
                @confirm="handleToggle(record)">
                <a :style="record.enabled ? 'color:#faad14' : 'color:#52c41a'">
                  {{ record.enabled ? '禁用' : '启用' }}
                </a>
              </a-popconfirm>
              <a-divider type="vertical" />
              <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
                <a style="color:#ff4d4f">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal :open="modalVisible" :title="editingRecord ? '编辑账号' : '新建账号'"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false"
      :destroy-on-close="true" width="560px">
      <a-form ref="formRef" :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">

        <a-form-item label="用户名" name="username"
          :rules="[{ required: true, message: '请填写用户名' },
                   { pattern: /^[a-zA-Z0-9_]+$/, message: '只允许字母、数字、下划线' }]">
          <a-input v-model:value="form.username" :disabled="!!editingRecord"
            placeholder="登录用户名，建议英文" />
        </a-form-item>

        <a-form-item label="密码" name="password"
          :rules="editingRecord ? [] : [{ required: true, message: '请填写密码' }, { min: 6, message: '至少6位' }]">
          <a-input-password v-model:value="form.password"
            :placeholder="editingRecord ? '留空则不修改密码' : '默认密码：lusuoria2026@'" />
          <div v-if="!editingRecord" style="font-size:12px;color:#888;margin-top:3px">
            默认密码已预填，可直接使用或修改
          </div>
        </a-form-item>

        <a-form-item label="角色" name="role"
          :rules="[{ required: true, message: '请选择角色' }]">
          <a-select v-model:value="form.role">
            <a-select-option value="ADMIN">
              <a-tag color="red" style="margin-right:6px">管理员</a-tag>
              老板：全部权限 + 账号管理
            </a-select-option>
            <a-select-option value="STAFF">
              <a-tag color="blue" style="margin-right:6px">普通员工</a-tag>
              可写操作，看不到收入/利润/提成
            </a-select-option>
            <a-select-option value="AUDITOR">
              <a-tag color="orange" style="margin-right:6px">财务</a-tag>
              所有字段可见（含财务），仅只读 + 导出
            </a-select-option>
            <a-select-option value="GUEST">
              <a-tag color="default" style="margin-right:6px">访客</a-tag>
              只读，看不到收入/利润/提成
            </a-select-option>
          </a-select>
        </a-form-item>

        <!-- 角色说明卡片 -->
        <a-form-item :wrapper-col="{ offset: 7, span: 15 }">
          <a-alert type="info" :show-icon="false" style="font-size:12px">
            <template #message>
              <div>
                <div>🔴 <b>管理员</b>：所有字段可见，可写，可审核，可管理账号，可修改提成比例</div>
                <div>🔵 <b>普通员工</b>：可新建/编辑项目，<b>不可见</b>收入/利润/提成字段</div>
                <div>🟠 <b>财务</b>：所有字段可见（含财务），仅只读 + 导出</div>
                <div>⚪ <b>访客</b>：只读，<b>不可见</b>收入/利润/提成字段</div>
              </div>
            </template>
          </a-alert>
        </a-form-item>

        <a-form-item label="关联员工">
          <a-select v-model:value="form.employeeId" allow-clear placeholder="可选，绑定员工记录">
            <a-select-option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="状态">
          <a-switch v-model:checked="form.enabled"
            checked-children="启用" un-checked-children="禁用" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { userApi, employeeApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'

const loading      = ref(false)
const list         = ref([])
const employees    = ref([])
const modalVisible = ref(false)
const editingRecord = ref(null)
const saving       = ref(false)
const formRef      = ref()

const form = reactive({
  username: '', password: '',
  role: 'STAFF', employeeId: undefined, enabled: true
})

const columns = [
  { title: '用户名',   dataIndex: 'username',     key: 'username' },
  { title: '角色',     key: 'role',               width: 130 },
  { title: '关联员工', dataIndex: 'employeeName', key: 'employeeName',
    customRender: ({ text }) => text || '—' },
  { title: '状态',     key: 'enabled',            width: 90 },
  { title: '创建时间', dataIndex: 'createdAt',    key: 'createdAt', width: 170,
    customRender: ({ text }) => text ? formatDateTime(text) : '—' },
  { title: '操作',     key: 'action',             width: 160 }
]

function roleColor(role) {
  return { ADMIN:'red', STAFF:'blue', AUDITOR:'orange', GUEST:'default' }[role] || 'default'
}

async function loadData() {
  loading.value = true
  try { const res = await userApi.list(); list.value = res.data || [] }
  finally { loading.value = false }
}

const DEFAULT_PASSWORD = 'lusuoria2026@'

function openCreate() {
  editingRecord.value = null
  Object.assign(form, {
    username: '',
    password: DEFAULT_PASSWORD,
    role: 'STAFF', employeeId: undefined, enabled: true
  })
  modalVisible.value = true
}

function openEdit(record) {
  editingRecord.value = record
  Object.assign(form, { username: record.username,
    password: '', role: record.role, employeeId: record.employeeId || undefined, enabled: record.enabled })
  modalVisible.value = true
}

async function handleToggle(record) {
  await userApi.toggle(record.id)
  message.success(record.enabled ? '已禁用' : '已启用')
  loadData()
}

async function handleDelete(id) {
  await userApi.delete(id); message.success('删除成功'); loadData()
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    if (editingRecord.value) { await userApi.update(editingRecord.value.id, { ...form }); message.success('更新成功') }
    else                     { await userApi.create({ ...form }); message.success('账号创建成功') }
    modalVisible.value = false; loadData()
  } finally { saving.value = false }
}

onMounted(async () => {
  const [, emp] = await Promise.all([loadData(), employeeApi.list()])
  employees.value = emp.data || []
})
</script>
