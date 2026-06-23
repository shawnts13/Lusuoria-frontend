import { defineStore } from 'pinia'
import { authApi } from '../api/index'

// 每次部署时递增此版本号，自动触发旧缓存清除
// 用户下次访问页面时会看到"版本已更新"提示
export const APP_VERSION = '1.0.2'

const VERSION_KEY = 'lusuoria_app_version'

/**
 * 检查版本号，若有更新则清除所有缓存
 * 返回 true 表示版本发生了变化（需要提示用户）
 */
export function checkAndClearCache() {
  const stored = localStorage.getItem(VERSION_KEY)
  if (stored !== APP_VERSION) {
    clearAllCache()
    localStorage.setItem(VERSION_KEY, APP_VERSION)
    return stored !== null  // 首次访问不提示，只有版本变化才提示
  }
  return false
}

export function clearAllCache() {
  // 清除 sessionStorage（useOptions 缓存等）
  sessionStorage.clear()
  // 清除 localStorage 里的缓存（保留登录状态）
  const keep = ['token', 'username', 'displayName', 'role', VERSION_KEY]
  Object.keys(localStorage).forEach(key => {
    if (!keep.includes(key)) localStorage.removeItem(key)
  })
}

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

    canWrite:          (state) => state.role === 'ADMIN' || state.role === 'STAFF',
    canApprove:        (state) => state.role === 'ADMIN',
    canManageUsers:    (state) => state.role === 'ADMIN',
    canViewFinancials: (state) => state.role === 'ADMIN' || state.role === 'AUDITOR',
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
