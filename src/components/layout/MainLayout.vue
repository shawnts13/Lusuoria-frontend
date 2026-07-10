<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible width="220" style="background:#001529">
      <div class="logo">
        <span v-if="!collapsed">🌟 Lusuoria</span>
        <span v-else>L</span>
      </div>

      <a-menu theme="dark" mode="inline" :selected-keys="[currentRoute]" @click="handleMenuClick">
        <!-- 数据看板仅 ADMIN / AUDITOR 可见 -->
        <a-menu-item v-if="authStore.isAdmin || authStore.isAuditor" key="/dashboard">
          <template #icon><DashboardOutlined /></template>数据看板
        </a-menu-item>
        <a-menu-item key="/collaborations">
          <template #icon><SolutionOutlined /></template>红人合作跟踪
        </a-menu-item>
        <!-- 红人结款：严格按员工角色（管理层/财务/法务）可见，跟 ADMIN/AUDITOR 等 role 无关 -->
        <a-menu-item v-if="authStore.canAccessPayments" key="/payments">
          <template #icon><PayCircleOutlined /></template>红人结款
        </a-menu-item>

        <!-- 待处理：ADMIN 能看审批列表，"管理层"员工角色能看进度提醒 -->
        <a-menu-item v-if="authStore.canAccessPending" key="/pending">
          <template #icon><ExclamationCircleOutlined /></template>待处理
        </a-menu-item>

        <a-menu-divider />

        <!-- 品牌方管理：严格按员工角色，只有"管理层"可见（2026-07 起） -->
        <a-menu-item v-if="authStore.canAccessBrands" key="/brands">
          <template #icon><ShopOutlined /></template>品牌方管理
        </a-menu-item>
        <!-- 审计员隐藏以下基础数据管理 -->
        <template v-if="!authStore.isAuditor">
          <a-menu-item key="/influencers">
            <template #icon><TeamOutlined /></template>红人管理
          </a-menu-item>
        </template>

        <!-- 员工管理仅 ADMIN 可见 -->
        <a-menu-item v-if="authStore.isAdmin" key="/employees">
          <template #icon><UserOutlined /></template>员工管理
        </a-menu-item>

        <!-- 汇率维护仅 ADMIN 可见 -->
        <a-menu-item v-if="authStore.isAdmin" key="/exchange-rates">
          <template #icon><DollarOutlined /></template>汇率维护
        </a-menu-item>

        <!-- 账号管理仅 ADMIN 可见 -->
        <a-menu-item v-if="authStore.isAdmin" key="/users">
          <template #icon><SafetyOutlined /></template>账号管理
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="site-header">
        <div class="header-left">
          <MenuFoldOutlined v-if="!collapsed" class="trigger" @click="collapsed = true" />
          <MenuUnfoldOutlined v-else class="trigger" @click="collapsed = false" />
          <span class="page-name">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <!-- 角色标签 -->
          <a-tag :color="roleColor" style="margin-right:12px">{{ roleLabel }}</a-tag>

          <a-dropdown>
            <span class="user-info">
              <UserOutlined />
              {{ authStore.displayName || authStore.username }}
              <DownOutlined style="font-size:11px; margin-left:4px" />
            </span>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="showChangePwd = true">
                  <LockOutlined /> 修改密码
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item @click="handleLogout">
                  <LogoutOutlined /> 退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content class="main-content">
        <!-- 版本更新提示条 -->
        <a-alert v-if="showVersionBanner" type="info" show-icon
          :message="`系统已更新（版本 ${versionInfo.version}，发布于 ${versionInfo.time}），缓存已自动清除。如遇显示异常，可手动清除缓存后刷新页面。`"
          style="margin-bottom:12px;border-radius:6px"
          :after-close="() => showVersionBanner = false"
          closable>
          <template #action>
            <a-button size="small" @click="handleClearCache">手动清除缓存</a-button>
          </template>
        </a-alert>
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>

  <!-- 修改密码弹窗 -->
  <a-modal v-model:open="showChangePwd" title="修改密码" :confirm-loading="changePwdLoading"
    @ok="handleChangePwd" @cancel="showChangePwd = false" :destroy-on-close="true">
    <a-form ref="pwdFormRef" :model="pwdForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
      <a-form-item label="新密码" name="newPassword"
        :rules="[{ required: true, min: 6, message: '新密码至少6位' }]">
        <a-input-password v-model:value="pwdForm.newPassword" />
      </a-form-item>
      <a-form-item label="确认新密码" name="confirmPassword"
        :rules="[{ required: true, message: '请确认新密码' },
                 { validator: validateConfirmPwd }]">
        <a-input-password v-model:value="pwdForm.confirmPassword" />
      </a-form-item>
    </a-form>
  </a-modal>

  <!-- "进度提醒"登录弹窗：仅"管理层"员工角色触发，组件内部自行判断是否需要弹出 -->
  <ProgressReminderPopup />
