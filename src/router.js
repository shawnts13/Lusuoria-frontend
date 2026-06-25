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
      { path: '', redirect: '/projects' },  // 默认落地页改为项目列表，所有角色都能看
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('./pages/dashboard/DashboardPage.vue'),
        meta: { financialOnly: true }       // 仅 ADMIN / AUDITOR
      },
      { path: 'projects',    name: 'Projects',    component: () => import('./pages/project/ProjectListPage.vue') },
      { path: 'collaborations', name: 'Collaborations', component: () => import('./pages/collaboration/CollaborationListPage.vue') },
      { path: 'payments',    name: 'Payments',    component: () => import('./pages/payment/PaymentListPage.vue') },
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
  { path: '/:pathMatch(.*)*', redirect: '/projects' }
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
    next('/projects')
    return
  }
  // 数据看板：仅 ADMIN / AUDITOR
  if (to.meta.financialOnly && role !== 'ADMIN' && role !== 'AUDITOR') {
    next('/projects')
    return
  }
  // 账号管理：仅 ADMIN
  if (to.meta.adminOnly && role !== 'ADMIN') {
    next('/projects')
    return
  }
  next()
})

export default router
