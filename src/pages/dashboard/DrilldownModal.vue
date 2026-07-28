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
        :pagination="tablePagination"
        row-key="dimensionLabel"
        size="middle"
        style="margin-top:12px"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'dimensionLabel'">
            <a-tag v-if="record.dimensionLabel" :color="colorForValue(record.dimensionLabel)">{{ record.dimensionLabel }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'amount'">
            <!-- 法务还没被管理层在"工资单"模块设置当月工资：显示提示文案，不是金额（2026-07 新增） -->
            <span v-if="record.dimensionType === 'legal_unset'" style="color:#8c8c8c">
              待管理层在工资单模块设置法务当月工资
            </span>
            <span v-else style="color:#237804;font-weight:600">{{ fmtAmount(record.amount) }}</span>
          </template>
          <template v-if="column.key === 'bonusAmount'">
            <span style="color:#d46b08">{{ fmtAmount(record.bonusAmount) }}</span>
          </template>
          <template v-if="column.key === 'totalAmount'">
            <span style="color:#237804;font-weight:600">{{ fmtAmount(record.totalAmount) }}</span>
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
            <template v-else-if="metric === 'commission'">
              <a-table-summary-cell><b>{{ totalVideoCount }}</b></a-table-summary-cell>
              <a-table-summary-cell><b>{{ fmtAmount(totalAmount) }}</b></a-table-summary-cell>
              <a-table-summary-cell><b>{{ fmtAmount(totalBonusAmount) }}</b></a-table-summary-cell>
              <a-table-summary-cell><b>{{ fmtAmount(totalTotalAmount) }}</b></a-table-summary-cell>
            </template>
            <template v-else-if="NO_COUNT_METRICS.includes(metric)">
              <a-table-summary-cell><b>{{ fmtAmount(totalAmount) }}</b></a-table-summary-cell>
            </template>
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
import { colorForValue } from '../../utils/tagColor'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '明细拆分' },
  // 'video' | 'client-price' | 'influencer-cost' | 'gross-profit' | 'commission'
  metric: { type: String, required: true },
  defaultMonth: { type: String, default: '' },
  showCurrencyToggle: { type: Boolean, default: false },
  dimensionOptions: { type: Array, default: null }, // null = 不显示维度切换
  countLabel: { type: String, default: '笔数' }, // 计数列的标签文字，大部分是"笔数"，员工成本这类是"人数"
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

const tablePagination = reactive({
  current: 1,
  pageSize: 10,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: t => `共 ${t} 条`
})

// "奖金"/"内部其他员工成本"这两个下钻维度本身就是员工姓名（一行=一个人），"人数"列
// 永远是1，没有信息量，不展示（2026-07-28 Shawn 反馈）
const NO_COUNT_METRICS = ['other-staff-cost', 'extra-bonus']
const columns = computed(() => {
  const dimCol = { title: '维度', dataIndex: 'dimensionLabel', key: 'dimensionLabel' }
  if (props.metric === 'video') {
    return [dimCol, { title: '视频数量', key: 'videoCount', dataIndex: 'videoCount' }]
  }
  if (NO_COUNT_METRICS.includes(props.metric)) {
    return [dimCol, { title: '金额', key: 'amount', dataIndex: 'amount' }]
  }
  const countCol = { title: props.countLabel, key: 'videoCount', dataIndex: 'videoCount', width: 90 }
  // "负责人提成明细"：金额列改名"提成金额"，追加 bonus、总金额两列
  if (props.metric === 'commission') {
    return [dimCol, countCol,
      { title: '提成金额', key: 'amount', dataIndex: 'amount' },
      { title: 'bonus', key: 'bonusAmount', dataIndex: 'bonusAmount' },
      { title: '总金额', key: 'totalAmount', dataIndex: 'totalAmount' }]
  }
  // 其余金额类下钻也把对应的订单笔数（或人数）列出来，方便核对
  return [dimCol, countCol, { title: '金额', key: 'amount', dataIndex: 'amount' }]
})

const totalVideoCount = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.videoCount) || 0), 0))
const totalAmount = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))
const totalBonusAmount = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.bonusAmount) || 0), 0))
const totalTotalAmount = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0))

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
    tablePagination.current = 1
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
    tablePagination.current = 1
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
  color: #595959;
}
.rate-hint a {
  color: #1677ff;
}
.rate-missing {
  color: #ff4d4f;
}
.empty-hint {
  text-align: center;
  color: #595959;
  padding: 32px 0;
}
</style>
