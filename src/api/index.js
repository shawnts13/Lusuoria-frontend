import http from './http'

const BASE = import.meta.env.VITE_API_URL || ''

// 通用带鉴权的文件下载
function downloadWithAuth(url, filename) {
  const token = localStorage.getItem('token')
  fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename || 'download.xlsx'
      a.click()
      URL.revokeObjectURL(a.href)
    })
}

// ===== 系统 =====
// health：轻量健康检查（不查数据库），供年度报告/双月对比在发起大批请求前"预热"服务器用，
// 见 pages/dashboard/report/useReportFetch.js 的 warmUpBackend
export const systemApi = {
  health: () => http.get('/actuator/health', { silent: true, timeout: 8000 })
}

// ===== Auth =====
export const authApi = {
  login:     (data) => http.post('/api/auth/login', data),
  initAdmin: ()     => http.post('/api/auth/init-admin')
}

// ===== Users =====
export const userApi = {
  list:           ()         => http.get('/api/users'),
  create:         (data)     => http.post('/api/users', data),
  update:         (id, data) => http.put(`/api/users/${id}`, data),
  toggle:         (id)       => http.patch(`/api/users/${id}/toggle`),
  delete:         (id)       => http.delete(`/api/users/${id}`),
  me:             ()         => http.get('/api/users/me'),
  changePassword: (data)     => http.post('/api/users/change-password', data)
}

// ===== Brands =====
export const brandApi = {
  list:     ()     => http.get('/api/brands'),
  getById:  (id)   => http.get(`/api/brands/${id}`),
  save:     (data) => http.post('/api/brands', data),
  delete:   (id)   => http.delete(`/api/brands/${id}`),
  teamOptions: (brandId) => http.get(`/api/brands/${brandId}/team-options`),

  exportExcel:      ()     => downloadWithAuth(`${BASE}/api/brands/export/excel`, '品牌方.xlsx')
}

// ===== Influencer Teams =====
export const influencerTeamApi = {
  list:        ()        => http.get('/api/influencer-teams'),
  listByBrand: (brandId) => http.get(`/api/influencer-teams/by-brand/${brandId}`),
  save:        (data)    => http.post('/api/influencer-teams', data),
  delete:      (id)      => http.delete(`/api/influencer-teams/${id}`)
}

// ===== Domains =====
export const domainApi = {
  list:   ()     => http.get('/api/domains'),
  add:    (name) => http.post('/api/domains', JSON.stringify(name),
    { headers: { 'Content-Type': 'application/json' } }),
  delete: (id)   => http.delete(`/api/domains/${id}`)
}

// ===== Influencers =====
export const influencerApi = {
  // 分页查询（红人管理页用）
  list:    (params) => http.get('/api/influencers', { params }),
  // 简单列表（下拉选择用，不分页）
  simple:  ()      => http.get('/api/influencers/simple'),
  getById: (id)    => http.get(`/api/influencers/${id}`),
  save:    (data)  => http.post('/api/influencers', data),
  delete:  (id)    => http.delete(`/api/influencers/${id}`),

  // 批量查询红人的"合作中项目"/"已完结项目"数量（返回 {activeCount, completedCount}）
  projectCounts: (influencerIds) => http.post('/api/influencers/project-counts', influencerIds),

  exportExcel:      (type) => downloadWithAuth(
    `${BASE}/api/influencers/export/excel${type ? '?influencerType=' + type : ''}`, '红人.xlsx'),
  downloadTemplate: ()     => downloadWithAuth(`${BASE}/api/influencers/import/template`, '红人导入模板.xlsx'),
  importExcel:      (form) => http.post('/api/influencers/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000  // 导入数据量大，超时设为2分钟
  })
}

// ===== 红人已签署合同（2026-07 新增，"红人管理"编辑弹窗"已签署合同"区块） =====
export const influencerContractApi = {
  byInfluencer:    (influencerId) => http.get(`/api/influencer-contracts/by-influencer/${influencerId}`),
  // 批量按红人id取合同，返回 { influencerId: { year: contractLink } }，供"红人需求管理"列表交叉核对。
  // ids 要 join 成逗号分隔字符串再传——axios 默认把数组序列化成 ids[]=1&ids[]=2，
  // Spring 的 @RequestParam List<Long> ids 认不出这种带方括号的参数名，会直接报 500
  byInfluencerIds: (ids) => http.get('/api/influencer-contracts/by-influencer-ids', { params: { ids: ids.join(',') } }),
  create: (data)     => http.post('/api/influencer-contracts', data),
  update: (id, data) => http.put(`/api/influencer-contracts/${id}`, data),
  // 硬删除（不是软删除），数据库行直接删掉，方便手动清理很久以前的历史合同
  delete: (id) => http.delete(`/api/influencer-contracts/${id}`)
}

