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

  exportExcel:      ()     => downloadWithAuth(`${BASE}/api/brands/export/excel`, '品牌方.xlsx'),
  downloadTemplate: ()     => downloadWithAuth(`${BASE}/api/brands/import/template`, '品牌方导入模板.xlsx'),
  importExcel:      (form) => http.post('/api/brands/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  })
}

// ===== Influencer Teams =====
export const influencerTeamApi = {
  list:   ()     => http.get('/api/influencer-teams'),
  add:    (name) => http.post('/api/influencer-teams', JSON.stringify(name),
    { headers: { 'Content-Type': 'application/json' } }),
  delete: (id)   => http.delete(`/api/influencer-teams/${id}`)
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

  contractUploadUrl: () => http.get('/api/influencers/contract-upload-url'),

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

// ===== Employees =====
export const employeeApi = {
  list:    (role) => http.get('/api/employees', { params: { role } }),
  getById: (id)   => http.get(`/api/employees/${id}`),
  save:    (data) => http.post('/api/employees', data),
  delete:  (id)   => http.delete(`/api/employees/${id}`)
}

// ===== Project Orders =====
export const projectApi = {
  list:           (params) => http.get('/api/projects', { params }),
  getById:        (id)     => http.get(`/api/projects/${id}`),
  save:           (data)   => http.post('/api/projects', data),
  requestDelete:  (id, reason) => http.post(`/api/projects/${id}/delete-request`, { reason }),
  monthlySummary: (month)  => http.get('/api/projects/summary/monthly', { params: { month } }),
  approve:        (id)     => http.patch(`/api/projects/${id}/approve`),
  reject:         (id)     => http.patch(`/api/projects/${id}/reject`),
  updateStatus:   (id, data) => http.patch(`/api/projects/${id}/status`, data),
  suggestExecutorCost: (id) => http.get(`/api/projects/${id}/executor-cost-suggestion`),
  setExecutorCost:     (id, amount) => http.patch(`/api/projects/${id}/executor-cost`, { amount }),

  exportExcel: (projectMonth) => downloadWithAuth(
    `${BASE}/api/projects/export/excel${projectMonth ? '?projectMonth=' + projectMonth : ''}`,
    `项目结算_${projectMonth || 'all'}.xlsx`)
}

// ===== Influencer Payments =====
export const paymentApi = {
  list:    (params) => http.get('/api/influencer-payments', { params }),
  getById: (id)     => http.get(`/api/influencer-payments/${id}`),
  save:    (data)   => http.post('/api/influencer-payments', data),
  delete:  (id)     => http.delete(`/api/influencer-payments/${id}`),
  updateStatus: (id, data) => http.patch(`/api/influencer-payments/${id}/status`, data),

  exportExcel: (settlementMonth) => downloadWithAuth(
    `${BASE}/api/influencer-payments/export/excel${settlementMonth ? '?settlementMonth=' + settlementMonth : ''}`,
    `红人结款_${settlementMonth || 'all'}.xlsx`),

  downloadTemplate: () => downloadWithAuth(
    `${BASE}/api/influencer-payments/import/template`, '红人结款导入模板.xlsx'),

  importExcel: (form) => http.post('/api/influencer-payments/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  })
}

// ===== Collaboration Trackings =====
export const collaborationApi = {
  list:    (params) => http.get('/api/collaboration-trackings', { params }),
  getById: (id)     => http.get(`/api/collaboration-trackings/${id}`),
  save:    (data)   => http.post('/api/collaboration-trackings', data),
  requestDelete: (id, reason) => http.post(`/api/collaboration-trackings/${id}/delete-request`, { reason }),
  updateStatus: (id, data) => http.patch(`/api/collaboration-trackings/${id}/status`, data),

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
  })
}

// ===== 导入历史（目前只有红人合作跟踪用异步导入）=====
export const importBatchApi = {
  list:    (params) => http.get('/api/import-batches', { params }),
  getById: (id)      => http.get(`/api/import-batches/${id}`)
}

// ===== Dashboard =====
export const dashboardApi = {
  summary:      (yearMonth, currency) => http.get('/api/dashboard/summary', { params: { yearMonth, currency } }),
  exchangeRate: (yearMonth)           => http.get('/api/dashboard/exchange-rate', { params: { yearMonth } }),

  drilldownVideoCount: (startMonth, endMonth, dimension) =>
    http.get('/api/dashboard/drilldown/video-count', { params: { startMonth, endMonth, dimension } }),

  drilldownClientPrice: (startMonth, endMonth, currency) =>
    http.get('/api/dashboard/drilldown/client-price', { params: { startMonth, endMonth, currency } }),

  drilldownInfluencerCost: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/influencer-cost', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownGrossProfit: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/gross-profit', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownCompanyProfit: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/company-profit', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownExecutionCost: (startMonth, endMonth, currency, dimension) =>
    http.get('/api/dashboard/drilldown/execution-cost', { params: { startMonth, endMonth, currency, dimension } }),

  drilldownCommission: (startMonth, endMonth, currency) =>
    http.get('/api/dashboard/drilldown/commission', { params: { startMonth, endMonth, currency } })
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
  reject:  (id, note)   => http.post(`/api/pending-approvals/${id}/reject`, { note })
}
