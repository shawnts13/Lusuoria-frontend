<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">待处理</span>
    </div>

    <!-- 数据库每日备份失败提醒（2026-07-29 新增）：ADMIN/管理层可见，没有失败记录时组件自己不渲染 -->
    <DbBackupAlertSection v-if="authStore.isAdmin || authStore.isManagement" />

    <!-- 处理结果通知：所有非访客角色可见，内容为空时组件自己不渲染任何东西 -->
    <OperationResultNoticeList v-if="!authStore.isGuest" />

    <!-- 待我审核（内部执行成本修改）：项目负责人审核自己名下的申请，内容为空时组件自己不渲染 -->
    <MyExecutorCostApprovalList v-if="!authStore.isGuest" />

    <!-- 进度提醒：2026-07 起对所有非访客角色开放，具体能看到哪几类由后端按身份过滤 -->
    <ProgressReminderSection v-if="!authStore.isGuest" />

    <template v-if="authStore.isAdmin">
      <div class="filter-bar">
        <a-select v-model:value="filters.category" placeholder="类别" style="width:180px"
          allow-clear @change="loadData">
          <a-select-option value="DELETE_REQUEST">删除审核</a-select-option>
          <a-select-option value="PROGRESS_ROLLBACK">视频项目进度倒退审核</a-select-option>
          <a-select-option value="EXECUTOR_COST_MODIFY">内部执行成本修改审核</a-select-option>
        </a-select>
        <a-button @click="loadData">刷新</a-button>
      </div>

      <div class="table-card" ref="tableWrapperRef">
        <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
          <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
        </div>
        <a-table :columns="columns" :data-source="list" :loading="loading"
          row-key="id" size="middle" :pagination="pagination" :scroll="{ x: tableScrollX }"
          @change="onTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'category'">
              <a-tag :color="categoryColor(record.category)">{{ categoryLabel(record.category) }}</a-tag>
            </template>
            <template v-if="column.key === 'targetModule'">
              {{ moduleLabel(record.targetModule) }}
            </template>
            <template v-if="column.key === 'requestedChange'">
              <span v-if="record.category === 'PROGRESS_ROLLBACK'">
                视频项目进度 → {{ getLabel('collab_progress', record.requestedProgress) }}
                <span style="color:#595959">（红人结款进度将清空）</span>
              </span>
              <span v-else style="color:#bbb">—</span>
            </template>
            <template v-if="column.key === 'detail'">
              <a :href="detailLink(record)" target="_blank" rel="noopener">查看详情</a>
            </template>
            <template v-if="column.key === 'action'">
              <!-- 内部执行成本修改审核只能由该记录的项目负责人本人处理，ADMIN 这里只能看、不能代批 -->
              <span v-if="record.category === 'EXECUTOR_COST_MODIFY'" style="color:#595959;font-size:12px">
                需项目负责人本人审核
              </span>
              <a-space v-else>
                <a-popconfirm :title="approveConfirmText(record)" @confirm="handleApprove(record)">
                  <a style="color:#52c41a">同意</a>
                </a-popconfirm>
                <a-divider type="vertical" />
                <a style="color:#ff4d4f" @click="openReject(record)">拒绝</a>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </template>

    <a-modal v-model:open="rejectVisible" title="拒绝申请" @ok="handleReject" :confirm-loading="rejecting">
      <a-form layout="vertical">
        <a-form-item label="拒绝原因（选填）">
          <a-textarea v-model:value="rejectNote" :rows="3" placeholder="可以说明一下为什么拒绝" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { pendingApprovalApi } from '../../api/index'
import { formatDateTime } from '../../utils/dateFormat'
import { useOptions } from '../../composables/useOptions'
import { useAuthStore } from '../../store/auth'
import { useTopScrollbar } from '../../composables/useTopScrollbar'
import ProgressReminderSection from './ProgressReminderSection.vue'
import OperationResultNoticeList from './OperationResultNoticeList.vue'
import MyExecutorCostApprovalList from './MyExecutorCostApprovalList.vue'
import DbBackupAlertSection from './DbBackupAlertSection.vue'

const authStore = useAuthStore()
const { getLabel } = useOptions()
const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()

const loading = ref(false)
const list = ref([])
const filters = reactive({ category: undefined })
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showTotal: t => `共 ${t} 条` })

const rejectVisible = ref(false)
const rejecting = ref(false)
const rejectNote = ref('')
const rejectTarget = ref(null)

