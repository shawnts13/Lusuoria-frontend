<template>
  <div class="page-container">
    <!-- Month selector -->
    <div class="page-header">
      <span class="page-title">数据看板</span>
      <a-date-picker
        v-model:value="selectedMonth"
        picker="month"
        format="YYYYMM"
        value-format="YYYYMM"
        placeholder="选择月份"
        @change="loadSummary"
      />
    </div>

    <a-spin :spinning="loading">
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card highlight">
          <div class="label">项目数量</div>
          <div class="value">{{ summary.totalProjects || 0 }}</div>
        </div>
        <div class="summary-card">
          <div class="label">客户合作价格（USD）</div>
          <div class="value">{{ fmt(summary.totalClientRevenue) }}</div>
        </div>
        <div class="summary-card">
          <div class="label">公司利润（人民币）</div>
          <div class="value">{{ fmtRmb(summary.totalRmbRevenue) }}</div>
        </div>
        <div class="summary-card warning">
          <div class="label">红人成本</div>
          <div class="value">{{ fmt(summary.totalInfluencerCost) }}</div>
        </div>
        <div class="summary-card">
          <div class="label">其他外部成本</div>
          <div class="value">{{ fmt(summary.totalOtherCost) }}</div>
        </div>
        <div class="summary-card">
          <div class="label">内部执行成本</div>
          <div class="value">{{ fmt(summary.totalExecCost) }}</div>
        </div>
        <div class="summary-card success">
          <div class="label">项目毛利</div>
          <div class="value">{{ fmt(summary.totalGrossProfit) }}</div>
        </div>
        <div class="summary-card success">
          <div class="label">可分配利润</div>
          <div class="value">{{ fmt(summary.totalDistributableProfit) }}</div>
        </div>
        <div class="summary-card warning">
          <div class="label">负责人提成合计</div>
          <div class="value">{{ fmt(summary.totalCommissionAmount) }}</div>
        </div>
        <div class="summary-card highlight">
          <div class="label">公司利润（美金）</div>
          <div class="value">{{ fmt(summary.totalCompanyNetProfit) }}</div>
        </div>
      </div>

      <!-- Manager Commission Breakdown -->
      <div class="table-card" v-if="summary.managerCommissions?.length">
        <div style="padding: 16px 24px; font-weight:600; border-bottom: 1px solid #f0f0f0;">
          负责人提成明细
        </div>
        <a-table
          :columns="commissionColumns"
          :data-source="summary.managerCommissions"
          :pagination="false"
          row-key="managerId"
          size="middle"
        />
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { projectApi } from '../../api/index'
import dayjs from 'dayjs'

const loading      = ref(false)
const selectedMonth = ref(dayjs().format('YYYYMM'))
const summary      = ref({})

const commissionColumns = [
  { title: '负责人',   dataIndex: 'managerName',   key: 'managerName' },
  { title: '项目数',   dataIndex: 'projectCount',  key: 'projectCount' },
  {
    title: '提成金额',
    dataIndex: 'totalCommission',
    key: 'totalCommission',
    customRender: ({ text }) => fmt(text)
  }
]

async function loadSummary() {
  if (!selectedMonth.value) return
  loading.value = true
  try {
    const res = await projectApi.monthlySummary(selectedMonth.value)
    summary.value = res.data || {}
  } catch {
    summary.value = {}
  } finally {
    loading.value = false
  }
}

function fmt(val) {
  if (val == null || val === '') return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtRmb(val) {
  if (val == null) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(loadSummary)
</script>
