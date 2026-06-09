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
          <template v-if="column.key === 'defaultCommissionRate'">
            {{ record.defaultCommissionRate
              ? (parseFloat(record.defaultCommissionRate) * 100).toFixed(0) + '%'
              : '—' }}
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
      :destroy-on-close="true">
      <a-form ref="formRef" :model="form" :label-col="{ span: 8 }" :wrapper-col="{ span: 14 }">
        <a-form-item label="姓名" name="name"
          :rules="[{ required: true, message: '请填写员工姓名' }]">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="角色" name="role">
          <a-select v-model:value="form.role">
            <a-select-option value="项目负责人">项目负责人</a-select-option>
            <a-select-option value="执行人员">执行人员</a-select-option>
            <a-select-option value="管理层">管理层</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="邮箱" name="email">
          <a-input v-model:value="form.email" />
        </a-form-item>
        <a-form-item label="默认提成比例">
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

const loading = ref(false)
const list    = ref([])
const modalVisible = ref(false)
const editing  = ref(null)
const saving   = ref(false)
const formRef  = ref()

const form = reactive({
  id: null, name: '', role: '项目负责人', email: '',
  defaultCommissionRate: null, commissionRateDisplay: 0, notes: ''
})

const columns = [
  { title: '姓名',       dataIndex: 'name',                  key: 'name' },
  { title: '角色',       dataIndex: 'role',                  key: 'role' },
  { title: '邮箱',       dataIndex: 'email',                 key: 'email' },
  { title: '默认提成比例', key: 'defaultCommissionRate',       width: 130 },
  { title: '备注',       dataIndex: 'notes',                 key: 'notes', ellipsis: true },
  { title: '操作',       key: 'action',                      width: 100 }
]

async function loadData() {
  loading.value = true
  try {
    const res = await employeeApi.list()
    list.value = res.data || []
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { id:null, name:'', role:'项目负责人', email:'',
    defaultCommissionRate:null, commissionRateDisplay:0, notes:'' })
  modalVisible.value = true
}

function openEdit(r) {
  editing.value = r
  Object.assign(form, {
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
