<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">汇率维护</span>
      <a-space>
        <a href="https://www.boc.cn/sourcedb/whpj/" target="_blank" rel="noopener">
          <a-button>
            <template #icon><LinkOutlined /></template>查看中国银行汇率
          </a-button>
        </a>
        <a-button type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增/修改月度汇率
        </a-button>
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      style="margin-bottom:16px"
      message="汇率改为人工维护，不再自动抓取。点击「查看中国银行汇率」跳转官网查看当月汇率，回来此页面手动填写。修改某月汇率会自动覆盖该月所有已存在项目订单的汇率字段。"
    />

    <div class="table-card">
      <a-table :columns="columns" :data-source="list" :loading="loading"
        row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'usdToCny'">
            1 USD = {{ record.usdToCny }} CNY
          </template>
          <template v-if="column.key === 'lastUpdatedAt'">
            {{ record.lastUpdatedAt ? formatDateTime(record.lastUpdatedAt) : '—' }}
          </template>
          <template v-if="column.key === 'action'">
            <a @click="openEdit(record)">修改</a>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal :open="modalVisible" title="新增/修改月度汇率"
      :confirm-loading="saving" @ok="handleSave" @cancel="modalVisible = false"
      :destroy-on-close="true">
      <a-alert v-if="form.yearMonth && existingRate(form.yearMonth)" type="warning" show-icon
        style="margin-bottom:16px"
        :message="`该月份已有汇率 ${existingRate(form.yearMonth)}，保存后将强制覆盖该月所有已存在项目订单的汇率`" />
      <a-form ref="formRef" :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="业务月份" name="yearMonth"
          :rules="[{ required: true, message: '请选择月份' }]">
          <a-date-picker v-model:value="form.monthVal" picker="month"
            format="YYYYMM" value-format="YYYYMM" style="width:100%"
            :disabled="!!editingId"
            @change="v => form.yearMonth = v" />
        </a-form-item>
        <a-form-item label="USD/CNY 汇率" name="usdToCny"
          :rules="[{ required: true, message: '请填写汇率' }]">
          <a-input-number v-model:value="form.usdToCny" style="width:100%" :precision="4" :min="0" />
          <div style="font-size:12px;color:#888;margin-top:4px">
            即 1 美元 = 多少人民币，对照
            <a href="https://www.boc.cn/sourcedb/whpj/" target="_blank" rel="noopener">中国银行官网</a>
            填写
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { exchangeRateApi } from '../../api/index'

const loading = ref(false)
const saving  = ref(false)
const list    = ref([])
const modalVisible = ref(false)
const formRef   = ref()
const editingId = ref(null)

const form = reactive({ yearMonth: null, monthVal: null, usdToCny: null })

const columns = [
  { title: '业务月份', dataIndex: 'yearMonth', key: 'yearMonth', width: 120 },
  { title: '汇率', key: 'usdToCny', width: 180 },
  { title: '最后修改人', dataIndex: 'updatedBy', key: 'updatedBy', width: 120 },
  { title: '最后修改时间', key: 'lastUpdatedAt', width: 180 },
  { title: '操作', key: 'action', width: 100 }
]

function existingRate(yearMonth) {
  const found = list.value.find(r => r.yearMonth === yearMonth)
  return found ? found.usdToCny : null
}

function formatDateTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} `
       + `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
}

async function loadList() {
  loading.value = true
  try {
    const res = await exchangeRateApi.list()
    list.value = res.data || []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { yearMonth: null, monthVal: null, usdToCny: null })
  modalVisible.value = true
}

function openEdit(record) {
  editingId.value = record.id
  Object.assign(form, {
    yearMonth: record.yearMonth,
    monthVal: record.yearMonth,
    usdToCny: parseFloat(record.usdToCny)
  })
  modalVisible.value = true
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    await exchangeRateApi.save({ yearMonth: form.yearMonth, usdToCny: form.usdToCny })
    message.success('保存成功，已自动覆盖该月项目订单汇率')
    modalVisible.value = false
    loadList()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadList)
</script>
