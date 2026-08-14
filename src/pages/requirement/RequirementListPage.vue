<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">1. 红人需求管理</span>
      <a-space>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <a-button v-if="authStore.canWrite" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新建需求
        </a-button>
        <a-popconfirm v-if="authStore.isAdmin"
          title="重新计算所有需求的需求完成时间？用于'存量记录关联需求'历史遗留数据的善后，正常使用不需要点这个。"
          @confirm="handleRecomputeCompletedAt">
          <a-button :loading="recomputingCompletedAt">重新计算需求完成时间</a-button>
        </a-popconfirm>
      </a-space>
    </div>

    <div class="filter-bar">
      <a-select v-model:value="filters.brandId" placeholder="品牌方" style="width:150px" allow-clear
        show-search :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())" @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队" style="width:150px" allow-clear
        show-search :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())" @change="loadData">
        <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
      </a-select>
      <a-auto-complete v-model:value="filters.accountName" placeholder="红人社媒完整名字（可输入搜索）"
        style="width:220px" allow-clear
        :options="accountNameOptions"
        :filter-option="(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())"
        @select="loadData" @clear="loadData" @keyup.enter="loadData" />
      <!-- 输入建议框的回车键会先把输入框内容"自动补全"成高亮的那条建议再触发搜索——
           想直接按自己手输的原始文字搜（不想被补全成建议里的某个红人）时，点这个按钮，
           不会触发补全，就用输入框里当前的原始文字去查 -->
      <a-button @click="loadData"><template #icon><SearchOutlined /></template></a-button>
      <a-date-picker v-model:value="filters.requirementMonth" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="需求月份" style="width:150px"
        allow-clear @change="loadData" />
      <a-date-picker v-model:value="filters.completedMonth" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="需求完成月份" style="width:150px"
        allow-clear @change="loadData" />
      <a-input-search v-model:value="filters.internalRequirementNo" placeholder="搜索内部需求编号"
        style="width:200px" @search="loadData" allow-clear />
      <a-button @click="resetFilters">重置</a-button>
      <a-button class="incomplete-filter-btn" :class="{ active: filters.onlyIncomplete }"
        style="margin-left:16px" @click="toggleOnlyIncomplete">
        <template #icon><FilterOutlined /></template>
        {{ filters.onlyIncomplete ? '查看全部需求' : '查看未完成的需求' }}
      </a-button>
      <a-button class="incomplete-filter-btn" :class="{ active: filters.onlyMissingInvoice }"
        @click="toggleOnlyMissingInvoice">
        <template #icon><FilterOutlined /></template>
        {{ filters.onlyMissingInvoice ? '查看全部需求' : '查看未上传invoice的需求' }}
      </a-button>
      <a-button class="incomplete-filter-btn" :class="{ active: filters.onlyMissingContract }"
        @click="toggleOnlyMissingContract">
        <template #icon><FilterOutlined /></template>
        {{ filters.onlyMissingContract ? '查看全部需求' : '查看未上传合同的需求' }}
      </a-button>
      <a-button v-if="authStore.canManagePayments" class="incomplete-filter-btn"
        :class="{ active: filters.onlyUnsettled }" @click="toggleOnlyUnsettled">
        <template #icon><FilterOutlined /></template>
        {{ filters.onlyUnsettled ? '查看全部需求' : '查看未结款的需求' }}
      </a-button>
    </div>

    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brandName'">
            <a-tag v-if="getBrandName(record.brandId)" :color="colorForValue(getBrandName(record.brandId))">
              {{ getBrandName(record.brandId) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'teamName'">
            <a-tag v-if="getTeamName(record.teamId)" :color="colorForValue(getTeamName(record.teamId))">
              {{ getTeamName(record.teamId) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'accountName'">{{ getInfluencerName(record.influencerId) || '—' }}</template>
          <template v-if="column.key === 'fullRequirementContent'">
            <a @click="viewContent(record)">查看完整需求内容</a>
          </template>
          <template v-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
          <template v-if="column.key === 'items'">
            <a @click="viewItems(record)">查看涉及的红人需求条目</a>
          </template>
          <template v-if="column.key === 'totalClientPrice'">{{ fmtNum(record.totalClientPrice) }}</template>
          <template v-if="column.key === 'totalInfluencerCost'">{{ fmtNum(record.totalInfluencerCost) }}</template>
          <template v-if="column.key === 'progress'">
            <div style="display:flex;flex-direction:column;gap:2px;width:150px">
              <a-progress :percent="progressPercent(record)" :stroke-color="progressColor(record)"
                :show-info="false" size="small" />
              <div style="font-size:12px;white-space:nowrap;display:flex;justify-content:space-between">
                <a @click="viewProgress(record)">{{ record.completedCount ?? 0 }}/{{ record.totalItemCount ?? 0 }}</a>
                <!-- 已实施：这个需求下实际关联了多少笔红人合作跟踪记录（establishedCount，不看进度
                     状态、含折损，跟"完成进度"分子 completedCount 不是一回事——完成进度只数已发布/
                     已结算/折损这几个终态，已实施数的是"名额有没有被占上"，两者可能不同步，比如
                     条目名额已经全部建立了跟踪记录但还没有一条走到终态时，会显示 0/3 (已实施: 3)） -->
                <span style="color:#595959">(已实施: {{ record.establishedCount ?? 0 }})</span>
              </div>
            </div>
          </template>
          <template v-if="column.key === 'completedAt'">
            {{ record.completedAt ? formatDateTime(record.completedAt) : '—' }}
          </template>
          <template v-if="column.key === 'settlementStatus'">
            <a-tag v-if="record.settlementStatus" :color="record.settlementStatus === 'PAID' ? 'green' : 'orange'">
              {{ record.settlementStatus === 'PAID' ? '已付款' : '已添加结款记录' }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'notes'">
            <span v-if="record.notes" style="color:#ff4d4f" :title="record.notes">{{ record.notes }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'invoiceLink'">
            <span v-if="getBrand(record.brandId)?.requiresInvoice === false" style="color:#bbb">不涉及</span>
            <a v-else-if="record.invoiceLink" :href="record.invoiceLink" target="_blank" style="font-size:12px">查看Invoice</a>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'contractLink'">
            <a v-if="contractCellState(record).mode === 'link'"
              :href="contractCellState(record).href" target="_blank" style="font-size:12px">查看合同</a>
            <a v-else-if="contractCellState(record).mode === 'gotoTeamContract'"
              @click="goToTeamContract(record)"
              style="font-size:12px;color:#595959;cursor:pointer">{{ contractCellState(record).text }}</a>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite || authStore.canManagePayments">
              <template v-if="authStore.canWrite">
                <a @click="openEdit(record)">编辑</a>
                <a-divider type="vertical" />
                <a-tooltip :title="invoiceButtonState(record).tooltip">
                  <span>
                    <a-button size="small" :disabled="invoiceButtonState(record).disabled"
                      :class="{ 'invoice-btn-pending': invoiceButtonState(record).reason === 'notComplete' }"
                      @click="openInvoiceModal(record)">上传Invoice</a-button>
                  </span>
                </a-tooltip>
                <a-divider type="vertical" />
                <a-tooltip :title="isRequirementComplete(record) ? '该需求下所有条目都已建立跟踪记录，无需再新建合作跟踪' : ''">
                  <span>
                    <a-button size="small" :disabled="isRequirementComplete(record)"
                      @click="openBatchCreateForRequirement(record)">新建合作跟踪</a-button>
                  </span>
                </a-tooltip>
                <a-divider type="vertical" />
                <a-tooltip :title="contractButtonState(record).tooltip">
                  <span>
                    <a-button size="small" :disabled="contractButtonState(record).disabled"
                      :class="{ 'contract-btn-goto': contractButtonState(record).mode === 'gotoTeamContract' }"
                      @click="handleContractButtonClick(record)">{{ contractButtonState(record).label }}</a-button>
                  </span>
                </a-tooltip>
              </template>
              <template v-if="authStore.canManagePayments">
                <a-divider v-if="authStore.canWrite" type="vertical" />
                <a-tooltip :title="settlementButtonState(record).tooltip">
                  <span>
                    <a-button size="small" :disabled="settlementButtonState(record).disabled"
                      :class="{ 'settlement-btn-ready': !settlementButtonState(record).disabled }"
                      @click="goToSettlement(record)">去结款</a-button>
                  </span>
                </a-tooltip>
              </template>
              <template v-if="authStore.canWrite">
                <a-divider type="vertical" />
                <span v-if="record.hasPendingDeleteRequest" style="color:#faad14">审核中</span>
                <a v-else style="color:#ff4d4f" @click="openDeleteReason(record)">删除</a>
              </template>
            </a-space>
            <span v-else style="color:#bbb">只读</span>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 删除需要管理员审核（2026-08 起，跟红人合作跟踪保持一致），不再是点一下就直接删 -->
    <a-modal v-model:open="deleteReasonVisible" title="删除申请" @ok="handleDeleteConfirm" :confirm-loading="deleting">
      <p style="color:#595959;font-size:13px">删除红人需求记录需要管理员审核，请填写删除原因。</p>
      <a-form layout="vertical">
        <a-form-item label="删除原因" required>
          <a-textarea v-model:value="deleteReason" :rows="3" placeholder="请说明删除原因" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="contentModalVisible" title="完整需求内容" :footer="null" width="640px">
      <div style="white-space:pre-wrap;font-size:13px;line-height:1.6" v-html="highlightContent(contentModalText)"></div>
    </a-modal>

    <RequirementFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      @saved="loadData"
    />

    <RequirementItemsViewModal v-model:visible="itemsModalVisible" :requirement-id="itemsModalRequirementId" />

    <RequirementProgressModal v-model:visible="progressModalVisible" :requirement-id="progressModalRequirementId" />

    <RequirementInvoiceModal v-model:visible="invoiceModalVisible" :requirement="invoiceModalRequirement"
      :account-name="getInfluencerName(invoiceModalRequirement?.influencerId)"
      @saved="loadData" />

    <RequirementContractModal v-model:visible="contractModalVisible" :requirement="contractModalRequirement"
      :account-name="getInfluencerName(contractModalRequirement?.influencerId)"
      @saved="loadData" />

    <CollaborationBatchCreateModal
      ref="batchCreateModalRef"
      v-model:visible="batchCreateModalVisible"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      :can-view-baseline-financials="authStore.canViewBaselineFinancials"
      @saved="loadData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ExportOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { requirementApi, teamContractApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { useReferenceData } from '../../composables/useReferenceData'
import { formatDateTime } from '../../utils/dateFormat'
import { colorForValue } from '../../utils/tagColor'
import RequirementFormModal from './RequirementFormModal.vue'
import RequirementItemsViewModal from './RequirementItemsViewModal.vue'
import RequirementProgressModal from './RequirementProgressModal.vue'
import RequirementInvoiceModal from './RequirementInvoiceModal.vue'
import RequirementContractModal from './RequirementContractModal.vue'
import CollaborationBatchCreateModal from '../collaboration/CollaborationBatchCreateModal.vue'

const authStore = useAuthStore()
const { loadBrands, loadTeams, loadInfluencersSimple, loadEmployees } = useReferenceData()
const route = useRoute()
const router = useRouter()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading     = ref(false)
const recomputingCompletedAt = ref(false)
const tableData   = ref([])
const brands      = ref([])
const teams       = ref([])
const influencers = ref([])
// "红人社媒完整名字"筛选用 a-auto-complete（2026-08 起从 a-select 改过来），道理跟
// CollaborationListPage.vue 的 accountNameOptions 一样：既能从缓存选、也能直接手输
// 搜索，不受缓存刷新延迟限制
const accountNameOptions = computed(() =>
  [...new Set(influencers.value.map(inf => inf.accountName))].map(name => ({ value: name })))
const employees   = ref([])

const modalVisible  = ref(false)
const editingRecord = ref(null)

const deleteReasonVisible = ref(false)
const deleteReason        = ref('')
const deleteTarget        = ref(null)
const deleting            = ref(false)

const contentModalVisible = ref(false)
const contentModalText    = ref('')

const itemsModalVisible = ref(false)
const itemsModalRequirementId = ref(null)

const progressModalVisible = ref(false)
const progressModalRequirementId = ref(null)

const invoiceModalVisible = ref(false)
const invoiceModalRequirement = ref(null)

const contractModalVisible = ref(false)
const contractModalRequirement = ref(null)

const batchCreateModalVisible = ref(false)
const batchCreateModalRef = ref(null)

// 团队级合同数据（2026-08 起团队下所有红人共用同一份合同，不再按红人各自维护）：
// teamContractsByTeamId 按团队id批量拉取（key=teamId），teamContractsByBrandIdNoTeam 按
// 品牌方id批量拉取"该品牌方没有团队层"的那部分（key=brandId），每条含
// brandId/teamId/startDate/endDate/contractLink，供"合同链接"列/按钮判断品牌方"一年签一次
// 合同"时，该需求的品牌方/团队/需求月份是否命中"品牌方/红人团队管理"里维护的某条合同
const teamContractsByTeamId = ref({})
const teamContractsByBrandIdNoTeam = ref({})

const sortState = reactive({ field: 'id', order: 'descend' })
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  brandId: undefined, teamId: undefined, accountName: undefined,
  requirementMonth: undefined,
  // "需求完成月份"筛选（2026-08 新增）：取需求完成时间（completedAt）对应的月份，跟"需求月份"
  // （requirementMonth，需求本身归属的月份）是两个不同维度，不互斥、可同时筛
  completedMonth: undefined,
  // 支持从"进度提醒"详情等外部入口带 internalRequirementNo 跳转过来直接定位
  internalRequirementNo: route.query.internalRequirementNo || undefined,
  // "查看未完成的需求"开关：只看"需求完成进度"没到100%的（含还没有任何条目、显示0%的情况）
  onlyIncomplete: false,
  // "查看未上传invoice的需求"/"查看未上传合同的需求"开关（2026-08 新增）：跟 onlyIncomplete
  // 互斥（后端一次只认一个），口径分别对齐"Invoice逾期"/"合同上传逾期"提醒批次的候选范围
  // （需求已完成 + 涉及invoice上传/每次需求签一次合同 + 还没传），只是不按超期天数分档，
  // 方便随时自查、不用等提醒真正超出阈值才触发
  onlyMissingInvoice: false,
  onlyMissingContract: false,
  // "查看未结款的需求"开关（2026-08 新增，仅管理层可见）：跟上面三个互斥，口径见后端
  // InfluencerRequirementService.pageUnsettled() 的注释——不要求需求必须100%完成，
  // 未完成的需求也会出现，只是排序上靠后
  onlyUnsettled: false
})

// 列顺序按需求描述：内部需求编号、需求月份、品牌方、红人团队、服务国家/市场、红人社媒完整名字、
// 完整需求内容、创建时间、查看涉及的红人需求条目、需求条目总数、客户合作总价格、
// 红人视频制作与发布总成本、需求完成进度
const columns = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 200, sorter: true },
  { title: '需求月份', dataIndex: 'requirementMonth', key: 'requirementMonth', width: 110, sorter: true },
  { title: '品牌方', key: 'brandName', width: 130 },
  { title: '红人团队', key: 'teamName', width: 160 },
  { title: '服务国家/市场', dataIndex: 'countryMarket', key: 'countryMarket', width: 120, sorter: true },
  { title: '红人社媒完整名字', key: 'accountName', width: 150, sorter: true },
  { title: '完整需求内容', key: 'fullRequirementContent', width: 150 },
  { title: '创建时间', key: 'createdAt', width: 160, sorter: true },
  { title: '涉及的红人需求条目', key: 'items', width: 160 },
  { title: '需求条目总数', dataIndex: 'totalItemCount', key: 'totalItemCount', width: 120, sorter: true },
  { title: '客户合作总价格（$）', key: 'totalClientPrice', width: 160, sorter: true },
  { title: '红人视频制作与发布总成本（$）', key: 'totalInfluencerCost', width: 200, sorter: true },
  { title: '需求完成进度', key: 'progress', width: 180 },
  { title: '需求完成时间', key: 'completedAt', width: 150 },
  { title: '结款状态', key: 'settlementStatus', width: 130 },
  { title: '备注', dataIndex: 'notes', key: 'notes', width: 160, ellipsis: true },
  { title: 'Invoice链接', key: 'invoiceLink', width: 110 },
  { title: '合同链接', key: 'contractLink', width: 220 },
  { title: '操作', key: 'action', width: 440, fixed: 'right' }
]
const tableScrollX = computed(() => columns.reduce((sum, c) => sum + (c.width || 120), 0))

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
// "查看完整需求内容"弹窗高亮：原文是自由文本，不是结构化字段，用正则给已知标签/金额上色，
// 方便一眼看出重要信息。先转义再上色，避免用户自由文本里带 <> 之类字符被当成 HTML 注入
function highlightContent(text) {
  if (!text) return ''
  let html = escapeHtml(text)
  // 客户/红人价格类标签（含"合作价格"这种不带前缀的不规范写法）用蓝色加粗强调
  html = html.replace(/(客户价格|客户合作价格|红人成本|红人合作成本|合作价格)(（[^）]*）)?([：:])/g,
    '<span style="color:#1677ff;font-weight:600">$1$2$3</span>')
  // 其余常见标签弱化成灰色，降低视觉噪音，衬托真正重要的价格/金额信息
  html = html.replace(/(红人区域|红人完整名字|红人社媒完整名字|红人TEMU系统ID|下单条数|下单机构|投流期限|版权)([：:])/g,
    '<span style="color:#595959">$1$2</span>')
  // "其他权益"小标题
  html = html.replace(/(其他权益)/g, '<span style="color:#595959;font-weight:600">$1</span>')
  // USD 金额单独标红加粗，是全文最需要一眼看到的数字
  html = html.replace(/([\d.]+\s*USD)/g, '<span style="color:#c00000;font-weight:600">$1</span>')
  return html
}
function fmtNum(v) {
  if (v == null) return '—'
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// 需求完成进度条配色：100%绿色、高于50%黄色、其余（含0）橙色，条目总数为0时用灰色（还没有条目）
function progressPercent(record) {
  const total = record.totalItemCount ?? 0
  if (total <= 0) return 0
  return Math.round(((record.completedCount ?? 0) / total) * 100)
}
function progressColor(record) {
  const total = record.totalItemCount ?? 0
  if (total <= 0) return '#d9d9d9'
  const ratio = (record.completedCount ?? 0) / total
  if (ratio >= 1) return '#52c41a'
  if (ratio > 0.5) return '#faad14'
  return '#fa8c16'
}
// "新建合作跟踪"按钮的可点条件：跟 onlyIncomplete 筛选、后端 pageIncomplete 用的是同一套
// "需求完成进度"判定——total>0 且 completed>=total 才算完成，条目总数为0（0%）不算完成
// "新建合作跟踪"按钮是否禁用：看这条需求下的条目是不是都已经建立了跟踪记录
// （establishedCount，不看 progress 状态），而不是看"需求完成进度"（completedCount，
// 只看已发布/已结算/折损这几个终态）——后者没到100%也可能每个条目的名额都已经被
// 建立的跟踪记录占满了，此时不该再允许新建
function isRequirementComplete(record) {
  const total = record.totalItemCount ?? 0
  return total > 0 && (record.establishedCount ?? 0) >= total
}
function openBatchCreateForRequirement(record) {
  batchCreateModalRef.value?.openForRequirement(record)
}

// "去结款"按钮可点条件（2026-08 新增）：需求完成进度=100%，跟"上传Invoice"按钮 done 的
// 判定口径一致（total>0 且 completedCount>=total），不是 isRequirementComplete 那个
// "已建立跟踪记录数"口径
function isProgress100(record) {
  const total = record.totalItemCount ?? 0
  return total > 0 && (record.completedCount ?? 0) >= total
}
// "去结款"按钮的禁用状态+悬浮提示（2026-08 修复：之前只判断了需求完成进度，没管"结款状态"，
// 导致已经"已添加结款记录"/"已付款"的需求也能点"去结款"、重复走一遍新建结款记录流程）。
// 结款状态非空（已经有结款记录关联）优先于"未实施完成"——两种"点不了"的原因不一样，
// 分别给不同提示文案，方便管理层一眼看出到底是哪种情况
function settlementButtonState(record) {
  if (record.settlementStatus === 'PAID') {
    return { disabled: true, tooltip: '该需求已付款，无需再次结款' }
  }
  if (record.settlementStatus === 'ADDED_TO_PAYMENT') {
    return { disabled: true, tooltip: '该需求已添加结款记录（待付款），无需再次结款' }
  }
  return isProgress100(record)
    ? { disabled: false, tooltip: '' }
    : { disabled: true, tooltip: '该需求尚未实施完成，暂时无法结款' }
}
// 新开一个标签页跳到"红人结款"模块，自动预填并停在"选择涉及的红人视频项目"弹窗，
// 跟应用里其他跨模块跳转（比如"合同快到期"提醒的"查看详情"）保持一致的新标签页习惯
function goToSettlement(record) {
  window.open(router.resolve({ path: '/payments', query: { createFromRequirement: record.id } }).href, '_blank')
}
function getBrand(id) { return brands.value.find(b => b.id === id) }
function getBrandName(id) { return getBrand(id)?.name }

// "上传Invoice"按钮的禁用状态+悬浮提示：品牌方不涉及invoice上传 优先于 "需求未实施完成"。
// 两种禁用原因用不同颜色区分：不涉及invoice（本来就不需要点）用灰色，尚未实施完成
// （还没到能点的时候，但流程正常推进中）用橙色，避免两种"点不了"的情况看起来一样
function invoiceButtonState(record) {
  const brand = getBrand(record.brandId)
  if (brand && brand.requiresInvoice === false) {
    return { disabled: true, reason: 'notRequired', tooltip: '该品牌方不涉及Invoice上传' }
  }
  const total = record.totalItemCount ?? 0
  const done = total > 0 && (record.completedCount ?? 0) >= total
  return done
    ? { disabled: false, reason: null, tooltip: null }
    : { disabled: true, reason: 'notComplete', tooltip: '该需求尚未实施完成，还无需上传Invoice' }
}
function getTeamName(id) { return teams.value.find(t => t.id === id)?.name }
function getInfluencerName(id) { return influencers.value.find(i => i.id === id)?.accountName }

// 判断"需求月份"（yyyyMM）是否落在合同有效期 [startDate, endDate] 内：只要这个月里有任意
// 一天落在区间内就算覆盖（比如合同 2025-08-15 至 2026-08-14，需求月份 202508 也算覆盖）
function monthOverlapsContractRange(yyyymm, startDate, endDate) {
  if (!yyyymm || yyyymm.length < 6 || !startDate || !endDate) return false
  const y = parseInt(yyyymm.slice(0, 4), 10)
  const m = parseInt(yyyymm.slice(4, 6), 10)
  if (Number.isNaN(y) || Number.isNaN(m)) return false
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd = new Date(y, m, 0)
  const start = new Date(startDate)
  const end = new Date(endDate)
  return monthStart <= end && start <= monthEnd
}
// 按这条需求的 (品牌方,团队,需求月份) 去匹配"品牌方/红人团队管理"里维护的、这个品牌方这个
// 团队下"需求月份落在有效期内"的那条团队级合同（品牌方"一年签一次合同"场景，2026-08 起
// 团队下所有红人共用同一份合同，不再按红人各自维护）
function matchedTeamContract(record) {
  const contracts = record.teamId
    ? (teamContractsByTeamId.value[record.teamId] || [])
    : (teamContractsByBrandIdNoTeam.value[record.brandId] || [])
  return contracts.find(c =>
    c.brandId === record.brandId &&
    (c.teamId ?? null) === (record.teamId ?? null) &&
    monthOverlapsContractRange(record.requirementMonth, c.startDate, c.endDate)
  ) || null
}
async function loadTeamContracts() {
  const teamIds = [...new Set(tableData.value.map(r => r.teamId).filter(Boolean))]
  const brandIdsNoTeam = [...new Set(tableData.value.filter(r => !r.teamId).map(r => r.brandId).filter(Boolean))]
  const [byTeam, byBrandNoTeam] = await Promise.all([
    teamIds.length ? teamContractApi.byTeamIds(teamIds) : Promise.resolve({ data: {} }),
    brandIdsNoTeam.length ? teamContractApi.byBrandIdsNoTeam(brandIdsNoTeam) : Promise.resolve({ data: {} })
  ])
  teamContractsByTeamId.value = byTeam.data || {}
  teamContractsByBrandIdNoTeam.value = byBrandNoTeam.data || {}
}

// "合同链接"列的展示状态：品牌方"每次需求签一次合同"时看需求自己的 contractLink；
// "一年签一次合同"时按需求自己的品牌方/团队/需求月份去匹配"品牌方/红人团队管理"里对应的
// 团队级合同，匹配上就直接展示真实链接，没匹配上则展示可点击的引导文案（点击效果等同操作列的
// "上传合同"按钮跳转团队管理）
function contractCellState(record) {
  const brand = getBrand(record.brandId)
  const isAnnual = brand?.contractCycleType === 'ANNUAL'
  if (!isAnnual) {
    return record.contractLink ? { mode: 'link', href: record.contractLink } : { mode: 'none' }
  }
  const matched = matchedTeamContract(record)
  if (matched) return { mode: 'link', href: matched.contractLink }
  return { mode: 'gotoTeamContract', text: '该品牌方是一年签一次合同，请在"品牌方/红人团队管理"处上传' }
}

// "上传合同"操作按钮的三态：每次需求签一次合同 -> 始终可点的"上传合同"；一年签一次合同且
// 该品牌方该团队下已有一条"需求月份落在有效期内"的合同 -> 置灰的"上传合同"（文案统一，
// 不再按年份报文案，跟第一种状态保持一致的按钮宽度，避免表格排版参差不齐）；一年签一次合同
// 且没匹配上任何合同 -> 同样是"上传合同"，但保留 contract-btn-goto 的不起眼配色跟真正能
// 直接上传的那种区分开，点击后跳转团队管理
function contractButtonState(record) {
  const brand = getBrand(record.brandId)
  const isAnnual = brand?.contractCycleType === 'ANNUAL'
  if (!isAnnual) {
    return { disabled: false, mode: 'upload', label: '上传合同', tooltip: null }
  }
  const matched = matchedTeamContract(record)
  if (matched) {
    return {
      disabled: true, mode: 'matched', label: '上传合同',
      tooltip: '该品牌方/团队已存在还在有效期内的合同，若合同上传有误，请在"品牌方/红人团队管理"更新合同链接。'
    }
  }
  return {
    disabled: false, mode: 'gotoTeamContract', label: '上传合同',
    tooltip: '该品牌方是一年签一次合同，请在"品牌方/红人团队管理"处上传'
  }
}
function handleContractButtonClick(record) {
  const state = contractButtonState(record)
  if (state.mode === 'upload') openContractModal(record)
  else if (state.mode === 'gotoTeamContract') goToTeamContract(record)
}
function openContractModal(record) {
  contractModalRequirement.value = record
  contractModalVisible.value = true
}
// 2026-08 改成新开标签页（跟应用里其他跨模块跳转，比如"去结款"、"需求完成进度详情"的
// "查看详情"，保持一致的新标签页习惯），不打断当前正在看的需求列表/筛选状态。跳转到
// "品牌方/红人团队管理"，按品牌方+团队自动定位并展开对应的团队合同列表（见 BrandListPage.vue
// 对 openBrandId/openTeamId 的处理），不再是某个具体红人
function goToTeamContract(record) {
  const query = { openBrandId: record.brandId }
  if (record.teamId) query.openTeamId = record.teamId
  window.open(router.resolve({ path: '/brands', query }).href, '_blank')
}

async function loadData() {
  loading.value = true
  try {
    const res = await requirementApi.list({
      brandId: filters.brandId,
      teamId: filters.teamId,
      accountName: filters.accountName?.trim() || undefined,
      requirementMonth: filters.requirementMonth?.trim() || undefined,
      completedMonth: filters.completedMonth?.trim() || undefined,
      internalRequirementNo: filters.internalRequirementNo?.trim() || undefined,
      onlyIncomplete: filters.onlyIncomplete,
      onlyMissingInvoice: filters.onlyMissingInvoice,
      onlyMissingContract: filters.onlyMissingContract,
      onlyUnsettled: filters.onlyUnsettled,
      sortBy: sortState.field,
      sortDir: sortState.order === 'descend' ? 'desc' : 'asc',
      page: pagination.current - 1,
      size: pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
    await loadTeamContracts()
  } finally {
    loading.value = false
    remeasure()
  }
}

function handleTableChange(pag, _filters, sorter) {
  pagination.current  = pag.current
  pagination.pageSize = pag.pageSize
  if (sorter && sorter.field) {
    sortState.field = sorter.field
    sortState.order = sorter.order || 'ascend'
  }
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    brandId: undefined, teamId: undefined, accountName: undefined,
    requirementMonth: undefined, completedMonth: undefined, internalRequirementNo: undefined,
    onlyIncomplete: false, onlyMissingInvoice: false, onlyMissingContract: false,
    onlyUnsettled: false
  })
  pagination.current = 1
  sortState.field = 'id'
  sortState.order = 'descend'
  loadData()
}

// 四个"查看未XX的需求"开关互斥（后端一次只认一个），打开一个就把其余的关掉
function toggleOnlyIncomplete() {
  filters.onlyIncomplete = !filters.onlyIncomplete
  if (filters.onlyIncomplete) { filters.onlyMissingInvoice = false; filters.onlyMissingContract = false; filters.onlyUnsettled = false }
  pagination.current = 1
  loadData()
}
function toggleOnlyMissingInvoice() {
  filters.onlyMissingInvoice = !filters.onlyMissingInvoice
  if (filters.onlyMissingInvoice) { filters.onlyIncomplete = false; filters.onlyMissingContract = false; filters.onlyUnsettled = false }
  pagination.current = 1
  loadData()
}
function toggleOnlyMissingContract() {
  filters.onlyMissingContract = !filters.onlyMissingContract
  if (filters.onlyMissingContract) { filters.onlyIncomplete = false; filters.onlyMissingInvoice = false; filters.onlyUnsettled = false }
  pagination.current = 1
  loadData()
}
function toggleOnlyUnsettled() {
  filters.onlyUnsettled = !filters.onlyUnsettled
  if (filters.onlyUnsettled) { filters.onlyIncomplete = false; filters.onlyMissingInvoice = false; filters.onlyMissingContract = false }
  pagination.current = 1
  loadData()
}

async function handleRecomputeCompletedAt() {
  recomputingCompletedAt.value = true
  try {
    const res = await requirementApi.recomputeCompletedAt()
    Modal.info({
      title: '重新计算需求完成时间完成',
      width: 520,
      content: h('div', { style: 'white-space:pre-line;line-height:1.7' }, res.data || '重新计算完成')
    })
    loadData()
  } finally { recomputingCompletedAt.value = false }
}

function openCreate() { editingRecord.value = null; modalVisible.value = true }
function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
// 2026-08 起删除改成需要管理员审核（不再直接删），跟红人合作跟踪的删除申请弹窗是同一套写法。
// 不手动 catch——请求失败时 http.js 的全局响应拦截器已经会弹一次错误 toast，这里再 catch
// 一次会变成两条重复提示（老版本 handleDelete() 就有这个问题，这次顺手不带过去）
function openDeleteReason(r) { deleteTarget.value = r; deleteReason.value = ''; deleteReasonVisible.value = true }
async function handleDeleteConfirm() {
  if (!deleteReason.value?.trim()) { message.warning('请填写删除原因'); return }
  deleting.value = true
  try {
    await requirementApi.requestDelete(deleteTarget.value.id, deleteReason.value.trim())
    message.success('已提交删除申请，等待管理员审核')
    deleteReasonVisible.value = false
    loadData()
  } finally { deleting.value = false }
}
function handleExport() {
  // 2026-08 修复：之前漏传了4个"查看XX的需求"快捷筛选开关，导致点了快捷筛选按钮之后再导出，
  // 导出的还是忽略这个筛选条件的数据（后端 exportExcel 现在也认这几个参数了）
  requirementApi.exportExcel({
    brandId: filters.brandId,
    teamId: filters.teamId,
    accountName: filters.accountName,
    requirementMonth: filters.requirementMonth,
    completedMonth: filters.completedMonth,
    internalRequirementNo: filters.internalRequirementNo,
    onlyIncomplete: filters.onlyIncomplete,
    onlyMissingInvoice: filters.onlyMissingInvoice,
    onlyMissingContract: filters.onlyMissingContract,
    onlyUnsettled: filters.onlyUnsettled
  })
}
function viewContent(record) {
  contentModalText.value = record.fullRequirementContent || '（空）'
  contentModalVisible.value = true
}
function viewItems(record) {
  itemsModalRequirementId.value = record.id
  itemsModalVisible.value = true
}
function viewProgress(record) {
  progressModalRequirementId.value = record.id
  progressModalVisible.value = true
}
function openInvoiceModal(record) {
  invoiceModalRequirement.value = record
  invoiceModalVisible.value = true
}

onMounted(async () => {
  const [b, t, i, e] = await Promise.all([
    loadBrands(), loadTeams(), loadInfluencersSimple(), loadEmployees()
  ])
  brands.value      = b || []
  teams.value       = t || []
  influencers.value = i || []
  employees.value   = e || []
  loadData()
})
</script>

<style scoped>
/* "上传Invoice"按钮禁用态区分：不涉及invoice保持默认灰色，需求尚未实施完成的用橙色，
   跟应用里"待处理/进行中"惯用的橙色系保持一致（区别于纯粹"跟我无关"的灰色） */
.invoice-btn-pending:disabled,
.invoice-btn-pending.ant-btn-disabled {
  color: #fa8c16 !important;
  border-color: #ffd591 !important;
  background: #fff7e6 !important;
}

/* "去结款"按钮可点时（需求完成进度=100%）加强对比度，方便管理层在一整排操作按钮里一眼
   注意到它——跟"上传Invoice"的橙色高亮同一个"浅底色+描边+文字同色"手法，但故意用蓝色
   区分开，不跟橙色（本应用里"待处理/进行中"的惯用色）混淆语义 */
.settlement-btn-ready:not(:disabled) {
  color: #1677ff !important;
  border-color: #91caff !important;
  background: #e6f4ff !important;
}
.settlement-btn-ready:not(:disabled):hover {
  color: #4096ff !important;
  border-color: #4096ff !important;
  background: #e6f4ff !important;
}

/* 一年签一次合同且该年份还没上传的"上传合同"按钮：文案跟真正能直接上传的那种一样（表格排版
   整齐），但故意做得不起眼——这条路径实际是跳转红人管理，不是首选操作，用配色区分开，
   降低被误点的概率 */
.contract-btn-goto {
  color: #999 !important;
  border-color: #e8e8e8 !important;
  background: #fafafa !important;
}

/* "查看未完成的需求"筛选按钮：常态就用醒目的橙色描边，让人一眼注意到这里能筛选；
   激活（正在只看未完成）时切换成实心橙色背景，跟应用里"待处理/进行中"惯用的橙色系一致 */
.incomplete-filter-btn {
  color: #fa8c16;
  border-color: #fa8c16;
}
.incomplete-filter-btn:hover {
  color: #ffa940 !important;
  border-color: #ffa940 !important;
}
.incomplete-filter-btn.active {
  color: #fff;
  background: #fa8c16;
  border-color: #fa8c16;
}
.incomplete-filter-btn.active:hover {
  color: #fff !important;
  background: #ffa940 !important;
  border-color: #ffa940 !important;
}
</style>