</template>

<script setup>
import { ref, reactive, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DashboardOutlined, PayCircleOutlined,
  SolutionOutlined, DollarOutlined, ExclamationCircleOutlined,
  ShopOutlined, TeamOutlined, UserOutlined, SafetyOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
  DownOutlined, LogoutOutlined, LockOutlined
} from '@ant-design/icons-vue'
import { useAuthStore, clearAllCache } from '../../store/auth'
import { userApi } from '../../api/index'
import ProgressReminderPopup from '../../pages/pending/ProgressReminderPopup.vue'

const router    = useRouter()
const route     = useRoute()
const authStore = useAuthStore()

// 版本更新提示
const versionInfo = inject('versionInfo', { updated: false, version: '', time: '' })
const showVersionBanner = ref(versionInfo.updated)

function handleClearCache() {
  clearAllCache()
  message.success('缓存已清除，页面即将刷新')
  setTimeout(() => window.location.reload(), 800)
}
const collapsed = ref(false)

const showChangePwd    = ref(false)
const changePwdLoading = ref(false)
const pwdFormRef       = ref()
const pwdForm          = reactive({ newPassword: '', confirmPassword: '' })

const currentRoute = computed(() => '/' + route.path.split('/')[1])

const pageTitleMap = {
  '/dashboard':   '数据看板',
  '/payments':    '红人结款管理',
  '/pending':     '待处理',
  '/brands':      '品牌方管理',
  '/influencers': '红人管理',
  '/employees':   '员工管理',
  '/users':       '账号管理'
}
const pageTitle = computed(() => pageTitleMap[currentRoute.value] || 'Lusuoria')

const roleLabel = computed(() => {
  const map = { ADMIN: '管理员', STAFF: '普通员工', AUDITOR: '财务', GUEST: '访客' }
  return map[authStore.role] || authStore.role
})
const roleColor = computed(() => {
  const map = { ADMIN: 'red', STAFF: 'blue', AUDITOR: 'orange', GUEST: 'default' }
  return map[authStore.role] || 'default'
})

function handleMenuClick({ key }) { router.push(key) }
function handleLogout() { authStore.logout(); router.push('/login') }

function validateConfirmPwd(_, value) {
  if (value && value !== pwdForm.newPassword) {
    return Promise.reject('两次输入的密码不一致')
  }
  return Promise.resolve()
}

async function handleChangePwd() {
  try { await pwdFormRef.value.validate() } catch { return }
  changePwdLoading.value = true
  try {
    await userApi.changePassword({ newPassword: pwdForm.newPassword })
    message.success('密码修改成功，请重新登录')
    showChangePwd.value = false
    authStore.logout()
    router.push('/login')
  } finally {
    changePwdLoading.value = false
  }
}
</script>

<style scoped>
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.site-header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  height: 64px;
  line-height: 64px;
}
.header-left { display: flex; align-items: center; gap: 16px; }
.trigger { font-size: 18px; cursor: pointer; color: #555; transition: color 0.2s; }
.trigger:hover { color: #1677ff; }
.page-name { font-size: 16px; font-weight: 600; color: #1a1a1a; }
.header-right { display: flex; align-items: center; }
.user-info {
  cursor: pointer;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #555;
  border-radius: 4px;
  transition: background 0.2s;
}
.user-info:hover { background: #f5f5f5; }
.main-content { margin: 24px; min-height: calc(100vh - 112px); }
</style>
