import { defineStore } from 'pinia'
import { authApi } from '../api/index'

// 每次部署时递增此版本号，并更新发布时间
// 用户下次访问页面时会看到"版本已更新"提示
export const APP_VERSION = '1.201.1'
export const APP_VERSION_TIME = '2026-08-17 05:47'

const VERSION_KEY = 'lusuoria_app_version'

/**
 * 检查版本号，若有更新则清除所有缓存
 * 返回 { updated, version, time } —— updated 为 true 表示版本发生了变化（需要提示用户）
 */
export function checkAndClearCache() {
  const stored = localStorage.getItem(VERSION_KEY)
  const updated = stored !== null && stored !== APP_VERSION
  if (stored !== APP_VERSION) {
    clearAllCache()
    localStorage.setItem(VERSION_KEY, APP_VERSION)
  }
  return {
    updated,
    version: APP_VERSION,
    time: APP_VERSION_TIME
  }
}

export function clearAllCache() {
  // 清除 sessionStorage（useOptions 缓存等）
  sessionStorage.clear()
  // 清除 localStorage 里的缓存（保留登录状态）
  const keep = ['token', 'username', 'displayName', 'role', 'isManagement', 'employeeRole', 'employeeId', VERSION_KEY]
  Object.keys(localStorage).forEach(key => {
    if (!keep.includes(key)) localStorage.removeItem(key)
  })
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token:       localStorage.getItem('token')       || null,
    username:    localStorage.getItem('username')    || null,
    displayName: localStorage.getItem('displayName') || null,
    role:        localStorage.getItem('role')        || null,
    // "进度提醒"功能受众：登录账号关联的员工角色是不是"管理层"，跟 role（ADMIN/STAFF/...）无关
    isManagement: localStorage.getItem('isManagement') === 'true',
    // "红人结款"模块受众：登录账号关联的员工角色原值（管理层/财务/法务/...），跟 role 无关
    employeeRole: localStorage.getItem('employeeRole') || null,
    // 登录账号关联的员工 id（未关联员工时为 null），供"新建红人合作跟踪时把项目负责人默认
    // 填成自己"这类场景使用
    employeeId: localStorage.getItem('employeeId') ? Number(localStorage.getItem('employeeId')) : null
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
    // "数据看板"页面：原来是 ADMIN/AUDITOR 都能看，2026-08 起法务账号（员工角色="法务"，
    // SysUser 角色也是 AUDITOR）单独排除掉——数据看板展示的是利润/提成这类经营数据，
    // 法务的职责跟这个不相关，不应该顺带因为 AUDITOR 这个只读权限档位就看到
    canAccessDashboard: (state) => state.role === 'ADMIN' || (state.role === 'AUDITOR' && state.employeeRole !== '法务'),
    // "基础"财务字段（红人成本/客户合作价格/已到账金额等）：除 GUEST 外都能看，
    // 比 canViewFinancials 宽松——那个仍然只有 ADMIN/AUDITOR 能看利润/提成这类真正敏感的字段
    canViewBaselineFinancials: (state) => state.role !== 'GUEST',
    canEditCommission: (state) => state.role === 'ADMIN',
    // "红人合作跟踪"里汇率/其他外部成本（人民币）/外部成本备注这几个记账细节字段：跟后端
    // ProjectFieldVisibility 的 FULL 层级判定保持一致——ADMIN/AUDITOR，或员工角色是
    // "财务"/"管理层"的 STAFF 账号；项目负责人/执行人员一律看不到（无论是不是自己负责的项目）
    canViewCostBookkeeping: (state) =>
      state.role === 'ADMIN' || state.role === 'AUDITOR' || ['管理层', '财务'].includes(state.employeeRole),
    // "待处理"页面：2026-07 起对所有非访客角色开放（提醒中心 + 处理结果通知），
    // 具体能看到哪些内容由页面内部按角色分区展示 + 后端接口各自按身份过滤
    canAccessPending: (state) => state.role !== 'GUEST',
    // "红人结款"模块：严格按员工角色判断，跟 role（ADMIN/AUDITOR/...）无关——
    // 没有关联"管理层/财务/法务"这三个员工角色之一的账号，完全看不到这个模块
    canAccessPayments: (state) => ['管理层', '财务', '法务'].includes(state.employeeRole),
    canManagePayments: (state) => state.employeeRole === '管理层',
    // "上传发票"（公对公发票，2026-08 新增）：管理层/财务都能做，跟 canManagePayments（仅管理层）不同
    canUploadPaymentReceipt: (state) => ['管理层', '财务'].includes(state.employeeRole),
    // "品牌方/团队管理"页面能不能进：2026-08 起从"仅管理层"放宽给全部6个员工角色（项目负责人/
    // 执行人员/管理层/财务/法务/IT后勤）都能进去查看，跟路由守卫（router.js ALL_EMPLOYEE_ROLES）
    // 保持一致；MainLayout 菜单项的显隐也用这个。品牌方/团队本身的新建/编辑/删除这几个写操作
    // 用更严格的 canManageBrands（仅管理层）
    canAccessBrands: (state) =>
      ['项目负责人', '执行人员', '管理层', '财务', '法务', 'IT后勤'].includes(state.employeeRole),
    // 品牌方/团队本身的新建/编辑/删除：严格按员工角色判断，只有"管理层"能操作（2026-07 起）
    canManageBrands: (state) => state.employeeRole === '管理层',
    // "导入历史"删除记录按钮：只有"管理层"能看到并操作，供清理误操作/测试产生的脏历史记录用
    canDeleteImportBatch: (state) => state.employeeRole === '管理层',
    // "红人合作跟踪"里，视频项目进度流转到"已加入客户未结算列表"/"客户已结算"这两个财务专属
    // 终态：跟后端 EmployeeRoleUtil.canSetSettlementProgressExtraRole() 保持一致——ADMIN，
    // 或员工角色是"财务"/"管理层"的 STAFF 账号；2026-08 起放宽到"项目负责人"/"执行人员"/
    // "IT后勤"也能操作（Shawn 反馈）；其余角色（基础权限）只能流转到"已发布（未结算）"和
    // "折损"这两个终态
    canSetFinanceSettlementProgress: (state) => state.role === 'ADMIN'
      || ['财务', '管理层', '项目负责人', '执行人员', 'IT后勤'].includes(state.employeeRole),
    // 新建"红人合作跟踪"时，项目负责人默认填成自己的资格：员工角色是"项目负责人"或"管理层"，
    // 且账号确实关联了员工（没关联员工的账号，比如纯 ADMIN 账号，不会被当成某个具体员工）
    canDefaultAsProjectManager: (state) =>
      state.employeeId != null && ['项目负责人', '管理层'].includes(state.employeeRole),
    // "员工管理"页面：2026-07 起放开给"管理层" STAFF 账号（跟 ADMIN 一样看全部、能删除），
    // 执行人员费率梯度那块在这个页面里代表"管理层"维护
    canAccessEmployeeManagement: (state) => state.role === 'ADMIN' || state.employeeRole === '管理层',
    // "执行人员管理"页面：2026-07 新增，仅"项目负责人"角色可见，只维护自己那份执行人员费率梯度
    canAccessExecutorPayRateManagement: (state) => state.employeeRole === '项目负责人',
    // "工资单"模块的管理视角（看全体员工、设置奖金、确认）：ADMIN 或员工角色="管理层"，
    // 跟"员工管理"页面的访问权限判定（canAccessEmployeeManagement）保持一致
    canManagePayslips: (state) => state.role === 'ADMIN' || state.employeeRole === '管理层',
    // "品牌方/红人团队管理"-"管理团队"里"上传合同"（团队级合同，2026-08 新增，替代原来挂在
    // 红人身上的"已签署合同"）的维护权限：纯按 Employee.role 判断，项目负责人/执行人员/法务/
    // 管理层/IT后勤这5个角色能上传/编辑/删除，不含财务（财务管钱不管合同文件），
    // 跟后端 EmployeeRoleUtil.canManageTeamContracts() 保持一致
    canManageTeamContracts: (state) =>
      ['项目负责人', '执行人员', '法务', '管理层', 'IT后勤'].includes(state.employeeRole),
    // "红人合作跟踪"里"批量计算执行成本"按钮（2026-08 新增）：项目负责人/执行人员/管理层
    // 三种员工角色可见，跟后端 recomputeExecutorCostsScoped() 允许的范围一致——管理层等同于
    // "特殊的项目负责人"（看全部），项目负责人/执行人员各自只能算自己名下/自己执行的那部分，
    // 具体范围判断在后端做，这里只负责按钮的显隐
    canRecomputeOwnExecutorCosts: (state) => ['项目负责人', '执行人员', '管理层'].includes(state.employeeRole)
  },

  actions: {
    async login(username, password) {
      const res = await authApi.login({ username, password })
      this.token        = res.data.token
      this.username     = res.data.username
      this.displayName  = res.data.displayName
      this.role         = res.data.role
      this.isManagement = !!res.data.isManagement
      this.employeeRole = res.data.employeeRole || null
      this.employeeId   = res.data.employeeId ?? null
      localStorage.setItem('token',        this.token)
      localStorage.setItem('username',     this.username)
      localStorage.setItem('displayName',  this.displayName)
      localStorage.setItem('role',         this.role)
      localStorage.setItem('isManagement', String(this.isManagement))
      if (this.employeeRole) localStorage.setItem('employeeRole', this.employeeRole)
      else localStorage.removeItem('employeeRole')
      if (this.employeeId != null) localStorage.setItem('employeeId', String(this.employeeId))
      else localStorage.removeItem('employeeId')
    },
    logout() {
      this.token = this.username = this.displayName = this.role = null
      this.isManagement = false
      this.employeeRole = null
      this.employeeId = null
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('displayName')
      localStorage.removeItem('role')
      localStorage.removeItem('isManagement')
      localStorage.removeItem('employeeRole')
      localStorage.removeItem('employeeId')
    }
  }
})
