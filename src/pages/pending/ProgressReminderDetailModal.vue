<template>
  <a-modal :open="visible" width="1200px" :footer="null"
    @cancel="close" :destroy-on-close="true">
    <template #title>
      <a-tag :color="categoryTagColor(category)">{{ categoryLabel(category) }}</a-tag>
      <a-tag v-if="hasUrgencyInfo" :color="urgencyColor(titleReminder)">{{ urgencyLabel(titleReminder) }}</a-tag>
      <span style="margin-left:4px">详情</span>
    </template>
    <div class="filter-bar">
      <a-select v-model:value="brandTeamFilter" placeholder="品牌方-红人团队" allow-clear
        style="width:240px" :options="brandTeamOptions" />
      <!-- 合同即将到期：2026-08 起按(品牌方,团队)整体展示，明细行不再对应具体红人，
           这个筛选框对这一类没有意义，隐藏掉 -->
      <a-select v-if="category !== 'CONTRACT_EXPIRING_SOON'" v-model:value="accountNameFilter"
        placeholder="红人社媒完整名字" allow-clear show-search
        style="width:200px" :options="accountNameOptions" />
      <a-select v-if="category === 'COLLAB_PAYMENT_DUE'" v-model:value="paymentProgressFilter"
        placeholder="红人结款进度" allow-clear style="width:200px" :options="paymentProgressOptions" />
    </div>
    <div class="table-card" ref="tableWrapperRef">
      <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
        <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
      </div>
      <a-table :columns="columns" :data-source="filteredList" :loading="loading"
        row-key="id" size="middle" :pagination="tablePagination" :scroll="{ x: scrollX }"
        :row-class-name="rowClassName">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'brandName'">
            <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'teamName'">
            <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'progressLabel'">
            <a-tag v-if="record.progressLabel" :color="colorForValue(record.progressLabel)">{{ record.progressLabel }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'paymentProgressLabel'">
            <a-tag v-if="record.paymentProgressLabel" :color="colorForValue(record.paymentProgressLabel)">{{ record.paymentProgressLabel }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <!-- 2026-08-21 新增：COLLAB_PAYMENT_DUE 这一类，红人名字旁边标红提示"配置了特殊回款
               周期"（record.specialPaymentCycle，后端 addCollabPaymentDueDetail() 写入），方便
               管理层一眼看出这条是不是走的最高优先级的红人个人配置，而不是品牌方/团队规则 -->
          <template v-if="column.key === 'accountName' && category === 'COLLAB_PAYMENT_DUE'">
            {{ record.accountName }}
            <span v-if="record.specialPaymentCycle" style="color:#c00000;margin-left:4px">（配置了特殊回款周期）</span>
          </template>
          <!-- 同上：这一类的"结款周期"如果是走特殊回款周期算出来的，数值本身标红，跟上面的
               名字标注呼应，方便核对是不是同一批需要特别注意的记录 -->
          <template v-if="column.key === 'cycleDays' && category === 'COLLAB_PAYMENT_DUE'">
            <span :style="record.specialPaymentCycle ? 'color:#c00000;font-weight:600' : ''">
              {{ record.cycleDays != null ? record.cycleDays + '天' : '—' }}
            </span>
          </template>
          <template v-if="column.key === 'videoTypeLabel'">
            <a-tag v-if="record.videoTypeLabel" :color="colorForValue(record.videoTypeLabel)">{{ record.videoTypeLabel }}</a-tag>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'platform'">
            <template v-if="record.platform">
              <a-tag v-for="p in record.platform.split('\n').filter(Boolean)" :key="p"
                :color="colorForValue(p)" style="margin:2px">{{ p }}</a-tag>
            </template>
            <span v-else style="color:#bbb">—</span>
          </template>
          <!-- 跟"红人结款"列表页同款交互：不直接铺开一长串项目编号，点链接弹只读弹窗看明细 -->
          <template v-if="column.key === 'viewInvolvedProjects'">
            <a @click="openItemsView(record)">查看涉及的红人视频项目</a>
          </template>
          <!-- 内部需求编号是标识符，不是分类字段，这个表格里其它地方的单值列也是纯文本展示，
               不是彩色标签——这里延续同样的展示方式，只是多值换行列出；用深色文字保证可读 -->
          <template v-if="column.key === 'involvedRequirementNos'">
            <div v-if="record.involvedRequirementNos" style="white-space:pre-line;color:#262626">{{ record.involvedRequirementNos }}</div>
            <span v-else style="color:#bbb">—</span>
          </template>
          <template v-if="column.key === 'action'">
            <a @click="goToDetail(record)">查看详情</a>
            <template v-if="canAcknowledge">
              <a-divider type="vertical" />
              <template v-if="record.acknowledged">
                <span style="color:#8c8c8c">已标记为已处理</span>
                <a-divider type="vertical" />
                <a-popconfirm title="取消标记？取消后这条会恢复正常提醒"
                  @confirm="handleUnacknowledge(record)">
                  <a>取消标记</a>
                </a-popconfirm>
              </template>
              <template v-else>
                <a-popconfirm title="标记为已处理？下次批次前不会再提醒这条（进度有变化时会自动恢复提醒）"
                  @confirm="handleAcknowledge(record)">
                  <a style="color:#52c41a">标记已处理</a>
                </a-popconfirm>
                <!-- "已跟管理层确认此需求不涉及合同"（2026-08-21 新增，同日改版）：只在"合同上传
                     逾期"这一类展示，效果等同"标记已处理"，见 handleConfirmContractNotApplicable()。
                     原来跟前面几个操作链接横排在一起，挤在窄列里经常被拆成两截、很难看，改成放在
                     "标记已处理"后面、用 <br> 另起一行；display:inline-block + white-space:nowrap
                     保证这12个字的文案本身不会再被换行拆断（配合上面"操作"列加宽到210，正常
                     宽度下一行就能放下，实在放不下时靠这个弹窗表格已有的横向滚动条，不会挤压
                     换行） -->
                <template v-if="category === 'REQUIREMENT_CONTRACT_OVERDUE' && canManageContracts">
                  <br />
                  <a-popconfirm title="已跟管理层确认此需求不涉及合同"
                    @confirm="handleConfirmContractNotApplicable(record)">
                    <a style="color:#fa8c16;display:inline-block;white-space:nowrap;margin-top:4px">已跟管理层确认此需求不涉及合同</a>
                  </a-popconfirm>
                </template>
              </template>
            </template>
          </template>
        </template>
        <template #summary v-if="summaryCells.length">
          <a-table-summary>
            <a-table-summary-row>
              <a-table-summary-cell v-for="cell in summaryCells" :key="cell.index"
                :index="cell.index" :col-span="cell.colSpan">
                <template v-if="cell.type === 'label'">合计：{{ filteredList.length }} 笔</template>
                <template v-else-if="cell.type === 'total'">{{ fmtAmount(cell.value) }}</template>
              </a-table-summary-cell>
            </a-table-summary-row>
          </a-table-summary>
        </template>
      </a-table>
    </div>
  </a-modal>

  <!-- "查看涉及的红人视频项目"链接专用（仅 INFLUENCER_PAYMENT_DUE），复用"红人结款"列表页
       同一个只读明细弹窗，见 openItemsView() -->
  <PaymentItemSelectorModal v-model:visible="itemsViewVisible" mode="view"
    :existing-payment-id="itemsViewPaymentId" :brand-name="itemsViewBrandName" />
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PaymentItemSelectorModal from '../payment/PaymentItemSelectorModal.vue'
import { progressReminderApi, requirementApi } from '../../api/index'
import { formatDate, formatDateTime } from '../../utils/dateFormat'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import { useAuthStore } from '../../store/auth'
import { colorForValue } from '../../utils/tagColor'
import { categoryLabel, categoryTagColor, urgencyLabel, urgencyColor } from '../../utils/reminderLabels'

const router = useRouter()
const authStore = useAuthStore()

const props = defineProps({
  visible: { type: Boolean, default: false },
  reminderId: { type: [Number, String], default: null },
  // 只有这3类"进度滞留/Invoice逾期"提醒支持"标记已处理"，且只对项目负责人/执行人员/财务
  // 本人生效（跟后端 acknowledge 的受众一致）——ADMIN/管理层看到的是完整视角，标记对他们
  // 自己没有意义，所以不展示这个操作
  category: { type: String, default: null },
  // 2026-07-29 新增：卡片列表点进来时带上这条提醒的紧急程度，供弹窗标题细化成"品类+紧急程度"，
  // 不再是所有类别/档次共用一个"进度提醒详情"的笼统标题
  urgency: { type: String, default: null },
  overdueUrgency: { type: String, default: null }
})
const emit = defineEmits(['update:visible'])

// 标题用的"这条提醒"对象，跟 utils/reminderLabels.js 里 urgencyLabel/urgencyColor 期待的
// 形状（{category, urgency, overdueUrgency}）保持一致，直接复用同一份颜色/文案映射，
// 不在这里再写一份容易跟卡片列表走偏
const titleReminder = computed(() => ({
  category: props.category, urgency: props.urgency, overdueUrgency: props.overdueUrgency
}))
const hasUrgencyInfo = computed(() => props.urgency != null || props.overdueUrgency != null)

const STALL_CATEGORIES = ['PM_EXECUTOR_PROGRESS_STALL', 'FINANCE_PROGRESS_STALL']
const REQUIREMENT_CATEGORIES = ['REQUIREMENT_INVOICE_OVERDUE', 'REQUIREMENT_CONTRACT_OVERDUE']
const ACKNOWLEDGEABLE_CATEGORIES = [...STALL_CATEGORIES, ...REQUIREMENT_CATEGORIES]
const canAcknowledge = computed(() =>
  ACKNOWLEDGEABLE_CATEGORIES.includes(props.category) && !authStore.isAdmin && !authStore.isManagement)
// "已跟管理层确认此需求不涉及合同"按钮（2026-08-21 新增，仅 REQUIREMENT_CONTRACT_OVERDUE 这
// 一类有意义）的权限口径，跟 RequirementListPage.vue 的"确认该需求不涉及合同"按钮保持一致
const canManageContracts = computed(() => authStore.canWrite || authStore.canManageTeamContracts)

const loading = ref(false)
const list = ref([])
const brandTeamFilter = ref(undefined)
const accountNameFilter = ref(undefined)
const paymentProgressFilter = ref(undefined)

// "查看涉及的红人视频项目"链接专用状态（仅 INFLUENCER_PAYMENT_DUE 这一类会用到）
const itemsViewVisible = ref(false)
const itemsViewPaymentId = ref(null)
const itemsViewBrandName = ref(null)
// requirementId 这个字段 INFLUENCER_PAYMENT_DUE 复用存的正是这条结款记录自己的 id
// （见后端 ProgressReminderDetail.requirementId 注释），直接当 existingPaymentId 传给弹窗
function openItemsView(record) {
  itemsViewPaymentId.value = record.requirementId
  itemsViewBrandName.value = record.brandName
  itemsViewVisible.value = true
}
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
// 2026-07 新增：明细行之前是不分页的，一次性把某个类别/严重度下命中的全部记录都渲染出来，
// 数量一多（比如某个项目负责人手下滞留了几百笔）页面会很长、体验差。分页只影响这里的展示，
// 不影响数据完整性——后端 listDetails() 本身没有任何截断/上限，"共 X 条"和汇总合计
// （summaryCells/totalCost/totalClientPrice）都是照 filteredList 全量算的，不受当前页影响
const tablePagination = reactive({
  current: 1, pageSize: 20, showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: t => `共 ${t} 条`
})

function fmtAmount(val) {
  if (val == null) return '—'
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 品牌方-红人团队组合筛选：选项来自当前明细列表里实际出现过的组合，没有团队的记录归到"（无团队）"
function brandTeamKey(r) {
  return `${r.brandName || '—'} - ${r.teamName || '（无团队）'}`
}
const brandTeamOptions = computed(() => {
  const keys = [...new Set(list.value.map(brandTeamKey))]
  return keys.map(k => ({ value: k, label: k }))
})

// "红人社媒完整名字"筛选：下拉选项按该红人名下最早的截止时间排序（越紧急的越靠前），
// 方便优先处理最快要逾期的红人；没有截止时间的名字排在最后
const accountNameOptions = computed(() => {
  const earliestDeadline = new Map()
  for (const r of list.value) {
    if (!r.accountName || !r.deadlineDate) continue
    const cur = earliestDeadline.get(r.accountName)
    if (!cur || new Date(r.deadlineDate) < new Date(cur)) earliestDeadline.set(r.accountName, r.deadlineDate)
  }
  const names = [...new Set(list.value.map(r => r.accountName).filter(Boolean))]
  names.sort((a, b) => {
    const da = earliestDeadline.get(a)
    const db = earliestDeadline.get(b)
    if (!da && !db) return a.localeCompare(b)
    if (!da) return 1
    if (!db) return -1
    return new Date(da) - new Date(db)
  })
  return names.map(n => ({ value: n, label: n }))
})

// "红人结款进度"筛选（仅 COLLAB_PAYMENT_DUE 有意义，见后端 paymentProgressLabel 字段注释）：
// 选项来自当前明细列表里实际出现过的值，没设置的记录不出现在下拉选项里（用"—"占位不需要筛选）
const paymentProgressOptions = computed(() => {
  const labels = [...new Set(list.value.map(r => r.paymentProgressLabel).filter(Boolean))]
  return labels.map(l => ({ value: l, label: l }))
})

// 排序：未标记已处理的排在最前面，已标记已处理的排在最后（不跟未处理的交错），
// 每个分组内部再按红人社媒完整名字归组、组内按截止时间升序（越早到期的越靠前）；
// 没有截止时间的记录排在同名分组的最后。其余5个类别（进度滞留/Invoice逾期等）都用这个。
function compareRows(a, b) {
  const ackCompare = (a.acknowledged ? 1 : 0) - (b.acknowledged ? 1 : 0)
  if (ackCompare !== 0) return ackCompare
  const nameCompare = (a.accountName || '').localeCompare(b.accountName || '')
  if (nameCompare !== 0) return nameCompare
  if (!a.deadlineDate && !b.deadlineDate) return 0
  if (!a.deadlineDate) return 1
  if (!b.deadlineDate) return -1
  return new Date(a.deadlineDate) - new Date(b.deadlineDate)
}

// COLLAB_PAYMENT_DUE 专属排序（2026-08 新增）：需要invoice的品牌方，同一个内部需求编号下
// 可能有多条视频各占一行，之前用 compareRows 按红人名字归组只是巧合能让它们看起来连在一起
// （因为一个需求只关联一个红人）——如果同一个红人名下同时有两个不同需求都进了这份提醒，
// 会被最迟结款日交错拆开，不是真正按需求分组。这里改成显式按需求编号分组：先比最迟结款日
// （同一需求下所有行的最迟结款日必然相同，见后端 runCollabPaymentDue，天然会让同需求连续），
// 结款日相同时再按需求编号本身兜底排序，最后没有需求编号的记录（不需要invoice/未关联需求）
// 退回按红人名字排序。
function compareCollabPaymentDueRows(a, b) {
  const ackCompare = (a.acknowledged ? 1 : 0) - (b.acknowledged ? 1 : 0)
  if (ackCompare !== 0) return ackCompare
  if (a.deadlineDate || b.deadlineDate) {
    if (!a.deadlineDate) return 1
    if (!b.deadlineDate) return -1
    const dateCompare = new Date(a.deadlineDate) - new Date(b.deadlineDate)
    if (dateCompare !== 0) return dateCompare
  }
  const reqCompare = (a.internalRequirementNo || '').localeCompare(b.internalRequirementNo || '')
  if (reqCompare !== 0) return reqCompare
  return (a.accountName || '').localeCompare(b.accountName || '')
}

const filteredList = computed(() => {
  let result = list.value
  if (brandTeamFilter.value) result = result.filter(r => brandTeamKey(r) === brandTeamFilter.value)
  if (accountNameFilter.value) result = result.filter(r => r.accountName === accountNameFilter.value)
  if (paymentProgressFilter.value) result = result.filter(r => r.paymentProgressLabel === paymentProgressFilter.value)
  const comparator = props.category === 'COLLAB_PAYMENT_DUE' ? compareCollabPaymentDueRows : compareRows
  return [...result].sort(comparator)
})

// 汇总合计的金额列：老类目/进度滞留两类是"红人视频制作与发布成本"，Invoice逾期是"总成本"——
// 字段名一样（influencerCost），语义按类别不同，这里统一按这个字段求和即可。
// "客户合作价格（$）"是单独一列的合计，两个金额不相加，各自在自己的列下面显示
const totalCost = computed(() =>
  filteredList.value.reduce((sum, r) => sum + (r.influencerCost != null ? +r.influencerCost : 0), 0))
const totalClientPrice = computed(() =>
  filteredList.value.reduce((sum, r) => sum + (r.clientPrice != null ? +r.clientPrice : 0), 0))

// 老类目（COLLAB_PAYMENT_DUE）列定义。2026-08 新增"内部需求编号"（放最前，需要invoice的
// 品牌方才会有值，宽度按这类编号"品牌-团队-月份-账号-序号"的实际长度留够，参考
// PaymentItemSelectorModal.vue 那次因为列宽不够导致错位重叠的教训）+ "需求完成时间"
// （放在"视频发布时间"右边，需要invoice的品牌方"最迟结款日"是从这个时间起算的，不是从
// 视频发布时间起算，两列并排方便核对）
const PAYMENT_DUE_COLUMNS = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 210,
    customRender: ({ text }) => text || '—' },
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  // accountName/cycleDays 这两列改成 bodyCell 模板渲染（去掉 customRender），因为要根据
  // record.specialPaymentCycle（2026-08-21 新增，见后端 ProgressReminderDetail 同名字段注释）
  // 决定要不要标红——只在这个类别（COLLAB_PAYMENT_DUE）用到，见下方模板里 category 判断
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 220 },
  { title: '需求内容',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '红人视频制作与发布成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 180,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '视频项目进度',  key: 'progressLabel',       width: 140 },
  { title: '红人结款进度',  key: 'paymentProgressLabel',      width: 160 },
  { title: '视频发布时间',  dataIndex: 'publishDate',         key: 'publishDate',         width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '需求完成时间',  dataIndex: 'requirementCompletedAt', key: 'requirementCompletedAt', width: 150,
    customRender: ({ text }) => text ? formatDateTime(text) : '—' },
  { title: '结款周期',      dataIndex: 'cycleDays',           key: 'cycleDays',           width: 90 },
  { title: '最迟结款日',    dataIndex: 'deadlineDate',        key: 'deadlineDate',        width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// 进度滞留（项目负责人/财务视角）：只保留红人合作跟踪本身相关的字段，去掉"结款周期"/
// "最迟结款日"/"视频发布时间"这些跟结款相关、对滞留提醒没有意义的字段；字段顺序尽量
// 跟"红人合作跟踪"列表页保持一致
const STALL_COLUMNS = [
  { title: '内部项目编号', dataIndex: 'internalProjectNo', key: 'internalProjectNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '合作平台',      key: 'platform',                  width: 130 },
  { title: '需求内容',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160, ellipsis: true,
    customRender: ({ text }) => text || '—' },
  { title: '视频项目进度',  key: 'progressLabel',       width: 140 },
  { title: '项目视频类型',  key: 'videoTypeLabel',      width: 120 },
  { title: '红人视频制作与发布成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 180,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '客户合作价格（$）', dataIndex: 'clientPrice',     key: 'clientPrice',         width: 140,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '内部执行人员（可选）', dataIndex: 'executorName', key: 'executorName',        width: 110,
    customRender: ({ text }) => text || '—' },
  { title: '提醒阈值（工作日）', dataIndex: 'cycleDays',      key: 'cycleDays',            width: 130,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// Invoice逾期：这一类是按"需求"整体展示的，不是单条视频，展示需求维度的汇总字段
const INVOICE_OVERDUE_COLUMNS = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 200,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '需求条目总数',  dataIndex: 'cycleDays',           key: 'cycleDays',           width: 110,
    customRender: ({ text }) => text != null ? text : '—' },
  { title: '客户合作总价格（$）', dataIndex: 'clientPrice',   key: 'clientPrice',         width: 160,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '红人视频制作与发布总成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 200,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  // 这一类的阈值可以在"进度提醒阈值维护"里改，不是固定值——thresholdDays 是跑批当时实际用的值
  // 的快照（cycleDays 这个字段这一类复用成"需求条目总数"了，不能兼职存阈值，2026-07-29 起
  // 改用专门的 thresholdDays 字段，不再是前端硬编码的"5天"）
  { title: '提醒阈值（工作日）', dataIndex: 'thresholdDays', key: 'thresholdDays', width: 130,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// 合同上传逾期：结构完全照抄 Invoice逾期（都是按"需求"整体展示），阈值可在"进度提醒阈值
// 维护"里改，只针对品牌方"每次需求签一次合同"的场景（一年签一次合同的品牌方不生成这类提醒）
const CONTRACT_OVERDUE_COLUMNS = [
  { title: '内部需求编号', dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 200,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  { title: '红人社媒完整名字', dataIndex: 'accountName',      key: 'accountName',        width: 150 },
  { title: '需求条目总数',  dataIndex: 'cycleDays',           key: 'cycleDays',           width: 110,
    customRender: ({ text }) => text != null ? text : '—' },
  { title: '客户合作总价格（$）', dataIndex: 'clientPrice',   key: 'clientPrice',         width: 160,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '红人视频制作与发布总成本（$）', dataIndex: 'influencerCost', key: 'influencerCost', width: 200,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '提醒阈值（工作日）', dataIndex: 'thresholdDays', key: 'thresholdDays', width: 130,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  // 这一类"操作"列比其它类别宽（170 -> 210）：多了"已跟管理层确认此需求不涉及合同"这个按钮，
  // 单独另起一行展示，文字本身就有12个字，170 装不下会被拆成两行，见下面模板里的说明
  { title: '操作',          key: 'action',                    width: 210 }
]

// 合同即将到期：按 (品牌方,团队) 这个组合整体展示（2026-08 起团队下所有红人共用同一份合同，
// 不再按红人展示），阈值可在"进度提醒阈值维护"里改（EXPIRY_WINDOW_DAYS，跑批当时的实际值
// 直接存在 cycleDays 里），只针对"一年签一次合同"的场景
const CONTRACT_EXPIRING_COLUMNS = [
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  { title: '到期时间判断依据', dataIndex: 'demandContent',    key: 'demandContent',       width: 200,
    customRender: ({ text }) => text || '—' },
  { title: '当前合同到期时间', dataIndex: 'deadlineDate',      key: 'deadlineDate',        width: 130,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '提醒阈值', dataIndex: 'cycleDays', key: 'contractExpiryThreshold', width: 100,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '超出/剩余天数', dataIndex: 'overdueDays',        key: 'overdueDays',         width: 110,
    customRender: ({ text }) => text != null ? (text > 0 ? '已超期' + text + '天' : '未超期') : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// 红人结款临近付款日：按"结款记录"整体展示（一条结款可能跨多条红人合作跟踪记录），
// 字段复用见后端 ProgressReminderDetail 各字段注释里 INFLUENCER_PAYMENT_DUE 的说明。
// 2026-08-17 新增"查看涉及的红人视频项目"/"涉及的内部需求编号"两列（放在"结算月份"后面）：
//   - "查看涉及的红人视频项目"：跟"红人结款"列表页（PaymentListPage.vue）同款交互——列表里
//     不直接铺开一长串项目编号（可能很长），改成一个链接，点开 PaymentItemSelectorModal（view
//     模式，只读）弹窗展示明细。requirementId 这个字段这一类复用存的正是这条结款记录自己的
//     id（见后端注释），拿来当 existingPaymentId 传给弹窗即可，不需要额外查询。后端算好的
//     involvedProjectNos 字符串字段目前这一列用不上了（弹窗自己会查一遍明细），暂时留着不删——
//     万一以后要在别处（比如导出）用到不用再改后端。
//   - "涉及的内部需求编号"：内部需求编号是标识符不是分类字段，这个表格里其它地方的单值版本
//     也是纯文本展示，不用彩色标签，这里延续同样的风格，换行分隔的多值字符串一行一个列出。
//     宽度按"品牌-团队-月份-账号-序号"这类编号的实际长度（30-40字符左右）留够放下完整一条
//     不换行，不设行数/高度上限——结款记录关联的视频数一般是个位数到十几条，没必要为极端
//     情况牺牲正常情况下的可读性
const INFLUENCER_PAYMENT_DUE_COLUMNS = [
  { title: '结款单号',      dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  { title: '结算月份',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160,
    customRender: ({ text }) => text || '—' },
  { title: '查看涉及的红人视频项目', key: 'viewInvolvedProjects', width: 180 },
  { title: '涉及的内部需求编号', key: 'involvedRequirementNos', width: 260 },
  { title: '合作数量',      dataIndex: 'cycleDays',           key: 'cycleDays',           width: 90,
    customRender: ({ text }) => text != null ? text : '—' },
  { title: '应付金额（$）', dataIndex: 'influencerCost',      key: 'influencerCost',      width: 150,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '对账日期',      dataIndex: 'publishDate',         key: 'publishDate',         width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '预计付款日',    dataIndex: 'deadlineDate',        key: 'deadlineDate',        width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '付款状态',      key: 'progressLabel',       width: 100 },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

// 红人结款上传发票逾期（2026-08 新增）：按"结款记录"整体展示，字段复用见后端
// ProgressReminderDetail 各字段注释里 INFLUENCER_PAYMENT_RECEIPT_OVERDUE 的说明——
// 跟 INFLUENCER_PAYMENT_DUE_COLUMNS 共用同一批字段来源，但计时方向相反（超出阈值天数，
// 不是距离到期还剩天数），所以额外带上"提醒阈值"/"超出天数"，跟 CONTRACT_OVERDUE_COLUMNS 一致
const INFLUENCER_PAYMENT_RECEIPT_OVERDUE_COLUMNS = [
  { title: '结款单号',      dataIndex: 'internalRequirementNo', key: 'internalRequirementNo', width: 190,
    customRender: ({ text }) => text || '—' },
  { title: '品牌方',        dataIndex: 'brandName',          key: 'brandName',          width: 120 },
  { title: '红人团队',      key: 'teamName',            width: 160 },
  { title: '结算月份',      dataIndex: 'demandContent',       key: 'demandContent',       width: 160,
    customRender: ({ text }) => text || '—' },
  { title: '合作数量',      dataIndex: 'cycleDays',           key: 'cycleDays',           width: 90,
    customRender: ({ text }) => text != null ? text : '—' },
  { title: '应付金额（$）', dataIndex: 'influencerCost',      key: 'influencerCost',      width: 150,
    customRender: ({ text }) => text != null ? fmtAmount(text) : '—' },
  { title: '实际付款日',    dataIndex: 'publishDate',         key: 'publishDate',         width: 110,
    customRender: ({ text }) => text ? formatDate(text) : '—' },
  { title: '付款状态',      key: 'progressLabel',       width: 100 },
  { title: '提醒阈值（工作日）', dataIndex: 'thresholdDays', key: 'thresholdDays', width: 130,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '超出天数',      dataIndex: 'overdueDays',         key: 'overdueDays',         width: 90,
    customRender: ({ text }) => text != null ? text + '天' : '—' },
  { title: '操作',          key: 'action',                    width: 170 }
]

const columns = computed(() => {
  if (STALL_CATEGORIES.includes(props.category)) return STALL_COLUMNS
  if (props.category === 'REQUIREMENT_INVOICE_OVERDUE') return INVOICE_OVERDUE_COLUMNS
  if (props.category === 'REQUIREMENT_CONTRACT_OVERDUE') return CONTRACT_OVERDUE_COLUMNS
  if (props.category === 'CONTRACT_EXPIRING_SOON') return CONTRACT_EXPIRING_COLUMNS
  if (props.category === 'INFLUENCER_PAYMENT_RECEIPT_OVERDUE') return INFLUENCER_PAYMENT_RECEIPT_OVERDUE_COLUMNS
  if (props.category === 'INFLUENCER_PAYMENT_DUE') return INFLUENCER_PAYMENT_DUE_COLUMNS
  return PAYMENT_DUE_COLUMNS
})
const scrollX = computed(() => columns.value.reduce((sum, c) => sum + (c.width || 120), 0))

// 汇总行要展示合计的列：目前是"红人视频制作与发布成本（$）"和"客户合作价格（$）"，两列各自
// 独立求和（不相加）。按列在当前 columns 里的实际位置排序，中间/前后空隙用空白单元格补齐，
// 这样不管哪个类别的列顺序如何（进度滞留是成本在前价格在后，Invoice逾期反过来），都能对齐
const summaryCells = computed(() => {
  const targets = []
  const costIdx = columns.value.findIndex(c => c.key === 'influencerCost')
  if (costIdx >= 0) targets.push({ index: costIdx, value: totalCost.value })
  const priceIdx = columns.value.findIndex(c => c.key === 'clientPrice')
  if (priceIdx >= 0) targets.push({ index: priceIdx, value: totalClientPrice.value })
  if (!targets.length) return []
  targets.sort((a, b) => a.index - b.index)

  const cells = []
  let cursor = 0
  targets.forEach((t, i) => {
    const gap = t.index - cursor
    if (gap > 0) cells.push({ index: cursor, colSpan: gap, type: i === 0 ? 'label' : 'blank' })
    cells.push({ index: t.index, colSpan: 1, type: 'total', value: t.value })
    cursor = t.index + 1
  })
  const trailing = columns.value.length - cursor
  if (trailing > 0) cells.push({ index: cursor, colSpan: trailing, type: 'blank' })
  return cells
})

async function load() {
  if (!props.reminderId) return
  loading.value = true
  try {
    const res = await progressReminderApi.details(props.reminderId)
    list.value = res.data || []
    brandTeamFilter.value = undefined
    accountNameFilter.value = undefined
    paymentProgressFilter.value = undefined
    tablePagination.current = 1
    remeasure()
  } finally {
    loading.value = false
  }
}

// 筛选条件变化后命中的记录数会变，留在原来的页码可能会翻到空白页，回到第一页
watch([brandTeamFilter, accountNameFilter, paymentProgressFilter], () => { tablePagination.current = 1 })

watch(() => props.visible, v => { if (v) load() })

function close() { emit('update:visible', false) }

// Invoice逾期提醒的明细行没有单一对应的合作跟踪记录，跳转到"红人需求管理"按内部需求编号定位；
// 红人结款临近付款日跳转到"红人结款"按结款单号定位（internalRequirementNo 这一类借用来存
// 结款单号，不是真正的需求编号，所以要在下面这个通用分支之前单独判断，否则会被误判成
// Invoice逾期那种跳转到"红人需求管理"）；其余几类（临近结款/进度滞留）跳转到"红人合作跟踪"
// 按内部项目编号定位。2026-07-29 起改成新开 tab（router.resolve 只算 URL，不跳转，
// window.open 才真正打开），而不是在当前"待处理"页面的 tab 里直接跳走——之前点了详情弹窗
// 就没了，还得重新打开弹窗才能继续看其他行。
// 2026-08 起 COLLAB_PAYMENT_DUE（临近结款）需要invoice的记录也会带上真正的
// internalRequirementNo（纯展示用，见后端 ProgressReminderDetail.internalRequirementNo
// 注释），必须在下面"有值就跳需求管理"这条通用分支之前单独排除，否则这一类的"查看详情"会被
// 误判成需求维度，跳去"红人需求管理"而不是本该去的"红人合作跟踪"这条具体记录
function goToDetail(record) {
  let route
  if (props.category === 'CONTRACT_EXPIRING_SOON') {
    // 2026-08 起团队级合同不再挂在具体红人身上，requirementId/internalRequirementNo 这两个
    // 字段借用来存 teamId（该品牌方没有团队层时为空）/brandId（见后端 runContractExpiringSoon
    // 的注释），跳到"品牌方/红人团队管理"自动定位并展开对应的团队合同列表——internalRequirementNo
    // 这里非空，必须在下面"有值就跳需求管理"这条通用分支之前单独排除
    const query = { openBrandId: record.internalRequirementNo }
    if (record.requirementId) query.openTeamId = record.requirementId
    route = { path: '/brands', query }
  } else if (props.category === 'INFLUENCER_PAYMENT_DUE' || props.category === 'INFLUENCER_PAYMENT_RECEIPT_OVERDUE') {
    // internalRequirementNo 这一类借用来存结款单号（见后端 runInfluencerPaymentDue/
    // runInfluencerPaymentReceiptOverdue 的注释），必须在下面"有值就跳需求管理"这条通用分支
    // 之前排除，否则会被误判成需求维度
    route = { path: '/payments', query: { paymentNo: record.internalRequirementNo } }
  } else if (props.category === 'COLLAB_PAYMENT_DUE') {
    route = { path: '/collaborations', query: { internalProjectNo: record.internalProjectNo } }
  } else if (record.internalRequirementNo) {
    route = { path: '/requirements', query: { internalRequirementNo: record.internalRequirementNo } }
  } else {
    route = { path: '/collaborations', query: { internalProjectNo: record.internalProjectNo } }
  }
  window.open(router.resolve(route).href, '_blank')
}

async function handleAcknowledge(record) {
  const targetId = REQUIREMENT_CATEGORIES.includes(props.category) ? record.requirementId : record.trackingId
  await progressReminderApi.acknowledge(props.category, targetId)
  message.success('已标记为已处理，进度有变化前不会再提醒这条')
  // 2026-07 起后端不再把标记已处理的行从列表里移除（那样会导致主卡片标题的笔数——跑批时
  // 固定算好的，不受标记影响——跟点进详情看到的笔数对不上），改成原地标记 acknowledged，
  // 这一行继续展示，只是变灰 + 换成"已标记为已处理"文案
  const target = list.value.find(r => r.id === record.id)
  if (target) target.acknowledged = true
}

/**
 * "已跟管理层确认此需求不涉及合同"（2026-08-21 新增，仅 REQUIREMENT_CONTRACT_OVERDUE）：
 * 先调需求管理那边的确认接口直接把标记写到这条需求上（无需管理层审核），再复用"标记已处理"
 * 的 acknowledge 接口把这条提醒也标记掉——Shawn 要求"点击之后，效果跟点击了标记已处理一样"，
 * 两步操作对用户来说是一次点击、一个确认弹窗，不需要分两次点。
 */
async function handleConfirmContractNotApplicable(record) {
  await requirementApi.confirmContractNotApplicable(record.requirementId)
  await progressReminderApi.acknowledge(props.category, record.requirementId)
  message.success('已确认该需求不涉及合同，并标记为已处理')
  const target = list.value.find(r => r.id === record.id)
  if (target) target.acknowledged = true
}

// 取消标记（2026-07 新增，防误点）：跟标记已处理对称，原地把 acknowledged 翻回 false，
// 这一行恢复正常颜色/正常提醒
async function handleUnacknowledge(record) {
  const targetId = REQUIREMENT_CATEGORIES.includes(props.category) ? record.requirementId : record.trackingId
  await progressReminderApi.unacknowledge(props.category, targetId)
  message.success('已取消标记')
  const target = list.value.find(r => r.id === record.id)
  if (target) target.acknowledged = false
}

// 已标记已处理的行整体变灰（内容仍然完整可读，只是弱化视觉优先级），跟未处理的行区分开
function rowClassName(record) {
  return record.acknowledged ? 'acknowledged-row' : ''
}
</script>

<style scoped>
.filter-bar { margin-bottom: 12px; }
:deep(.acknowledged-row) { opacity: 0.55; }
</style>
