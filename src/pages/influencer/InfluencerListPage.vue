<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">红人管理</span>
      <a-space>
        <a-button @click="influencerApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="handleExport">
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

    <!-- 筛选条件 -->
    <div class="filter-bar">
      <a-select v-model:value="filters.influencerType" placeholder="红人类型"
        style="width:160px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('influencer_type')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="filters.platform" placeholder="平台"
        style="width:130px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="filters.countryMarket" placeholder="国家/市场"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.value.includes(input)"
        @change="loadData">
        <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-input v-model:value="filters.teamName" placeholder="红人团队"
        style="width:150px" allow-clear
        @pressEnter="loadData"
        @change="e => { if (!e.target.value) loadData() }" />

      <a-input-search v-model:value="filters.keyword" placeholder="搜索红人ID"
        style="width:180px" @search="loadData" allow-clear />

      <a-button @click="resetFilters">重置</a-button>
    </div>

    <!-- 表格 -->
    <div class="table-card">
      <a-table :columns="visibleColumns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'influencerType'">
            <a-tag :color="typeColor(record.influencerType)">
              {{ getLabel('influencer_type', record.influencerType) }}
            </a-tag>
          </template>

          <template v-if="column.key === 'teamNames'">
            <template v-if="record.teamNames">
              <a-tag v-for="t in splitMulti(record.teamNames)" :key="t" style="margin:2px">
                {{ t }}
              </a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'links'">
            <div v-if="record.links">
              <a v-for="(link, idx) in splitMulti(record.links)" :key="idx"
                :href="link" target="_blank"
                style="display:block;font-size:12px;word-break:break-all">
                {{ link }}
              </a>
            </div>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'casesLinks'">
            <div v-if="record.casesLinks">
              <a v-for="(link, idx) in splitMulti(record.casesLinks)" :key="idx"
                :href="link" target="_blank"
                style="display:block;font-size:12px;word-break:break-all">
                {{ link }}
              </a>
            </div>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'followerCount'">
            {{ fmtFollower(record.followerCount) }}
          </template>

          <template v-if="column.key === 'contactStatus'">
            <a-tag v-if="record.contactStatus" :color="contactColor(record.contactStatus)">
              {{ getLabel('contact_status', record.contactStatus) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'influencerCost'">
            <span :style="isRemark(record.influencerCost) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.influencerCost || '—' }}
            </span>
          </template>

          <template v-if="column.key === 'clientPrice'">
            <span :style="isRemark(record.clientPrice) ? 'color:#c00000;font-weight:600' : ''">
              {{ record.clientPrice || '—' }}
            </span>
          </template>

          <template v-if="column.key === 'projects'">
            <a v-if="projectCounts[record.id] > 0" @click="goToProjects(record.id)">
              查看（{{ projectCounts[record.id] }}个）
            </a>
            <span v-else style="color:#bbb">—</span>
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

    <InfluencerFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :can-view-financials="authStore.canViewFinancials"
      @saved="loadData"
    />

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
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { influencerApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import InfluencerFormModal from './InfluencerFormModal.vue'

const authStore = useAuthStore()
const router    = useRouter()
const { getOptions, getLabel } = useOptions()

const loading   = ref(false)
const tableData = ref([])
const modalVisible       = ref(false)
const editingRecord      = ref(null)
const importResultVisible = ref(false)
const importResults      = ref([])
// 记录每个红人的合作项目数量，key 为 influencer id
const projectCounts = ref({})

const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  influencerType: undefined, platform: undefined,
  countryMarket:  undefined, teamName: undefined, keyword: undefined
})

const allColumns = [
  { title: '红人类型',    key: 'influencerType',    width: 140 },
  { title: '红人团队',    key: 'teamNames',          width: 160 },
  { title: '红人ID',      dataIndex: 'accountName',  key: 'accountName',    width: 140 },
  { title: '国家/市场',   dataIndex: 'countryMarket',key: 'countryMarket',  width: 100 },
  { title: '平台',        dataIndex: 'platform',     key: 'platform',       width: 100 },
  { title: '领域',        dataIndex: 'domain',       key: 'domain',         width: 80  },
  { title: '粉丝量',      key: 'followerCount',      width: 100 },
  { title: '主页链接',    key: 'links',              width: 220 },
  { title: '合作案例',    key: 'casesLinks',         width: 220 },
  { title: '红人邮箱',    dataIndex: 'email',        key: 'email',          width: 160 },
  { title: '建联情况',    key: 'contactStatus',      width: 120 },
  { title: '付款周期',    dataIndex: 'paymentCycle', key: 'paymentCycle',   width: 90  },
  { title: '跟进人',      dataIndex: 'followerPerson',key: 'followerPerson', width: 90 },
  { title: '红人成本（$）',      key: 'influencerCost', width: 130, sensitive: true },
  { title: '客户合作价格（$）',  key: 'clientPrice',    width: 140, sensitive: true },
  { title: '备注',        dataIndex: 'notes',        key: 'notes',          width: 160, ellipsis: true },
  { title: '合作项目',    key: 'projects',           width: 90  },
  { title: '操作',        key: 'action',             width: 120, fixed: 'right' }
]

const visibleColumns = computed(() =>
  allColumns.filter(col => !col.sensitive || authStore.canViewFinancials)
)
const tableScrollX = computed(() =>
  visibleColumns.value.reduce((sum, c) => sum + (c.width || 120), 0)
)

async function loadData() {
  loading.value = true
  try {
    const res = await influencerApi.list({
      influencerType: filters.influencerType,
      platform:       filters.platform,
      countryMarket:  filters.countryMarket,
      teamName:       filters.teamName   || undefined,
      keyword:        filters.keyword    || undefined,
      page: pagination.current - 1,
      size: pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
    // 一次批量查询当前页所有红人的合作项目数量（1条SQL）
    if (tableData.value.length > 0) {
      const ids = tableData.value.map(inf => inf.id)
      try {
        const countRes = await influencerApi.projectCounts(ids)
        projectCounts.value = countRes.data || {}
      } catch { projectCounts.value = {} }
    } else {
      projectCounts.value = {}
    }
  } finally { loading.value = false }
}

function handleTableChange(pag) {
  pagination.current = pag.current; pagination.pageSize = pag.pageSize; loadData()
}
function resetFilters() {
  Object.assign(filters, { influencerType:undefined, platform:undefined,
    countryMarket:undefined, teamName:undefined, keyword:undefined })
  pagination.current = 1; loadData()
}
function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
async function handleDelete(id) {
  await influencerApi.delete(id); message.success('删除成功'); loadData()
}
function handleExport() { influencerApi.exportExcel(filters.influencerType) }
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    const res = await influencerApi.importExcel(fd)
    importResults.value = res.data || []; importResultVisible.value = true; loadData()
  } catch {}
  return false
}
function goToProjects(influencerId) {
  router.push({ path: '/projects', query: { influencerId } })
}

// 分隔符兼容：逗号或换行
function splitMulti(str) {
  if (!str) return []
  return str.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
}

function typeColor(t) {
  return { OVERSEAS_INFLUENCER:'blue', CHINA_INFLUENCER:'green', FOREIGN_IN_CHINA:'orange' }[t] || 'default'
}
function contactColor(s) {
  const m = { UNDEVELOPED:'default', REPLIED:'processing', INTERESTED:'cyan', COOPERATING:'blue', COOPERATED:'green' }
  return m[s] || 'default'
}
function fmtFollower(v) {
  if (!v) return '—'
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000)    return (v / 1000).toFixed(1) + 'K'
  return String(v)
}
function isRemark(value) {
  if (!value || !value.trim()) return false
  return isNaN(parseFloat(value.trim()))
}

onMounted(loadData)
</script>