// ===== Employees =====
export const employeeApi = {
  list:    (role) => http.get('/api/employees', { params: { role } }),
  getById: (id)   => http.get(`/api/employees/${id}`),
  save:    (data) => http.post('/api/employees', data),
  delete:  (id)   => http.delete(`/api/employees/${id}`),
  getBonusTiers: (id) => http.get(`/api/employees/${id}/bonus-tiers`),
  getBonusTiersBulk: (employeeIds) => http.get('/api/employees/bonus-tiers', { params: { employeeIds: employeeIds.join(',') } }),

  exportExcel: (role) => downloadWithAuth(
    `${BASE}/api/employees/export/excel${role ? '?role=' + role : ''}`, '员工.xlsx')
}

// ===== Executor Pay Rates（执行人员薪资梯度，按(项目负责人,执行人员,视频类型)独立维护，
// 每个视频类型都是一份"按当月累计条数分档"的梯度——"每条固定价"就是只配置一档、不封顶） =====
export const executorPayRateApi = {
  // managerId 不传时，后端 STAFF 账号自动用当前登录人自己的员工id；ADMIN 不传则默认取"管理层"。
  // 返回该负责人名下所有执行人员/所有视频类型的档位平铺列表，前端自行按 executorId+videoType 分组
  list:  (managerId) => http.get('/api/executor-pay-rates', { params: { managerId } }),
  // 2026-07 起配置按视频类型分开，必须精确到 videoType 才能判断某个类型是否已配置
  check: (managerId, executorId, videoType) =>
    http.get('/api/executor-pay-rates/check', { params: { managerId, executorId, videoType } }),
  // data: { managerId, executorId, tiersByType: { REAL_SHOT_NEW: [...], ... } }，整批替换
  save:  (data) => http.post('/api/executor-pay-rates', data)
}

// ===== Influencer Payments =====
export const paymentApi = {
  list:    (params) => http.get('/api/influencer-payments', { params }),
  getById: (id)     => http.get(`/api/influencer-payments/${id}`),
  save:    (data)   => http.post('/api/influencer-payments', data),
  delete:  (id)     => http.delete(`/api/influencer-payments/${id}`),
  updateStatus: (id, data) => http.patch(`/api/influencer-payments/${id}/status`, data),
  candidates: (params) => http.get('/api/influencer-payments/candidates', { params }),
  items:      (id)     => http.get(`/api/influencer-payments/${id}/items`),
  // 2026-08 新增："上传发票"（公对公发票），跟"红人需求管理"的Invoice是同一套机制，命名规则用 receipt
  uploadReceiptLink: (id, receiptLink) => http.post(`/api/influencer-payments/${id}/receipt-link`, { receiptLink }),

  exportExcel: (settlementMonth) => downloadWithAuth(
    `${BASE}/api/influencer-payments/export/excel${settlementMonth ? '?settlementMonth=' + settlementMonth : ''}`,
    `红人结款_${settlementMonth || 'all'}.xlsx`)
}

