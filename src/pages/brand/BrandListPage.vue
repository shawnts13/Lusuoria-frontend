<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">品牌方管理</span>
      <a-space>
        <a-button @click="brandApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="brandApi.exportExcel()">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <template v-if="authStore.canWrite">
          <a-upload :before-upload="handleImport" :show-upload-list="false" accept=".xlsx,.xls">
            <a-button><template #icon><UploadOutlined /></template>Excel 导入</a-button>
          </a-upload>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>新建品牌方
          </a-button>
        </template>
      </a-space>
    </div>

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite">
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
                <a style="color:#ff4d4f">删除</a>
              </a-popconfirm>
            </a-space>
            <span v-else style="color:#bbb">只读</span>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新建/编辑弹窗 -->
    <a-modal :open="modalVisible" :title="editing ? '编辑品牌方' : '新建品牌方'"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false"
      :destroy-on-close="true">
      <a-form ref="formRef" :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="品牌方名称" name="name"
          :rules="[{ required: true, message: '请填写品牌方名称' }]">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="国家/市场">
          <a-input v-model:value="form.countryMarket" />
        </a-form-item>
        <a-form-item label="合作类型">
          <a-input v-model:value="form.cooperationType" />
        </a-form-item>
        <a-form-item label="联系人">
          <a-input v-model:value="form.contactPerson" />
        </a-form-item>
        <a-form-item label="结算币种">
          <a-select v-model:value="form.settlementCurrency">
            <a-select-option value="USD">USD</a-select-option>
            <a-select-option value="RMB">RMB</a-select-option>
            <a-select-option value="EUR">EUR</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="付款周期">
          <a-input v-model:value="form.paymentCycle" placeholder="如：月结30天" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.notes" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 导入结果 -->
    <a-modal v-model:open="importResultVisible" title="导入结果" :footer="null" width="560px">
      <a-list :data-source="importResults" size="small"
        :pagination="importResults.length > 10 ? { pageSize: 10 } : false">
        <template #renderItem="{ item, index }">
          <a-list-item>
            <span :style="index === 0 ? 'font-weight:600;color:#1677ff'
              : (item.includes('失败') ? 'color:#ff4d4f' : '')">{{ item }}</span>
          </a-list-item>
        </template>
      </a-list>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { brandApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'

const authStore = useAuthStore()
const loading   = ref(false)
const list      = ref([])
const modalVisible       = ref(false)
const editing            = ref(null)
const saving             = ref(false)
const formRef            = ref()
const importResultVisible = ref(false)
const importResults      = ref([])

const form = reactive({
  id: null, name: '', countryMarket: '', cooperationType: '',
  contactPerson: '', settlementCurrency: 'USD', paymentCycle: '', notes: ''
})

const columns = [
  { title: '品牌方名称', dataIndex: 'name',              key: 'name' },
  { title: '国家/市场',  dataIndex: 'countryMarket',     key: 'countryMarket' },
  { title: '合作类型',   dataIndex: 'cooperationType',   key: 'cooperationType' },
  { title: '联系人',     dataIndex: 'contactPerson',     key: 'contactPerson' },
  { title: '结算币种',   dataIndex: 'settlementCurrency', key: 'settlementCurrency' },
  { title: '付款周期',   dataIndex: 'paymentCycle',      key: 'paymentCycle' },
  { title: '备注',       dataIndex: 'notes',             key: 'notes', ellipsis: true },
  { title: '操作',       key: 'action',                  width: 120 }
]

async function loadData() {
  loading.value = true
  try { const res = await brandApi.list(); list.value = res.data || [] }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { id:null, name:'', countryMarket:'', cooperationType:'',
    contactPerson:'', settlementCurrency:'USD', paymentCycle:'', notes:'' })
  modalVisible.value = true
}

function openEdit(record) {
  editing.value = record
  Object.assign(form, { ...record })
  modalVisible.value = true
}

async function handleDelete(id) {
  await brandApi.delete(id); message.success('删除成功'); loadData()
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await brandApi.save({ ...form })
    message.success(form.id ? '更新成功' : '创建成功')
    modalVisible.value = false; loadData()
  } finally { saving.value = false }
}

async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    const res = await brandApi.importExcel(fd)
    importResults.value = res.data || []; importResultVisible.value = true; loadData()
  } catch {}
  return false
}

onMounted(loadData)
</script>
