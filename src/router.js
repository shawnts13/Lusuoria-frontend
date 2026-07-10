import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./pages/auth/LoginPage.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('./components/layout/MainLayout.vue'),
    children: [
      { path: '', redirect: '/collaborations' },  // 默认落地页改为红人合作跟踪（项目订单模块已废弃）
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('./pages/dashboard/DashboardPage.vue'),
        meta: { financialOnly: true }       // 仅 ADMIN / AUDITOR
      },
      { path: 'collaborations', name: 'Collaborations', component: () => import('./pages/collaboration/CollaborationListPage.vue') },
      { path: 'import-batches', name: 'ImportBatches', component: () => import('./pages/collaboration/ImportBatchListPage.vue') },
      {
        path: 'payments',
        name: 'Payments',
        component: () => import('./pages/payment/PaymentListPage.vue'),
        // 严格按员工角色（管理层/财务/法务）判断，跟 ADMIN/AUDITOR 等 role 无关，见 store/auth.js canAccessPayments
        meta: { paymentAccess: true }
      },
      {
        path: 'pending',
        name: 'Pending',
        component: () => import('./pages/pending/PendingListPage.vue'),
        // ADMIN 能看"待处理"审批列表，"管理层"（员工角色，见 isManagement）能看"进度提醒"，
        // 两者满足其一就能进页面，页面内部再各自控制具体区块的可见性
        meta: { pendingAccess: true }
      },
      { path: 'brands',      name: 'Brands',      component: () => import('./pages/brand/BrandListPage.vue') },
      { path: 'influencers', name: 'Influencers', component: () => import('./pages/influencer/InfluencerListPage.vue') },
      { path: 'employees',   name: 'Employees',   component: () => import('./pages/employee/EmployeeListPage.vue') },
      {
        path: 'exchange-rates',
        name: 'ExchangeRates',
        component: () => import('./pages/exchange-rate/ExchangeRateListPage.vue'),
        meta: { adminOnly: true }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('./pages/user/UserListPage.vue'),
        meta: { adminOnly: true }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/collaborations' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const role  = localStorage.getItem('role')
  const isManagement = localStorage.getItem('isManagement') === 'true'
  const employeeRole = localStorage.getItem('employeeRole')

  if (!to.meta.public && !token) {
    next('/login')
    return
  }
  if (to.path === '/login' && token) {
    next('/collaborations')
    return
  }
  // 数据看板：仅 ADMIN / AUDITOR
  if (to.meta.financialOnly && role !== 'ADMIN' && role !== 'AUDITOR') {
    next('/collaborations')
    return
  }
  // 账号管理：仅 ADMIN
  if (to.meta.adminOnly && role !== 'ADMIN') {
    next('/collaborations')
    return
  }
  // 待处理：ADMIN（审批列表）或"管理层"员工角色（进度提醒）
  if (to.meta.pendingAccess && role !== 'ADMIN' && !isManagement) {
    next('/collaborations')
    return
  }
  // 红人结款：严格按员工角色（管理层/财务/法务），跟 ADMIN/AUDITOR 等 role 无关
  if (to.meta.paymentAccess && !['管理层', '财务', '法务'].includes(employeeRole)) {
    next('/collaborations')
    return
  }
  next()
})

export default router