// ===== Collaboration Trackings =====
export const collaborationApi = {
  list:    (params) => http.get('/api/collaboration-trackings', { params }),
  getById: (id)     => http.get(`/api/collaboration-trackings/${id}`),
  save:    (data)   => http.post('/api/collaboration-trackings', data),
  requestDelete: (id, reason) => http.post(`/api/collaboration-trackings/${id}/delete-request`, { reason }),
  updateStatus: (id, data) => http.patch(`/api/collaboration-trackings/${id}/status`, data),

  // 2026-07 从项目订单模块迁移过来："设置内部执行成本"流程。executorId 可选：还没选执行人员时
  // 现场选了人，传这个参数可以现算这个人的建议金额
  suggestExecutorCost: (id, executorId) => http.get(`/api/collaboration-trackings/${id}/executor-cost-suggestion`,
    { params: executorId ? { executorId } : {} }),
  // 2026-07 起返回 { tracking, pendingApproval }：非首次修改且操作人不是项目负责人本人时
  // pendingApproval=true，tracking 是改动前的原始记录（还没生效，已提交项目负责人审核）
  setExecutorCost:     (id, payload) => http.patch(`/api/collaboration-trackings/${id}/executor-cost`, payload),
  unlinkRequirement:   (id) => http.patch(`/api/collaboration-trackings/${id}/unlink-requirement`),
  recomputeProfits: () => http.post('/api/collaboration-trackings/recompute-profits'),

  // 红人管理"合作中项目/已完结项目"下钻弹窗用（2026-07 新增）：category 传 'ACTIVE' 或 'COMPLETED'。
  // filters 可选（2026-07 新增）：platform/videoType/progress/influencerPaymentProgress/
  // projectManagerId/videoMonth，都是"传了就筛，不传不影响"，可以同时生效
  byInfluencer: (influencerId, category, page, size, filters) => http.get('/api/collaboration-trackings/by-influencer',
    { params: { influencerId, category, page, size, ...filters } }),

  exportExcel: (params) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    return downloadWithAuth(
      `${BASE}/api/collaboration-trackings/export/excel${qs ? '?' + qs : ''}`,
      '红人合作跟踪.xlsx')
  },

  downloadTemplate: () => downloadWithAuth(
    `${BASE}/api/collaboration-trackings/template`, '红人合作跟踪导入模板.xlsx'),

  importExcel: (form) => http.post('/api/collaboration-trackings/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }),

  // "复制"批量新建：一次性提交多条视频项目，整批在一个事务里校验+保存
  batchCreate: (list) => http.post('/api/collaboration-trackings/batch', list)
}

// ===== 红人需求管理 =====
export const requirementApi = {
  list:    (params) => http.get('/api/influencer-requirements', { params }),
  getById: (id)     => http.get(`/api/influencer-requirements/${id}`),
  save:    (data)   => http.post('/api/influencer-requirements', data),
  // 2026-08 起删除改成需要管理员审核（不再是直接 DELETE），跟红人合作跟踪的 requestDelete 一致
  requestDelete: (id, reason) => http.post(`/api/influencer-requirements/${id}/delete-request`, { reason }),
  items:   (id)     => http.get(`/api/influencer-requirements/${id}/items`),
  byInfluencer:    (influencerId) => http.get(`/api/influencer-requirements/by-influencer/${influencerId}`),
  progressDetail:  (id)           => http.get(`/api/influencer-requirements/${id}/progress-detail`),
  parseContent:    (content)      => http.post('/api/influencer-requirements/parse-content', { content }),

  // "存量记录关联需求"
  legacyCandidates: (influencerId, internalRequirementNo) =>
    http.get('/api/influencer-requirements/legacy-candidates', { params: { influencerId, internalRequirementNo } }),
  linkLegacy: (internalRequirementNo, trackingIds) =>
    http.post('/api/influencer-requirements/link-legacy', { internalRequirementNo, trackingIds }),

  // "重新计算需求完成时间"（仅ADMIN，善后用，2026-08 新增）
  recomputeCompletedAt: () => http.post('/api/influencer-requirements/recompute-completed-at'),

  uploadInvoiceLink: (id, invoiceLink) =>
    http.post(`/api/influencer-requirements/${id}/invoice-link`, { invoiceLink }),
  uploadContractLink: (id, contractLink) =>
    http.post(`/api/influencer-requirements/${id}/contract-link`, { contractLink }),

  exportExcel: (params) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    return downloadWithAuth(
      `${BASE}/api/influencer-requirements/export/excel${qs ? '?' + qs : ''}`,
      '红人需求.xlsx')
  }
}

// ===== 导入历史（目前只有红人合作跟踪用异步导入）=====
export const importBatchApi = {
  list:    (params) => http.get('/api/import-batches', { params }),
  getById: (id)      => http.get(`/api/import-batches/${id}`),
  remove:  (id)      => http.delete(`/api/import-batches/${id}`)
}