const columns = [
  // 宽度按最长标签"视频项目进度倒退审核"留够空间（tag 组件不换行，太窄会被裁切显示不全）
  { title: '类别',       key: 'category',   width: 200 },
  { title: '所属模块',   key: 'targetModule', width: 120 },
  { title: '摘要',       dataIndex: 'targetSummary', key: 'targetSummary', width: 200 },
  { title: '内部项目编号', dataIndex: 'targetInternalProjectNo', key: 'targetInternalProjectNo', width: 200 },
  { title: '申请改为',   key: 'requestedChange', width: 220 },
  // 2026-08 修复：之前没给这一列设 width，表格没开横向滚动（:scroll）时，浏览器会把没设宽度的
  // 列挤压到几乎看不见——其他列加起来已经快 1500px，"原因"这个最需要看清楚的字段反而被压没了。
  // 现在给个固定宽度 + 全表统一开横向滚动（tableScrollX），跟其他列一致，太长的原因文字用
  // ellipsis 省略号 + 悬浮显示完整内容，而不是被无声裁掉
  { title: '原因',       dataIndex: 'reason', key: 'reason', width: 260, ellipsis: true },
  { title: '发起人',     dataIndex: 'requestedBy', key: 'requestedBy', width: 100 },
  { title: '发起时间',   dataIndex: 'createdAt', key: 'createdAt', width: 160,
    customRender: ({ text }) => text ? formatDateTime(text) : '—' },
  { title: '查看详情',   key: 'detail', width: 90 },
  { title: '操作',       key: 'action', width: 150 }
]
const tableScrollX = computed(() => columns.reduce((sum, c) => sum + (c.width || 120), 0))

function categoryLabel(c) {
  if (c === 'DELETE_REQUEST') return '删除审核'
  if (c === 'PROGRESS_ROLLBACK') return '视频项目进度倒退审核'
  if (c === 'EXECUTOR_COST_MODIFY') return '内部执行成本修改审核'
  return c
}
// 三种申请类别，不是进度状态；删除是破坏性操作用红色区分，倒退是纠正性操作用金色，
// 内部执行成本修改不是 ADMIN 审核（只能看）用紫色跟前两种区分开
function categoryColor(c) {
  const m = { DELETE_REQUEST: 'red', PROGRESS_ROLLBACK: 'gold', EXECUTOR_COST_MODIFY: 'purple' }
  return m[c] || 'orange'
}
function moduleLabel(m) { return m === 'COLLABORATION_TRACKING' ? '红人合作跟踪' : m }

function approveConfirmText(record) {
  return record.category === 'PROGRESS_ROLLBACK'
    ? '确认同意这条视频项目进度倒退申请？同意后视频项目进度将改为申请时的状态，红人结款进度会一并清空。'
    : '确认同意这条删除申请？同意后将真正执行删除。'
}

function detailLink(record) {
  // "项目订单"模块已废弃，待处理事项现在只会来自红人合作跟踪
  return `/collaborations?internalProjectNo=${encodeURIComponent(record.targetInternalProjectNo || '')}`
}

async function loadData() {
  loading.value = true
  try {
    const res = await pendingApprovalApi.list(filters.category, pagination.current - 1, pagination.pageSize)
    list.value = res.data?.content || []
    pagination.total = res.data?.totalElements || 0
    remeasure()
  } finally { loading.value = false }
}

function onTableChange(p) {
  pagination.current = p.current
  pagination.pageSize = p.pageSize
  loadData()
}

async function handleApprove(record) {
  await pendingApprovalApi.approve(record.id)
  message.success(record.category === 'PROGRESS_ROLLBACK' ? '已同意，视频项目进度已更新' : '已同意，删除已执行')
  loadData()
}

function openReject(record) {
  rejectTarget.value = record
  rejectNote.value = ''
  rejectVisible.value = true
}

async function handleReject() {
  rejecting.value = true
  try {
    await pendingApprovalApi.reject(rejectTarget.value.id, rejectNote.value || null)
    message.success('已拒绝')
    rejectVisible.value = false
    loadData()
  } finally { rejecting.value = false }
}

// 审批列表只有 ADMIN 能看，非 ADMIN 的"管理层"用户进这个页面只是为了看进度提醒，
// 不应该去调 /api/pending-approvals（后端是 hasRole('ADMIN')，会报无权限）
onMounted(() => { if (authStore.isAdmin) loadData() })
</script>
