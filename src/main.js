import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router, { PENDING_NAV_KEY } from './router'
import './styles/global.scss'
import { checkAndClearCache } from './store/auth'

// 应用启动时检查版本，版本有更新则自动清除旧缓存
const versionInfo = checkAndClearCache()

// Vite 自己的"预加载模块失败"兜底事件（不经过路由导航触发的懒加载失败，比如浏览器空闲时
// 预取下一步可能用到的模块），跟 router.js 里 router.onError 处理的是同一类"部署后旧哈希
// 文件已被删除"的问题，只是没有路由上下文，直接整页刷新即可，见 router.js 顶部注释
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)

// 把版本信息挂到全局，供 MainLayout 显示提示
app.provide('versionInfo', versionInfo)

app.mount('#app')

// 因"动态导入模块失败"整页刷新之前，router.js 记下了用户本来要去的路径，这里刷新完成、
// 应用重新挂载后自动跳转过去，不需要用户自己再点一次
const pendingNav = sessionStorage.getItem(PENDING_NAV_KEY)
if (pendingNav) {
  sessionStorage.removeItem(PENDING_NAV_KEY)
  router.replace(pendingNav)
}
