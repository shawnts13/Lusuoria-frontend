import { defineStore } from 'pinia'
import { authApi } from '../api/index'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token:    localStorage.getItem('token')    || null,
    username: localStorage.getItem('username') || null,
    realName: localStorage.getItem('realName') || null,
    role:     localStorage.getItem('role')     || null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin:    (state) => state.role === 'ADMIN',
    isStaff:    (state) => state.role === 'STAFF',
    isAuditor:  (state) => state.role === 'AUDITOR',
    // 可写操作：ADMIN 和 STAFF
    canWrite:   (state) => state.role === 'ADMIN' || state.role === 'STAFF',
    // 老板审核：仅 ADMIN
    canApprove: (state) => state.role === 'ADMIN',
    // 账号管理：仅 ADMIN
    canManageUsers: (state) => state.role === 'ADMIN'
  },

  actions: {
    async login(username, password) {
      const res = await authApi.login({ username, password })
      this.token    = res.data.token
      this.username = res.data.username
      this.realName = res.data.realName
      this.role     = res.data.role
      localStorage.setItem('token',    this.token)
      localStorage.setItem('username', this.username)
      localStorage.setItem('realName', this.realName)
      localStorage.setItem('role',     this.role)
    },
    logout() {
      this.token = this.username = this.realName = this.role = null
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('realName')
      localStorage.removeItem('role')
    }
  }
})
