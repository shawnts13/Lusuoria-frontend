import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './router'
import './styles/global.scss'
import { checkAndClearCache } from './store/auth'

// 应用启动时检查版本，版本有更新则自动清除旧缓存
const versionUpdated = checkAndClearCache()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)

// 把版本更新标志挂到全局，供 MainLayout 显示提示
app.provide('versionUpdated', versionUpdated)

app.mount('#app')
