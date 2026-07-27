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

  exportExcel:      ()     => downloadWithAuth(`${BASE}/api/brands/export/excel`, '品牌方.xlsx'),
  downloadTemplate: ()     => downloadWithAuth(`${BASE}/api/brands/import/template`, '品牌方导入模板.xlsx'),
  importExcel:      (form) => http.post('/api/brands/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  })
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

  // 批量查询红人的合作项目数量（红人管理列表"合作项目"列用）
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
  setExecutorCost:     (id, payload) => http.patch(`/api/collaboration-trackings/${id}/executor-cost`, payload),
  unlinkRequirement:   (id) => http.patch(`/api/collaboration-trackings/${id}/unlink-requirement`),
  recomputeProfits: () => http.post('/api/collaboration-trackings/recompute-profits'),

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
  delete:  (id)     => http.delete(`/api/influencer-requirements/${id}`),
  items:   (id)     => http.get(`/api/influencer-requirements/${id}/items`),
  byInfluencer:    (influencerId) => http.get(`/api/influencer-requirements/by-influencer/${influencerId}`),
  progressDetail:  (id)           => http.get(`/api/influencer-requirements/${id}/progress-detail`),
  parseContent:    (content)      => http.post('/api/influencer-requirements/parse-content', { content }),

  // "存量记录关联需求"
  legacyCandidates: (influencerId, internalRequirementNo) =>
    http.get('/api/influencer-requirements/legacy-candidates', { params: { influencerId, internalRequirementNo } }),
  linkLegacy: (internalRequirementNo, trackingIds) =>
    http.post('/api/influencer-requirements/link-legacy', { internalRequirementNo, trackingIds }),

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
export const dashboardApi = {
  summary:      (yearMonth, currency) => http.get('/api/dashboard/summary', { params: { yearMonth, currency } }),
  exchangeRate: (yearMonth)           => http.get('/api/dashboard/exchange-rate', { params: { yearMonth } }),

  drilldownVideoCount: (startMonth, endMonth, dimension) =>
    http.get('/api/dashboard/drilldown/video-count', { params: { startMonth, endMonth, dimension } }),

  drilldownClientPrice: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/client-price', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownInfluencerCost: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/influencer-cost', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownGrossProfit: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/gross-profit', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownCompanyProfit: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/company-profit', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownExecutionCost: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/execution-cost', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownOtherStaffCost: (startMonth, endMonth, currency) =>
    http.get('/api/dashboard/drilldown/other-staff-cost', { params: { startMonth, endMonth, currency } }),

  drilldownCommission: (startMonth, endMonth, currency) =>
    http.get('/api/dashboard/drilldown/commission', { params: { startMonth, endMonth, currency } })
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
  // 项目负责人自己确认/取消确认名下执行人员的工资（跟上面对自己工资单的确认完全独立）；
  // managerId 不传时后端会用当前登录账号自己关联的员工 id（项目负责人角色场景就是这样调用）
  confirmExecutorWages: (yearMonth, managerId) =>
    http.post('/api/payslips/executor-wages/confirm', { yearMonth, managerId }),
  unconfirmExecutorWages: (yearMonth, managerId) =>
    http.post('/api/payslips/executor-wages/unconfirm', { yearMonth, managerId })
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
  acknowledge: (category, targetId) => http.post('/api/progress-reminders/acknowledge', { category, targetId })
}
