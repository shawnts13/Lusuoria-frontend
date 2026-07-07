<template>
  <a-modal :open="visible" :title="title" width="640px" :footer="null" @cancel="close">
    <div class="drilldown-toolbar">
      <a-range-picker
        v-model:value="monthRange"
        picker="month"
        format="YYYYMM"
        value-format="YYYYMM"
        @change="reload"
        style="width:240px"
      />
      <template v-if="showCurrencyToggle">
        <a-radio-group v-model:value="currency" button-style="solid" size="small" @change="reload">
          <a-radio-button value="USD">USD</a-radio-button>
          <a-radio-button value="RMB">RMB</a-radio-button>
        </a-radio-group>
        <span v-if="exchangeRateInfo?.isMissing && currency === 'RMB'" class="rate-hint rate-missing">
          该月份汇率未维护，金额暂按 USD 展示
        </span>
        <span v-else-if="exchangeRateInfo?.usdToCny" class="rate-hint">
          汇率：1 USD = {{ exchangeRateInfo.usdToCny }} CNY
        </span>
      </template>
      <a-tooltip v-if="dimensionOptions?.length" :title="currentDimensionLabel">
        <a-select v-model:value="dimension"
          style="width:220px" size="small" @change="reload">
          <a-select-option v-for="d in dimensionOptions" :key="d.value" :value="d.value">{{ d.label }}</a-select-option>
        </a-select>
      </a-tooltip>
    </div>

    <a-spin :spinning="loading">
      <a-table
        :columns="columns"
        :data-source="rows"
        :pagination="rows.length > 10 ? { pageSize: 10 } : false"
        row-key="dimensionLabel"
        size="middle"
        style="margin-top:12px"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'amount'">
            {{ fmtAmount(record.amount) }}
          </template>
          <template v-if="column.key === 'videoCount'">
            {{ record.videoCount }}
          </template>
        </template>
        <template #summary>
          <a-table-summary-row v-if="rows.length">
            <a-table-summary-cell>汇总</a-table-summary-cell>
            <a-table-summary-cell v-if="metric === 'video'">
              <b>{{ totalVideoCount }}</b>
            </a-table-summary-cell>
            <template v-else>
              <a-table-summary-cell><b>{{ totalVideoCount }}</b></a-table-summary-cell>
              <a-table-summary-cell><b>{{ fmtAmount(totalAmount) }}</b></a-table-summary-cell>
            </template>
          </a-table-summary-row>
        </template>
      </a-table>
      <div v-if="!loading && rows.length === 0" class="empty-hint">该时间范围内暂无数据</div>
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import dayjs from 'dayjs'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '明细拆分' },
  // 'video' | 'client-price' | 'influencer-cost' | 'gross-profit' | 'commission'
  metric: { type: String, required: true },
  defaultMonth: { type: String, default: '' },
  showCurrencyToggle: { type: Boolean, default: false },
  dimensionOptions: { type: Array, default: null }, // null = 不显示维度切换
  fetcher: { type: Function, required: true } // 注入具体的请求函数，便于复用
})
const emit = defineEmits(['update:visible'])

const loading = ref(false)
const rows = ref([])
const exchangeRateInfo = ref(null)
const currency = ref('USD')
const dimension = ref(props.dimensionOptions?.[0]?.value || 'brand')
const currentDimensionLabel = computed(() => {
  const opt = props.dimensionOptions?.find(d => d.value === dimension.value)
  return opt ? opt.label : ''
})
const monthRange = ref([props.defaultMonth, props.defaultMonth])

const columns = computed(() => {
  const dimCol = { title: '维度', dataIndex: 'dimensionLabel', key: 'dimensionLabel' }
  if (props.metric === 'video') {
    return [dimCol, { title: '视频数量', key: 'videoCount', dataIndex: 'videoCount' }]
  }
  // 金额类下钻也把对应的订单笔数列出来，方便核对
  return [dimCol, { title: '笔数', key: 'videoCount', dataIndex: 'videoCount', width: 90 },
    { title: '金额', key: 'amount', dataIndex: 'amount' }]
})

const totalVideoCount = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.videoCount) || 0), 0))
const totalAmount = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))

function close() { emit('update:visible', false) }

function fmtAmount(v) {
  if (v == null) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  const prefix = currency.value === 'RMB' ? '¥' : '$'
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function reload() {
  if (!monthRange.value || monthRange.value.length !== 2) return
  loading.value = true
  try {
    const [start, end] = monthRange.value
    const res = await props.fetcher(start, end, currency.value, dimension.value)
    rows.value = res.data?.rows || []
    exchangeRateInfo.value = res.data?.exchangeRateInfo || null
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    monthRange.value = [props.defaultMonth, props.defaultMonth]
    currency.value = 'USD'
    if (props.dimensionOptions?.length) dimension.value = props.dimensionOptions[0].value
    reload()
  }
})
</script>

<style scoped>
.drilldown-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rate-hint {
  font-size: 12px;
  color: #888;
}
.rate-hint a {
  color: #1677ff;
}
.rate-missing {
  color: #ff4d4f;
}
.empty-hint {
  text-align: center;
  color: #999;
  padding: 32px 0;
}
</style>
