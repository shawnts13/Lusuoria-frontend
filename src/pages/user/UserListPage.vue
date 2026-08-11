<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">账号管理</span>
      <a-button type="primary" @click="openCreate">
        <template #icon><PlusOutlined /></template>新建账号
      </a-button>
    </div>

    <!-- Google Drive 备份账号（2026-07-29 新增）：数据库每日全量备份要上传到 Google Drive，
         走的是这个真实 Google 账号的 OAuth 授权，不是 Service Account（详见后端注释）——授权
         失效时"待处理"模块会有提醒，引导回到这里重新连接 -->
    <div class="drive-auth-card">
      <div class="drive-auth-title">数据库备份 · Google Drive 账号</div>
      <a-spin :spinning="driveStatusLoading">
        <div v-if="driveAuth" class="drive-auth-body">
          <span style="color:#237804">
            已连接（{{ driveAuth.connectedByUsername || '—' }} 于 {{ formatDateTime(driveAuth.connectedAt) }} 连接）
          </span>
          <a-button size="small" :loading="connecting" @click="connectGoogleDrive">重新连接</a-button>
          <a-button size="small" :loading="testingBackup" @click="testBackupNow">立即执行一次备份（测试）</a-button>
        </div>
        <div v-else class="drive-auth-body">
          <span style="color:#8c8c8c">尚未连接，每日数据库备份无法上传到 Google Drive</span>
          <a-button type="primary" size="small" :loading="connecting" @click="connectGoogleDrive">连接 Google Drive</a-button>
        </div>
      </a-spin>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading" row-key="id" size="middle"
        :pagination="tablePagination">
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
          <div v-if="!editingRecord" style="font-size:12px;color:#595959;margin-top:3px">
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
          <a-select v-model:value="form.employeeId" allow-clear placeholder="可选，绑定员工记录（只列出还未绑定账号的员工）">
            <a-select-option v-for="e in availableEmployees" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { userApi, googleDriveAuthApi, dbBackupApi } from '../../api/index'
import { useReferenceData } from '../../composables/useReferenceData'
import { formatDateTime } from '../../utils/dateFormat'

const router = useRouter()
const { loadEmployees } = useReferenceData()
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
  { title: '用户名',   dataIndex: 'username',     key: 'username',
    sorter: (a, b) => (a.username || '').localeCompare(b.username || '') },
  { title: '角色',     key: 'role',               width: 130,
    sorter: (a, b) => (a.role || '').localeCompare(b.role || '') },
  { title: '关联员工', dataIndex: 'employeeName', key: 'employeeName',
    customRender: ({ text }) => text || '—',
    sorter: (a, b) => (a.employeeName || '').localeCompare(b.employeeName || '', 'zh') },
  { title: '状态',     key: 'enabled',            width: 90,
    sorter: (a, b) => Number(a.enabled) - Number(b.enabled) },
  { title: '创建时间', dataIndex: 'createdAt',    key: 'createdAt', width: 170,
    customRender: ({ text }) => text ? formatDateTime(text) : '—',
    sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) },
  { title: '操作',     key: 'action',             width: 160 }
]

function roleColor(role) {
  return { ADMIN:'red', STAFF:'blue', AUDITOR:'orange', GUEST:'default' }[role] || 'default'
}

// 分页设置：跟"员工管理"保持一致，允许切换每页展示条数
const tablePagination = {
  pageSize: 20,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100'],
  showTotal: t => `共 ${t} 条`
}

// 一个员工只能绑定一个账号：可选列表排除已经被其他账号占用的员工；
// 编辑态下当前账号自己已绑定的那个员工仍然要保留在列表里，否则下拉框里会找不到当前选中值
const availableEmployees = computed(() => {
  const boundIds = new Set(
    list.value
      .filter(u => u.employeeId != null && (!editingRecord.value || u.id !== editingRecord.value.id))
      .map(u => u.employeeId)
  )
  return employees.value.filter(e => !boundIds.has(e.id))
})

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

// Google Drive 授权状态
const driveAuth = ref(null)
const driveStatusLoading = ref(false)
const connecting = ref(false)
const testingBackup = ref(false)

// 连接好之后不想等到明天凌晨3点半、也不想故意搞出一次失败才能测试，直接手动跑一次
// （跟"待处理"里的"重试"按钮走的是同一个后端接口，行为完全一样，只是入口不同）
async function testBackupNow() {
  testingBackup.value = true
  try {
    await dbBackupApi.retry()
    message.success('备份测试成功，已上传到 Google Drive')
  } catch (e) {
    // 失败提示已经由全局拦截器弹出来了
  } finally {
    testingBackup.value = false
  }
}

async function loadDriveStatus() {
  driveStatusLoading.value = true
  try {
    const res = await googleDriveAuthApi.status()
    driveAuth.value = res.data || null
  } finally {
    driveStatusLoading.value = false
  }
}

async function connectGoogleDrive() {
  connecting.value = true
  try {
    const res = await googleDriveAuthApi.authorizeUrl()
    // 整页跳转到 Google 的授权页面（不能用弹窗/iframe，Google 不允许被嵌入），
    // 授权完 Google 会跳转到后端回调地址，后端处理完再跳转回这个页面
    window.location.href = res.data
  } finally {
    connecting.value = false
  }
}

// 从 Google OAuth 回调跳转回来时，URL 上会带 googleDriveConnected=1 或 googleDriveConnectError=xxx，
// 处理完之后清掉这两个 query 参数，避免用户刷新页面时重复弹一遍提示
function handleDriveConnectRedirect() {
  const query = router.currentRoute.value.query
  if (query.googleDriveConnected) {
    message.success('Google Drive 已连接')
  } else if (query.googleDriveConnectError) {
    message.error('Google Drive 连接失败：' + query.googleDriveConnectError)
  } else {
    return
  }
  const { googleDriveConnected, googleDriveConnectError, ...rest } = query
  router.replace({ path: router.currentRoute.value.path, query: rest })
}

onMounted(async () => {
  handleDriveConnectRedirect()
  const [, emp] = await Promise.all([loadData(), loadEmployees(), loadDriveStatus()])
  employees.value = emp || []
})
</script>

<style scoped>
.drive-auth-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  background: #fafafa;
}
.drive-auth-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #262626;
}
.drive-auth-body {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
