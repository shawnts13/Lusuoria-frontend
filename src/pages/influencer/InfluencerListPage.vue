<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">红人管理</span>
      <a-space>
        <a-button @click="influencerApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="influencerApi.exportExcel(typeFilter)">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <template v-if="authStore.canWrite">
          <a-upload :before-upload="handleImport" :show-upload-list="false" accept=".xlsx,.xls">
            <a-button><template #icon><UploadOutlined /></template>Excel 导入</a-button>
          </a-upload>
          <a-button type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>新建红人
          </a-button>
        </template>
      </a-space>
    </div>

    <div class="filter-bar">
      <a-select v-model:value="typeFilter" placeholder="红人类型" style="width:160px"
        allow-clear @change="loadData">
        <a-select-option value="OVERSEAS_INFLUENCER">海外红人</a-select-option>
        <a-select-option value="CHINA_INFLUENCER">中国红人</a-select-option>
      </a-select>
    </div>

    <div class="table-card">
      <a-table :columns="visibleColumns" :data-source="list" :loading="loading"
        row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'influencerType'">
            <a-tag :color="record.influencerType === 'OVERSEAS_INFLUENCER' ? 'blue' : 'green'">
              {{ record.influencerType === 'OVERSEAS_INFLUENCER' ? '海外红人' : '中国红人' }}
            </a-tag>
          </template>
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

    <a-modal :open="modalVisible" :title="editing ? '编辑红人' : '新建红人'"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false"
      :destroy-on-close="true" width="600px">
      <a-form ref="formRef" :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
        <a-form-item label="红人类型" name="influencerType"
          :rules="[{ required: true, message: '请选择红人类型' }]">
          <a-select v-model:value="form.influencerType">
            <a-select-option value="OVERSEAS_INFLUENCER">海外红人</a-select-option>
            <a-select-option value="CHINA_INFLUENCER">中国红人</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="红人团队">
          <a-input v-model:value="form.teamName" placeholder="如：游琳团队" />
        </a-form-item>
        <a-form-item label="红人账号" name="accountName"
          :rules="[{ required: true, message: '请填写红人账号' }]">
          <a-input v-model:value="form.accountName" />
        </a-form-item>
        <a-form-item label="国家/市场">
          <a-input v-model:value="form.countryMarket" />
        </a-form-item>
        <a-form-item label="平台">
          <a-input v-model:value="form.platform" placeholder="TikTok / Instagram / YouTube" />
        </a-form-item>
        <a-form-item label="合作模式">
          <a-input v-model:value="form.cooperationMode" />
        </a-form-item>
        <a-form-item label="收款信息">
          <a-textarea v-model:value="form.paymentInfo" :rows="2" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.notes" :rows="2" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { influencerApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'

const authStore = useAuthStore()
const loading   = ref(false)
const list      = ref([])
const typeFilter = ref(undefined)
const modalVisible       = ref(false)
const editing            = ref(null)
const saving             = ref(false)
const formRef            = ref()
const importResultVisible = ref(false)
const importResults      = ref([])

const form = reactive({
  id: null, influencerType: 'OVERSEAS_INFLUENCER', teamName: '', accountName: '',
  countryMarket: '', platform: '', cooperationMode: '', paymentInfo: '', notes: ''
})

const allColumns = [
  { title: '类型',     key: 'influencerType',    width: 100 },
  { title: '红人团队', dataIndex: 'teamName',    key: 'teamName' },
  { title: '红人账号', dataIndex: 'accountName', key: 'accountName' },
  { title: '国家/市场', dataIndex: 'countryMarket', key: 'countryMarket' },
  { title: '平台',     dataIndex: 'platform',    key: 'platform' },
  { title: '合作模式', dataIndex: 'cooperationMode', key: 'cooperationMode' },
  // 收款信息：仅 ADMIN / AUDITOR
  { title: '收款信息', dataIndex: 'paymentInfo', key: 'paymentInfo', ellipsis: true },
  { title: '操作',     key: 'action',            width: 120 }
]

const visibleColumns = computed(() =>
  allColumns.filter(col => !col.sensitive || authStore.canViewFinancials)
)

async function loadData() {
  loading.value = true
  try { const res = await influencerApi.list(typeFilter.value); list.value = res.data || [] }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { id:null, influencerType:'OVERSEAS_INFLUENCER', teamName:'',
    accountName:'', countryMarket:'', platform:'', cooperationMode:'', paymentInfo:'', notes:'' })
  modalVisible.value = true
}

function openEdit(r) {
  editing.value = r
  Object.assign(form, { ...r })
  modalVisible.value = true
}

async function handleDelete(id) {
  await influencerApi.delete(id); message.success('删除成功'); loadData()
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await influencerApi.save({ ...form })
    message.success(form.id ? '更新成功' : '创建成功')
    modalVisible.value = false; loadData()
  } finally { saving.value = false }
}

async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    const res = await influencerApi.importExcel(fd)
    importResults.value = res.data || []; importResultVisible.value = true; loadData()
  } catch {}
  return false
}

onMounted(loadData)
</script>
