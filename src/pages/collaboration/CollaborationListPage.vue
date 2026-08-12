<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">2. 红人合作跟踪</span>
      <a-space>
        <a-button @click="collaborationApi.downloadTemplate()">
          <template #icon><DownloadOutlined /></template>下载导入模板
        </a-button>
        <a-button @click="handleExport">
          <template #icon><ExportOutlined /></template>Excel 导出
        </a-button>
        <template v-if="authStore.canWrite">
          <a-upload :before-upload="handleImport" :show-upload-list="false" accept=".xlsx,.xls">
            <a-button><template #icon><UploadOutlined /></template>Excel 导入</a-button>
          </a-upload>
          <a-button @click="router.push('/import-batches')" style="color:#fa8c16;border-color:#fa8c16">
            <template #icon><HistoryOutlined /></template>导入历史
          </a-button>
          <a-button type="primary" @click="batchCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>新建跟踪
          </a-button>
        </template>
      </a-space>
    </div>
    <div v-if="authStore.canWrite || authStore.isAdmin || authStore.canRecomputeOwnExecutorCosts" style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <a-space>
        <a-button v-if="authStore.canWrite" @click="legacyLinkModalVisible = true">
          <template #icon><LinkOutlined /></template>存量记录关联需求
        </a-button>
        <a-popconfirm v-if="authStore.canRecomputeOwnExecutorCosts"
          title="按费率梯度重新计算执行成本？项目负责人只会计算自己名下的记录，执行人员只会计算自己执行的记录，管理层会计算全部——已确认工资的月份不会被覆盖。"
          @confirm="handleRecomputeExecutorCosts">
          <a-button :loading="recomputingExecutorCost">批量计算执行成本</a-button>
        </a-popconfirm>
        <a-popconfirm v-if="authStore.isAdmin"
          title="重新计算所有记录的项目毛利/可分配利润/提成/公司利润？用于数据库里的原始金额被绕过系统直接改动后的善后，正常使用不需要点这个。"
          @confirm="handleRecomputeProfits">
          <a-button :loading="recomputing">重新计算利润</a-button>
        </a-popconfirm>
      </a-space>
    </div>

    <!-- 筛选条件 -->
    <div class="filter-bar">
      <a-select v-model:value="filters.brandId" placeholder="品牌方"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.teamId" placeholder="红人团队"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="t in teams" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="filters.countryMarket" placeholder="服务国家/市场"
        style="width:150px" allow-clear show-search
        :filter-option="(input, opt) => opt.value.includes(input)"
        @change="loadData">
        <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-input v-model:value="filters.accountName" placeholder="红人社媒完整名字" style="width:160px"
        allow-clear @press-enter="loadData" />
      <a-select v-model:value="filters.platform" placeholder="合作平台"
        style="width:120px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-tooltip :title="filters.progress ? getLabel('collab_progress', filters.progress) : ''">
        <a-select v-model:value="filters.progress" placeholder="视频项目进度"
          style="width:140px" allow-clear @change="loadData">
          <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </a-tooltip>
      <a-tooltip :title="filters.influencerPaymentProgress ? getLabel('influencer_payment_progress', filters.influencerPaymentProgress) : ''">
        <a-select v-model:value="filters.influencerPaymentProgress" placeholder="红人结款进度"
          style="width:160px" allow-clear @change="loadData">
          <a-select-option v-for="o in getOptions('influencer_payment_progress')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </a-tooltip>
      <a-select v-model:value="filters.videoType" placeholder="项目视频类型"
        style="width:140px" allow-clear @change="loadData">
        <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
      </a-select>
      <a-date-picker v-model:value="filters.videoMonthVal" picker="month"
        format="YYYYMM" value-format="YYYYMM" placeholder="视频发布月份" style="width:140px"
        @change="onVideoMonthChange" />
      <a-range-picker v-model:value="filters.videoDateRange" value-format="YYYY-MM-DD"
        :placeholder="['视频发布开始日期', '视频发布结束日期']" style="width:240px"
        @change="onVideoDateRangeChange" />
      <a-input v-model:value="filters.clientOrderId" placeholder="客户方的项目订单" style="width:150px"
        allow-clear @press-enter="loadData" />
      <a-input v-model:value="filters.internalRequirementNo" placeholder="内部需求编号" style="width:180px"
        allow-clear @press-enter="loadData" />
      <a-input v-model:value="filters.internalProjectNo" placeholder="内部项目编号" style="width:180px"
        allow-clear @press-enter="loadData" />
      <a-input v-model:value="filters.clientPaymentBatch" placeholder="客户方付款批次" style="width:150px"
        allow-clear @press-enter="loadData" />
      <a-select v-model:value="filters.projectManagerId" placeholder="项目负责人"
        style="width:130px" allow-clear show-search
        :filter-option="(input, opt) => opt.label.includes(input)"
        @change="loadData">
        <a-select-option v-for="e in projectManagerCandidates" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="loadData">查询</a-button>
      <a-button @click="resetFilters">重置</a-button>
      <a-tooltip v-if="canFilterMyResponsibility" :title="myResponsibilityTooltip">
        <a-button class="orange-filter-btn" :class="{ active: filters.onlyMyResponsibility }"
          @click="toggleMyResponsibility">
          查看由我负责的记录
        </a-button>
      </a-tooltip>
      <a-tooltip title="只看视频项目进度不是&quot;客户已结算&quot;也不是&quot;折损&quot;的记录">
        <a-button class="orange-filter-btn" :class="{ active: filters.onlyIncomplete }"
          style="margin-left:16px" @click="toggleOnlyIncomplete">
          查看未完成的记录
        </a-button>
      </a-tooltip>
      <a-tooltip title="只看&quot;视频发布链接&quot;还是空的记录，不包括&quot;折损&quot;（折损是终态，不算还没发布）">
        <a-button class="orange-filter-btn" :class="{ active: filters.onlyUnpublished }"
          style="margin-left:16px" @click="toggleOnlyUnpublished">
          查看视频未发布的记录
        </a-button>
      </a-tooltip>
    </div>

    <!-- 表格 -->
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="visibleColumns" :data-source="tableData" :loading="loading"
        :pagination="pagination" row-key="id" size="middle" :scroll="{ x: tableScrollX }"
        @change="handleTableChange">
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'brand'">
            <a-tag v-if="getBrandName(record.brandId)" :color="colorForValue(getBrandName(record.brandId))">
              {{ getBrandName(record.brandId) }}
            </a-tag>
            <span v-else>—</span>
          </template>

          <template v-if="column.key === 'platform'">
            <template v-if="record.platform">
              <a-tag v-for="p in splitMulti(record.platform)" :key="p" :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'publishLink'">
            <a v-if="record.publishLink" :href="record.publishLink" target="_blank"
              style="font-size:12px;word-break:break-all">{{ record.publishLink }}</a>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'accountName'">
            {{ getInfluencerName(record.influencerId) || '—' }}
          </template>

          <template v-if="column.key === 'team'">
            <a-tag v-if="getTeamName(record.teamId)" :color="colorForValue(getTeamName(record.teamId))">
              {{ getTeamName(record.teamId) }}
            </a-tag>
            <span v-else>—</span>
          </template>

          <template v-if="column.key === 'notes'">
            <span v-if="record.notes" style="color:#ff4d4f">{{ record.notes }}</span>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'publishDate'">
            {{ record.publishDate ? formatDate(record.publishDate) : '—' }}
          </template>

          <template v-if="column.key === 'createdAt'">
            {{ record.createdAt ? formatDateTime(record.createdAt) : '—' }}
          </template>

          <template v-if="column.key === 'progress'">
            <a-tag v-if="record.progress" :color="collabProgressColor(record.progress)">
              {{ getLabel('collab_progress', record.progress) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'influencerPaymentProgress'">
            <a-tag v-if="record.influencerPaymentProgress" :color="paymentProgressColor(record.influencerPaymentProgress)">
              {{ getLabel('influencer_payment_progress', record.influencerPaymentProgress) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'videoType'">
            <a-tag v-if="record.videoType" :color="videoTypeColor(record.videoType)">
              {{ getLabel('video_type', record.videoType) }}
            </a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>

          <template v-if="column.key === 'projectManager'">
            {{ getEmployeeName(record.projectManagerId) || '—' }}
          </template>

          <template v-if="column.key === 'executor'">
            {{ getEmployeeName(record.executorId) || '—' }}
          </template>

          <template v-if="column.key === 'influencerCost'">
            {{ record.influencerCost != null ? fmtNum(record.influencerCost) : '—' }}
          </template>
          <template v-if="column.key === 'clientPrice'">
            {{ record.clientPrice != null ? fmtNum(record.clientPrice) : '—' }}
          </template>

          <template v-if="column.key === 'action'">
            <a-space v-if="authStore.canWrite">
              <a @click="openEdit(record)">编辑</a>
              <a-divider type="vertical" />
              <a @click="openStatusModal(record)">状态流转</a>
              <span v-if="record.hasPendingRollbackRequest" style="color:#faad14;font-size:12px">（倒退审核中）</span>
              <!-- 2026-08 起去掉了这里手动打开"内部执行成本"弹窗的入口——新指定/改动执行人员
                   时"编辑"表单会顺带自动按费率梯度算好成本存下，不需要再单独点一次；这个弹窗
                   本身还在，只在"视频项目进度第一次流转到已发布（未结算）"时自动弹出，用于
                   标记"不涉及执行人员"、以及非本人项目负责人重新触发核算走审核流程，
                   见 openExecutorCostModal 的调用方（need-executor-cost 事件） -->
              <a-divider type="vertical" />
              <span v-if="record.hasPendingDeleteRequest" style="color:#faad14">审核中</span>
              <a v-else style="color:#ff4d4f" @click="openDeleteReason(record)">删除</a>
            </a-space>
            <!-- 财务（SysUser角色是AUDITOR、没有普通canWrite写权限的情况很常见）虽然不能编辑/删除，
                 但仍然需要能把"已发布（未结算）"流转到"已加入客户未结算列表"/"客户已结算"这两个
                 财务专属终态。只有记录已经进入结算区间（已发布未结算及以后）时才露出这个入口——
                 还没发布的记录财务什么都不能改，露出个打开就全部禁用的弹窗没有意义，跟后端
                 updateStatus() 里"AUDITOR只能在结算区间内流转"的限制保持一致 -->
            <a-space v-else-if="authStore.canSetFinanceSettlementProgress && QUALIFYING_PROGRESS.includes(record.progress)">
              <a @click="openStatusModal(record)">状态流转</a>
            </a-space>
            <span v-else style="color:#bbb">只读</span>
          </template>

        </template>
      </a-table>
    </div>

    <CollaborationStatusModal
      v-model:visible="statusModalVisible"
      :record="statusModalRecord"
      :brands="brands"
      @saved="loadData"
      @need-executor-cost="openExecutorCostModal" />

    <CollaborationExecutorCostModal
      v-model:visible="executorCostModalVisible"
      :record="executorCostModalRecord"
      :employees="employees"
      @saved="loadData" />

    <a-modal v-model:open="deleteReasonVisible" title="删除申请" @ok="handleDeleteConfirm" :confirm-loading="deleting">
      <p style="color:#595959;font-size:13px">删除红人合作跟踪记录需要管理员审核，请填写删除原因。</p>
      <a-form layout="vertical">
        <a-form-item label="删除原因" required>
          <a-textarea v-model:value="deleteReason" :rows="3" placeholder="请说明删除原因" />
        </a-form-item>
      </a-form>
    </a-modal>

    <CollaborationFormModal
      v-model:visible="modalVisible"
      :record="editingRecord"
      :can-view-financials="authStore.canViewFinancials"
      :can-view-baseline-financials="authStore.canViewBaselineFinancials"
      :can-edit-commission="authStore.canEditCommission"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      @saved="loadData"
      @need-executor-cost="openExecutorCostModal"
    />

    <CollaborationBatchCreateModal
      v-model:visible="batchCreateModalVisible"
      :brands="brands"
      :influencers="influencers"
      :employees="employees"
      :can-view-baseline-financials="authStore.canViewBaselineFinancials"
      @saved="loadData"
    />

    <LegacyRequirementLinkModal
      v-model:visible="legacyLinkModalVisible"
      :influencers="influencers"
      @linked="loadData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined, ExportOutlined, DownloadOutlined, HistoryOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { collaborationApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'
import { useReferenceData } from '../../composables/useReferenceData'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { formatDate, formatDateTime } from '../../utils/dateFormat'
import { colorForValue } from '../../utils/tagColor'
import { paymentProgressColor, collabProgressColor, videoTypeColor } from '../../utils/enumColors'
import CollaborationFormModal from './CollaborationFormModal.vue'
import CollaborationStatusModal from './CollaborationStatusModal.vue'
import CollaborationExecutorCostModal from './CollaborationExecutorCostModal.vue'
import CollaborationBatchCreateModal from './CollaborationBatchCreateModal.vue'
import LegacyRequirementLinkModal from '../requirement/LegacyRequirementLinkModal.vue'

const authStore = useAuthStore()
// 跟后端 CollaborationProgress.allowsPaymentProgress() 保持一致，财务只读账号能操作
// "状态流转"的前提条件（见"操作"列的 v-else-if）
const QUALIFYING_PROGRESS = ['PUBLISHED_UNSETTLED', 'JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']
const { getOptions, getLabel } = useOptions()
const { loadBrands, loadTeams, loadInfluencersSimple, loadEmployees } = useReferenceData()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading     = ref(false)
const tableData   = ref([])
const brands      = ref([])
const teams       = ref([])
const influencers = ref([])
const employees   = ref([])
// 负责人筛选只能选"项目负责人"或"管理层"角色的员工（跟表单里的规则一致）
const projectManagerCandidates = computed(() =>
  employees.value.filter(e => e.role === '项目负责人' || e.role === '管理层'))
const modalVisible        = ref(false)
const editingRecord       = ref(null)
const batchCreateModalVisible = ref(false)
const legacyLinkModalVisible = ref(false)
const statusModalVisible  = ref(false)
const statusModalRecord   = ref(null)
const executorCostModalVisible = ref(false)
const executorCostModalRecord  = ref(null)
const deleteReasonVisible = ref(false)
const deleteReason        = ref('')
const deleteTarget        = ref(null)
const deleting            = ref(false)
const recomputing         = ref(false)
const recomputingExecutorCost = ref(false)

const route = useRoute()
const router = useRouter()

const sortState = reactive({ field: 'id', order: 'descend' })
const pagination = reactive({
  current: 1, pageSize: 20, total: 0,
  showTotal: t => `共 ${t} 条`,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100']
})
const filters = reactive({
  brandId: undefined, teamId: undefined, countryMarket: undefined,
  accountName: route.query.accountName || undefined,
  // 红人管理"合作中项目/已完结项目"下钻弹窗"查看全部"深链专用，精确按红人 id 筛选
  // （accountName 是模糊匹配，账号名互为子串的红人会串号，这个参数不受影响；不在筛选栏
  // 展示成下拉框，纯粹是深链参数，用户手动改别的筛选条件不会保留它）
  influencerId: route.query.influencerId ? Number(route.query.influencerId) : undefined,
  platform: undefined,
  progress: route.query.progress || undefined,
  influencerPaymentProgress: undefined, videoType: undefined,
  videoMonth: undefined, videoMonthVal: undefined,
  // 视频发布日期区间跟视频发布月份互斥（选一个会清空另一个），见 onVideoMonthChange/onVideoDateRangeChange
  videoDateRange: undefined,
  internalProjectNo: route.query.internalProjectNo || undefined,
  internalRequirementNo: route.query.internalRequirementNo || undefined,
  clientOrderId: undefined, clientPaymentBatch: undefined, projectManagerId: undefined,
  onlyMyResponsibility: false,
  // "查看未完成的记录"：视频项目进度不是"客户已结算"也不是"折损"（这两个是终态，不用再跟进）
  onlyIncomplete: route.query.onlyIncomplete === 'true',
  // "查看视频未发布的记录"（2026-08 新增）：视频发布链接还是空的，但不包括"折损"（终态，
  // 不算还没发布）。跟 onlyMyResponsibility/onlyIncomplete 互不影响，可以同时生效
  onlyUnpublished: false
})

const allColumns = [
  { title: '内部需求编号',  dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 200, sorter: true,
    customRender: ({ text }) => text || '—' },
  { title: '内部项目编号',  dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 200, sorter: true },
  { title: '品牌方',        key: 'brand',          width: 120 },
  { title: '红人团队',      key: 'team',            width: 160 },
  { title: '服务国家/市场', dataIndex: 'countryMarket', key: 'countryMarket', width: 120, sorter: true },
  { title: '红人社媒完整名字', key: 'accountName', width: 160, sorter: true },
  { title: '合作平台',      key: 'platform',       width: 120 },
  { title: '需求内容',      dataIndex: 'demandContent', key: 'demandContent', width: 160, ellipsis: true },
  { title: '视频发布链接',  key: 'publishLink',    width: 220 },
  { title: '视频发布时间',  key: 'publishDate',    width: 110, sorter: true },
  { title: '创建时间',      key: 'createdAt',      width: 150, sorter: true },
  // 宽度按各自最长的标签留够空间（tag 组件内部不换行，太窄会被裁切显示不全）：
  // 视频项目进度最长"已加入客户未结算列表"，红人结款进度最长"已纳入红人结款批次（缺少invoice）"
  { title: '视频项目进度',  key: 'progress',       width: 180, sorter: true },
  { title: '红人结款进度',  key: 'influencerPaymentProgress', width: 260 },
  { title: '项目视频类型',  key: 'videoType',      width: 120, sorter: true },
  { title: '采买旧视频的原链接', dataIndex: 'oldMaterialSourceLink', key: 'oldMaterialSourceLink', width: 200, ellipsis: true },
  { title: '项目负责人',    key: 'projectManager', width: 100 },
  { title: '内部执行人员（可选）',  key: 'executor',        width: 100 },
  { title: '备注',          dataIndex: 'notes',     key: 'notes',      width: 160, ellipsis: true },
  { title: '客户方的项目订单', dataIndex: 'clientOrderId', key: 'clientOrderId', width: 150, sorter: true },
  { title: '客户方付款批次',   dataIndex: 'clientPaymentBatch', key: 'clientPaymentBatch', width: 150, sorter: true },
  // 这两个字段是"基础财务字段"，GUEST 之外所有角色都能看，不受 canViewFinancials（仅 ADMIN/AUDITOR）限制
  { title: '红人视频制作与发布成本（$）', key: 'influencerCost', width: 180, baseline: true, sorter: true },
  { title: '客户合作价格（$）',           key: 'clientPrice',    width: 140, baseline: true, sorter: true },
  // 以下列 2026-07 从"项目订单"模块迁移过来。内部执行成本不标 sensitive/costBookkeeping
  // （按行脱敏：项目负责人/执行人员只能看到自己相关的行，其余显示"—"，由后端按行返回决定，
  // 不是角色整体限制，所以不能靠前端整列隐藏，拿到什么就显示什么，跟原项目订单列表一致）。
  // 汇率/其他外部成本/外部成本备注 2026-07 收紧成仅管理层/财务可见（costBookkeeping 整列
  // 隐藏，标准跟后端 ProjectFieldVisibility 的 FULL 层级判定一致），不再是按行脱敏
  // 这些字段这次都补上了 sorter：以前在"项目订单"模块里是字符串字段没法数值排序，
  // 迁移到红人合作跟踪后改成了真正的 BigDecimal 类型，后端 Sort.by(属性名) 直接就能排
  { title: '汇率', dataIndex: 'exchangeRate', key: 'exchangeRate', width: 80, costBookkeeping: true, sorter: true,
    customRender: ({ text }) => text || '—' },
  { title: '其他外部成本（人民币）', dataIndex: 'otherExternalCost', key: 'otherExternalCost', width: 160, costBookkeeping: true, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '外部成本备注', dataIndex: 'otherExternalCostNote', key: 'otherExternalCostNote', width: 180, ellipsis: true, costBookkeeping: true,
    customRender: ({ text }) => text || '—' },
  { title: '内部执行成本（人民币）', dataIndex: 'internalExecutionCost', key: 'internalExecutionCost', width: 160, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '项目毛利',        dataIndex: 'grossProfit', key: 'grossProfit', width: 120, sensitive: true, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '可分配利润',      dataIndex: 'distributableProfit', key: 'distributableProfit', width: 120, sensitive: true, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '提成比例',        dataIndex: 'commissionRate', key: 'commissionRate', width: 90, sensitive: true, sorter: true,
    customRender: ({ text }) => text ? (parseFloat(text) * 100).toFixed(0) + '%' : '—' },
  { title: '负责人提成',      dataIndex: 'commissionAmount', key: 'commissionAmount', width: 120, sensitive: true, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '公司利润（美金）', dataIndex: 'companyNetProfit', key: 'companyNetProfit', width: 140, sensitive: true, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '公司利润（人民币）', dataIndex: 'rmbRevenue', key: 'rmbRevenue', width: 140, sensitive: true, sorter: true,
    customRender: ({ text }) => text != null ? fmtNum(text) : '—' },
  { title: '操作', key: 'action', width: 260, fixed: 'right' }
]

function fmtNum(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const visibleColumns = computed(() =>
  allColumns.filter(col => {
    if (col.baseline) return authStore.canViewBaselineFinancials
    if (col.costBookkeeping) return authStore.canViewCostBookkeeping
    return !col.sensitive || authStore.canViewFinancials
  }))
const tableScrollX = computed(() =>
  visibleColumns.value.reduce((sum, c) => sum + (c.width || 120), 0))

function getBrandName(brandId) {
  if (!brandId) return ''
  const b = brands.value.find(b => b.id === brandId)
  return b ? b.name : ''
}
function getEmployeeName(employeeId) {
  if (!employeeId) return ''
  const e = employees.value.find(e => e.id === employeeId)
  return e ? e.name : ''
}
function getInfluencerName(influencerId) {
  if (!influencerId) return ''
  const inf = influencers.value.find(i => i.id === influencerId)
  return inf ? inf.accountName : ''
}
function getTeamName(teamId) {
  if (!teamId) return ''
  const t = teams.value.find(t => t.id === teamId)
  return t ? t.name : ''
}
// 视频发布月份/视频发布日期区间互斥：选了一个就清空另一个，避免同时生效时用户设了矛盾的
// 区间反而筛出0条、自己却搞不清楚是为什么（跟数据看板那边的月份/日期互斥是同一个思路）
function onVideoMonthChange(v) {
  filters.videoMonth = v
  if (v) filters.videoDateRange = undefined
  loadData()
}
function onVideoDateRangeChange(v) {
  if (v && v.length === 2) {
    filters.videoMonth = undefined
    filters.videoMonthVal = undefined
  }
  loadData()
}
function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
async function loadData() {
  loading.value = true
  try {
    const res = await collaborationApi.list({
      brandId:            filters.brandId,
      teamId:             filters.teamId      || undefined,
      countryMarket:      filters.countryMarket,
      accountName:        filters.accountName?.trim() || undefined,
      influencerId:       filters.influencerId,
      platform:           filters.platform,
      progress:           filters.progress,
      influencerPaymentProgress: filters.influencerPaymentProgress,
      videoType:          filters.videoType,
      videoMonth:         filters.videoMonth,
      videoDateStart:     filters.videoDateRange?.[0],
      videoDateEnd:       filters.videoDateRange?.[1],
      internalProjectNo:  filters.internalProjectNo?.trim() || undefined,
      internalRequirementNo: filters.internalRequirementNo?.trim() || undefined,
      clientOrderId:      filters.clientOrderId?.trim() || undefined,
      clientPaymentBatch: filters.clientPaymentBatch?.trim() || undefined,
      projectManagerId:   filters.projectManagerId,
      onlyMyResponsibility: filters.onlyMyResponsibility,
      onlyIncomplete:     filters.onlyIncomplete,
      onlyUnpublished:    filters.onlyUnpublished,
      sortBy:  sortState.field,
      sortDir: sortState.order === 'descend' ? 'desc' : 'asc',
      page: pagination.current - 1,
      size: pagination.pageSize
    })
    tableData.value  = res.data.content || []
    pagination.total = res.data.totalElements || 0
  } finally {
    loading.value = false
    remeasure()
  }
}

function handleTableChange(pag, _f, sorter) {
  pagination.current  = pag.current
  pagination.pageSize = pag.pageSize
  if (sorter && sorter.field) {
    sortState.field = sorter.field
    sortState.order = sorter.order || 'descend'
  }
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    brandId:undefined, teamId:undefined, countryMarket:undefined,
    accountName:undefined, influencerId:undefined, platform:undefined, progress:undefined, influencerPaymentProgress:undefined, videoType:undefined,
    videoMonth:undefined, videoMonthVal:undefined, videoDateRange:undefined, internalProjectNo:undefined,
    internalRequirementNo:undefined,
    clientOrderId:undefined, clientPaymentBatch:undefined, projectManagerId:undefined,
    onlyMyResponsibility: false, onlyIncomplete: false, onlyUnpublished: false
  })
  pagination.current = 1
  sortState.field = 'id'; sortState.order = 'descend'
  loadData()
}

function toggleOnlyIncomplete() {
  filters.onlyIncomplete = !filters.onlyIncomplete
  pagination.current = 1
  loadData()
}

function toggleOnlyUnpublished() {
  filters.onlyUnpublished = !filters.onlyUnpublished
  pagination.current = 1
  loadData()
}

// "查看由我负责的记录"：项目负责人/执行人员/财务专属，其余角色点了也没有对应的后端筛选
// 条件生效（后端会返回空列表），所以直接不展示这个按钮，避免造成困惑。
// 管理层是一个特殊的项目负责人（部分红人合作跟踪记录的项目负责人直接是管理层本人，负责人
// 下拉本来就允许选"管理层"角色），跟"项目负责人"享受同样的筛选/排序逻辑（见后端
// CollaborationTrackingController.resolvePriorityEmployeeId）
const canFilterMyResponsibility = computed(() =>
  ['项目负责人', '执行人员', '管理层', '财务'].includes(authStore.employeeRole))
const myResponsibilityTooltip = computed(() => {
  if (['项目负责人', '执行人员', '管理层'].includes(authStore.employeeRole)) {
    return '只看自己作为项目负责人/执行人员的记录，再按是否还需要跟进（未到"客户已结算"/"折损"）优先排序'
  }
  return '只看需要处理的记录（视频项目进度为"已发布（未结算）"/"已加入客户未结算列表"）'
})
function toggleMyResponsibility() {
  filters.onlyMyResponsibility = !filters.onlyMyResponsibility
  pagination.current = 1
  loadData()
}

function openEdit(r)  { editingRecord.value = r;    modalVisible.value = true }
function openStatusModal(r) {
  statusModalRecord.value = {
    ...r,
    accountName: getInfluencerName(r.influencerId),
    executorName: getEmployeeName(r.executorId)
  }
  statusModalVisible.value = true
}
function openExecutorCostModal(r) {
  executorCostModalRecord.value = {
    ...r,
    accountName: getInfluencerName(r.influencerId),
    executorName: getEmployeeName(r.executorId)
  }
  executorCostModalVisible.value = true
}
function openDeleteReason(r) { deleteTarget.value = r; deleteReason.value = ''; deleteReasonVisible.value = true }
async function handleDeleteConfirm() {
  if (!deleteReason.value?.trim()) { message.warning('请填写删除原因'); return }
  deleting.value = true
  try {
    await collaborationApi.requestDelete(deleteTarget.value.id, deleteReason.value.trim())
    message.success('已提交删除申请，等待管理员审核')
    deleteReasonVisible.value = false
    loadData()
  } finally { deleting.value = false }
}
function handleExport() {
  // filters.videoDateRange 是个数组，后端认的是 videoDateStart/videoDateEnd 两个独立参数，
  // 不能直接把整个 filters 对象透传（exportExcel 内部会把 videoDateRange 数组 toString 成
  // 逗号拼接的字符串，后端不认识这个参数名，日期区间筛选就不会生效）
  collaborationApi.exportExcel({
    ...filters,
    videoDateStart: filters.videoDateRange?.[0],
    videoDateEnd: filters.videoDateRange?.[1]
  })
}

async function handleRecomputeProfits() {
  recomputing.value = true
  try {
    const res = await collaborationApi.recomputeProfits()
    // 2026-08 起这段结果摘要连带内部执行成本的重算情况，可能有好几行（含跳过了哪些费率
    // 梯度组合），用 Modal 展示、保留换行，不能再用一闪而过的 message toast 挤成一行
    Modal.info({
      title: '重新计算利润完成',
      width: 560,
      content: h('div', { style: 'white-space:pre-line;line-height:1.7' }, res.data || '重新计算完成')
    })
    loadData()
  } finally { recomputing.value = false }
}

async function handleRecomputeExecutorCosts() {
  recomputingExecutorCost.value = true
  try {
    const res = await collaborationApi.recomputeExecutorCosts()
    // 结果摘要可能有好几行（跳过了哪些费率梯度组合、汇率异常提示等），用 Modal 展示、保留换行，
    // 跟"重新计算利润"的展示方式保持一致
    Modal.info({
      title: '批量计算执行成本完成',
      width: 560,
      content: h('div', { style: 'white-space:pre-line;line-height:1.7' }, res.data || '计算完成')
    })
    loadData()
  } finally { recomputingExecutorCost.value = false }
}
async function handleImport(file) {
  const fd = new FormData(); fd.append('file', file)
  try {
    await collaborationApi.importExcel(fd)
    message.success('文件已上传，正在后台导入中，可以去"导入历史"查看进度和结果')
  } catch {}
  return false
}

onMounted(async () => {
  const [b, t, inf, emp] = await Promise.all([
    loadBrands(), loadTeams(), loadInfluencersSimple(), loadEmployees()
  ])
  brands.value      = b || []
  teams.value       = t || []
  influencers.value = inf || []
  employees.value   = emp || []
  loadData()
})
</script>

<style scoped>
/* "查看由我负责的记录"/"查看未完成的记录"这类筛选按钮共用：常态用醒目的橙色描边，
   激活时切换成实心橙色背景，跟"红人需求管理"的"查看未完成的需求"按钮保持一致的配色风格 */
.orange-filter-btn {
  color: #fa8c16;
  border-color: #fa8c16;
}
.orange-filter-btn:hover {
  color: #ffa940 !important;
  border-color: #ffa940 !important;
}
.orange-filter-btn.active {
  color: #fff;
  background: #fa8c16;
  border-color: #fa8c16;
}
.orange-filter-btn.active:hover {
  color: #fff !important;
  background: #ffa940 !important;
  border-color: #ffa940 !important;
}
</style>
