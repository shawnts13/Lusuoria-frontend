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
    headers: { 'Content-Type': 'multipart/form-data' }
  })
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

  projectCounts: (ids) => http.post('/api/influencers/project-counts', ids),

  exportExcel:      (type) => downloadWithAuth(
    `${BASE}/api/influencers/export/excel${type ? '?influencerType=' + type : ''}`, '红人.xlsx'),
  downloadTemplate: ()     => downloadWithAuth(`${BASE}/api/influencers/import/template`, '红人导入模板.xlsx'),
  importExcel:      (form) => http.post('/api/influencers/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
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
  delete:         (id)     => http.delete(`/api/projects/${id}`),
  monthlySummary: (month)  => http.get('/api/projects/summary/monthly', { params: { month } }),
  approve:        (id)     => http.patch(`/api/projects/${id}/approve`),
  reject:         (id)     => http.patch(`/api/projects/${id}/reject`),

  exportExcel: (projectMonth) => downloadWithAuth(
    `${BASE}/api/projects/export/excel${projectMonth ? '?projectMonth=' + projectMonth : ''}`,
    `项目结算_${projectMonth || 'all'}.xlsx`),

  downloadTemplate: () => downloadWithAuth(
    `${BASE}/api/projects/import/template`, '项目订单导入模板.xlsx'),

  importExcel: (formData) => http.post('/api/projects/import/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// ===== Influencer Payments =====
export const paymentApi = {
  list:    (params) => http.get('/api/influencer-payments', { params }),
  getById: (id)     => http.get(`/api/influencer-payments/${id}`),
  save:    (data)   => http.post('/api/influencer-payments', data),
  delete:  (id)     => http.delete(`/api/influencer-payments/${id}`),

  exportExcel: (settlementMonth) => downloadWithAuth(
    `${BASE}/api/influencer-payments/export/excel${settlementMonth ? '?settlementMonth=' + settlementMonth : ''}`,
    `红人结款_${settlementMonth || 'all'}.xlsx`),

  downloadTemplate: () => downloadWithAuth(
    `${BASE}/api/influencer-payments/import/template`, '红人结款导入模板.xlsx'),

  importExcel: (form) => http.post('/api/influencer-payments/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
