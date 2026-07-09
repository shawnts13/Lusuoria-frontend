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
      { path: 'payments',    name: 'Payments',    component: () => import('./pages/payment/PaymentListPage.vue') },
      {
        path: 'pending',
        name: 'Pending',
        component: () => import('./pages/pending/PendingListPage.vue'),
        meta: { adminOnly: true }
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
  next()
})

export default router