// ===== Dashboard =====
// extraConfig：2026-07 新增，年度报告/双月对比批量拉取时传 { silent: true }，单个请求失败/超时
// 不弹全局 Toast（见 src/api/http.js 的 silent 处理），避免 Render 免费实例冷启动时刷屏报错
export const dashboardApi = {
  // dateRange（[startDate, endDate]，'YYYY-MM-DD'，2026-08 新增"视频发布日期"筛选用）传了就按
  // 日期区间查，不传按 yearMonth/startMonth+endMonth 查——跟后端 /summary 等接口"二选一"的
  // 约定一致，两边都不传时后端会报错，调用方要保证至少传一种
  summary:      (yearMonth, currency, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/summary', {
      params: { yearMonth, currency, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),
  exchangeRate: (yearMonth)           => http.get('/api/dashboard/exchange-rate', { params: { yearMonth } }),

  drilldownVideoCount: (startMonth, endMonth, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/video-count', {
      params: { startMonth, endMonth, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownClientPrice: (startMonth, endMonth, currency, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/client-price', {
      params: { startMonth, endMonth, currency, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  // "客户已回款总金额"下钻（2026-08 新增），维度选项跟"客户合作价格"完全一样
  drilldownClientSettledAmount: (startMonth, endMonth, currency, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/client-settled-amount', {
      params: { startMonth, endMonth, currency, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownInfluencerCost: (startMonth, endMonth, currency, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/influencer-cost', {
      params: { startMonth, endMonth, currency, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownGrossProfit: (startMonth, endMonth, currency, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/gross-profit', {
      params: { startMonth, endMonth, currency, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownCompanyProfit: (startMonth, endMonth, currency, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/company-profit', {
      params: { startMonth, endMonth, currency, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownExecutionCost: (startMonth, endMonth, currency, dimension, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/execution-cost', {
      params: { startMonth, endMonth, currency, dimension, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownOtherStaffCost: (startMonth, endMonth, currency) =>
    http.get('/api/dashboard/drilldown/other-staff-cost', { params: { startMonth, endMonth, currency } }),

  drilldownCommission: (startMonth, endMonth, currency, dateRange, extraConfig = {}) =>
    http.get('/api/dashboard/drilldown/commission', {
      params: { startMonth, endMonth, currency, startDate: dateRange?.[0], endDate: dateRange?.[1] }, ...extraConfig
    }),

  drilldownExtraBonus: (startMonth, endMonth, currency) =>
    http.get('/api/dashboard/drilldown/extra-bonus', { params: { startMonth, endMonth, currency } }),

  // 2026-07 新增：年度报告 / 双月对比 / 业务分析
  rangeSummary: (startMonth, endMonth, currency, extraConfig = {}) =>
    http.get('/api/dashboard/range-summary', { params: { startMonth, endMonth, currency }, ...extraConfig }),

  pivot: (startMonth, endMonth, currency, rowDimension, colDimension, extraConfig = {}) =>
    http.get('/api/dashboard/pivot', { params: { startMonth, endMonth, currency, rowDimension, colDimension }, ...extraConfig }),

  managerTrend: (startMonth, endMonth, currency, role, extraConfig = {}) =>
    http.get('/api/dashboard/manager-trend', { params: { startMonth, endMonth, currency, role }, ...extraConfig })
}

// ===== 工资单 =====
export const payslipApi = {
  // 管理层视角：按月+可选角色筛选（不含管理层自己）
  list: (yearMonth, role, currency) => http.get('/api/payslips', { params: { yearMonth, role, currency } }),
  management: (yearMonth, currency) => http.get('/api/payslips/management', { params: { yearMonth, currency } }),
  me: (yearMonth, currency) => http.get('/api/payslips/me', { params: { yearMonth, currency } }),
  detail: (employeeId, yearMonth, currency) =>
    http.get(`/api/payslips/${employeeId}/detail`, { params: { yearMonth, currency } }),
  setExtraBonus: (employeeId, yearMonth, amount, currency) =>
    http.post(`/api/payslips/${employeeId}/extra-bonus`, { yearMonth, amount, currency }),
  setLegalSalary: (employeeId, yearMonth, amountRmb) =>
    http.post(`/api/payslips/${employeeId}/legal-salary`, { yearMonth, amountRmb }),
  confirm: (employeeId, yearMonth) => http.post(`/api/payslips/${employeeId}/confirm`, { yearMonth }),
  unconfirm: (employeeId, yearMonth) => http.post(`/api/payslips/${employeeId}/unconfirm`, { yearMonth }),
  // 项目负责人自己确认/取消确认名下某一个执行人员的工资（跟上面对自己工资单的确认完全独立，
  // 2026-07 起按执行人员单独确认，必须传 executorId）；managerId 不传时后端会用当前登录账号
  // 自己关联的员工 id（项目负责人角色场景就是这样调用）
  confirmExecutorWages: (yearMonth, executorId, managerId) =>
    http.post('/api/payslips/executor-wages/confirm', { yearMonth, executorId, managerId }),
  unconfirmExecutorWages: (yearMonth, executorId, managerId) =>
    http.post('/api/payslips/executor-wages/unconfirm', { yearMonth, executorId, managerId })
}

// ===== Exchange Rates (人工维护) =====
export const exchangeRateApi = {
  getOne:  (yearMonth) => http.get(`/api/exchange-rates/${yearMonth}`),
  list:    ()          => http.get('/api/exchange-rates'),
  save:    (data)      => http.post('/api/exchange-rates', data)
}

// ===== 待处理事项 =====
export const pendingApprovalApi = {
  list:    (category, page, size) => http.get('/api/pending-approvals', { params: { category, page, size } }),
  approve: (id)         => http.post(`/api/pending-approvals/${id}/approve`),
  reject:  (id, note)   => http.post(`/api/pending-approvals/${id}/reject`, { note }),
  // "处理结果通知"（2026-07 新增）：非管理员看自己相关记录已同意/已拒绝的通知
  myNotifications: () => http.get('/api/pending-approvals/my-notifications'),
  // "待我审核"（2026-07 新增）：项目负责人看名下待自己审核的内部执行成本修改申请
  myApprovals: () => http.get('/api/pending-approvals/my-approvals'),
  // 2026-07 起是真正的数据库硬删除（等相关方都点过才真删），而不是软标记
  dismiss: (id) => http.post(`/api/pending-approvals/${id}/dismiss`)
}

// ===== 进度提醒 =====
export const progressReminderApi = {
  list:         ()   => http.get('/api/progress-reminders'),
  details:      (id) => http.get(`/api/progress-reminders/${id}/details`),
  recompute:    ()   => http.post('/api/progress-reminders/recompute'),
  // "项目流转后更新提示内容"（2026-07 新增）：只重算进度滞留/Invoice逾期这3类
  recomputeProjectFlow: () => http.post('/api/progress-reminders/recompute-project-flow'),
  popupCheck:   ()   => http.get('/api/progress-reminders/popup-check'),
  popupDismiss: ()   => http.post('/api/progress-reminders/popup-dismiss'),
  // "标记已处理"（2026-07 新增，仅进度滞留/Invoice逾期这3类支持）
  acknowledge: (category, targetId) => http.post('/api/progress-reminders/acknowledge', { category, targetId }),
  // 取消"标记已处理"（2026-07 新增，防误点）
  unacknowledge: (category, targetId) => http.post('/api/progress-reminders/unacknowledge', { category, targetId })
}

// ===== 进度提醒阈值维护（2026-07-28 新增，仅"管理层"可访问） =====
export const reminderThresholdApi = {
  list:   ()               => http.get('/api/reminder-threshold-configs'),
  update: (id, paramValue) => http.put(`/api/reminder-threshold-configs/${id}`, { paramValue })
}

// ===== Google Drive 授权（2026-07-29 新增，数据库每日备份用，仅 ADMIN 可访问） =====
export const googleDriveAuthApi = {
  authorizeUrl: () => http.get('/api/google-drive-auth/authorize-url'),
  status:       () => http.get('/api/google-drive-auth/status')
}

// ===== 数据库每日备份（2026-07-29 新增，"待处理"里的失败提醒+重试，ADMIN/管理层可见） =====
export const dbBackupApi = {
  alert: () => http.get('/api/db-backup/alert'),
  // 重试是同步跑一遍完整的 pg_dump+压缩+上传，可能比较慢，全局30秒超时不够用，单独放宽到3分钟
  retry: () => http.post('/api/db-backup/retry', null, { timeout: 180000 })
}
