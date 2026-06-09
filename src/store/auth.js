import { defineStore } from 'pinia'
import { authApi } from '../api/index'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token:       localStorage.getItem('token')       || null,
    username:    localStorage.getItem('username')    || null,
    displayName: localStorage.getItem('displayName') || null,
    role:        localStorage.getItem('role')        || null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin:    (state) => state.role === 'ADMIN',
    isStaff:    (state) => state.role === 'STAFF',
    isAuditor:  (state) => state.role === 'AUDITOR',
    isGuest:    (state) => state.role === 'GUEST',

    // 可写操作：ADMIN 和 STAFF
    canWrite: (state) => state.role === 'ADMIN' || state.role === 'STAFF',

    // 老板审核：仅 ADMIN
    canApprove: (state) => state.role === 'ADMIN',

    // 账号管理：仅 ADMIN
    canManageUsers: (state) => state.role === 'ADMIN',

    /**
     * 可查看敏感财务字段（收入、利润、提成比例等）
     * 仅 ADMIN（老板）和 AUDITOR（会计）
     * STAFF（普通员工）和 GUEST（访客）不可见
     */
    canViewFinancials: (state) => state.role === 'ADMIN' || state.role === 'AUDITOR',

    /**
     * 可修改员工提成比例、奖金字段
     * 仅 ADMIN
     */
    canEditCommission: (state) => state.role === 'ADMIN'
  },

  actions: {
    async login(username, password) {
      const res = await authApi.login({ username, password })
      this.token       = res.data.token
      this.username    = res.data.username
      this.displayName = res.data.displayName
      this.role        = res.data.role
      localStorage.setItem('token',       this.token)
      localStorage.setItem('username',    this.username)
      localStorage.setItem('displayName', this.displayName)
      localStorage.setItem('role',        this.role)
    },
    logout() {
      this.token = this.username = this.displayName = this.role = null
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('displayName')
      localStorage.removeItem('role')
    }
  }
})
