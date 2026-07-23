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
        <template v-if="authStore.canAccessBrands">
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
            <a-space v-if="authStore.canAccessBrands">
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
        <a-form-item label="付款周期类型">
          <a-select v-model:value="form.paymentCycleType" allow-clear placeholder="尚未配置">
            <a-select-option value="COST_THRESHOLD">按红人成本阈值分档</a-select-option>
            <a-select-option value="MONTH_END">月底对账日后N天结款</a-select-option>
          </a-select>
        </a-form-item>
        <template v-if="form.paymentCycleType === 'COST_THRESHOLD'">
          <a-form-item label="成本阈值" extra="单笔「红人视频制作与发布成本」金额阈值，单位为上面选择的结算币种">
            <a-input-number v-model:value="form.costThresholdAmount" style="width:100%" :precision="2" :min="0" />
          </a-form-item>
          <a-form-item label="≤ 阈值，几天内结款（天）">
            <a-input-number v-model:value="form.daysWithinThreshold" style="width:100%" :precision="0" :min="0" />
          </a-form-item>
          <a-form-item label="> 阈值，几天内结款（天）">
            <a-input-number v-model:value="form.daysAboveThreshold" style="width:100%" :precision="0" :min="0" />
          </a-form-item>
        </template>
        <template v-if="form.paymentCycleType === 'MONTH_END'">
          <a-form-item label="月底对账日后几天内结款（天）">
            <a-input-number v-model:value="form.daysAfterMonthEnd" style="width:100%" :precision="0" :min="0" />
          </a-form-item>
        </template>
        <a-form-item label="是否需要Invoice">
          <a-select v-model:value="form.requiresInvoice" allow-clear placeholder="默认需要">
            <a-select-option :value="true">需要</a-select-option>
            <a-select-option :value="false">不需要</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="合同签订周期">
          <a-select v-model:value="form.contractCycleType" allow-clear placeholder="尚未配置">
            <a-select-option value="ANNUAL">一年签一次合同</a-select-option>
            <a-select-option value="PER_REQUIREMENT">一次需求签一次合同</a-select-option>
          </a-select>
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
  id: null, name: '', countryMarket: '',
  contactPerson: '', settlementCurrency: 'USD',
  paymentCycleType: null, costThresholdAmount: null,
  daysWithinThreshold: null, daysAboveThreshold: null, daysAfterMonthEnd: null,
  notes: '',
  requiresInvoice: null, contractCycleType: null
})

const CONTRACT_CYCLE_LABELS = { ANNUAL: '一年签一次合同', PER_REQUIREMENT: '一次需求签一次合同' }

// 付款周期：按品牌方结算币种拼出可读的一行描述，尚未配置时显示"—"
function formatPaymentCycle(record) {
  if (record.paymentCycleType === 'COST_THRESHOLD') {
    const cur = record.settlementCurrency || ''
    const threshold = record.costThresholdAmount ?? '—'
    const within = record.daysWithinThreshold ?? '—'
    const above  = record.daysAboveThreshold  ?? '—'
    return `≤${threshold}${cur}：${within}天内；>${threshold}${cur}：${above}天内`
  }
  if (record.paymentCycleType === 'MONTH_END') {
    return `月结，对账日后${record.daysAfterMonthEnd ?? '—'}天内`
  }
  return '—'
}

const columns = [
  { title: '品牌方名称', dataIndex: 'name',              key: 'name' },
  { title: '国家/市场',  dataIndex: 'countryMarket',     key: 'countryMarket' },
  { title: '联系人',     dataIndex: 'contactPerson',     key: 'contactPerson' },
  { title: '结算币种',   dataIndex: 'settlementCurrency', key: 'settlementCurrency' },
  { title: '付款周期',   key: 'paymentCycle',
    customRender: ({ record }) => formatPaymentCycle(record) },
  { title: '是否需要Invoice', key: 'requiresInvoice',
    customRender: ({ record }) => record.requiresInvoice === false ? '不需要' : '需要' },
  { title: '合同签订周期', key: 'contractCycleType',
    customRender: ({ record }) => CONTRACT_CYCLE_LABELS[record.contractCycleType] || '—' },
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
  Object.assign(form, { id:null, name:'', countryMarket:'',
    contactPerson:'', settlementCurrency:'USD',
    paymentCycleType:null, costThresholdAmount:null,
    daysWithinThreshold:null, daysAboveThreshold:null, daysAfterMonthEnd:null,
    notes:'',
    requiresInvoice:null, contractCycleType:null })
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
