import axios from 'axios'
import { message } from 'ant-design-vue'
import router from '../router'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor - attach JWT token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = 'Bearer ' + token
  }
  return config
})

// 业务特殊码：需要调用方自行处理，不在拦截器里弹错误
// 4090 - 合作跟踪订单ID变更需二次确认
// 4091 - 合作跟踪去重命中提示
const PASS_THROUGH_CODES = [4090, 4091]

// Response interceptor - handle errors globally
let sessionExpiredHandled = false

http.interceptors.response.use(
  response => {
    const data = response.data
    if (data.code && data.code !== 200) {
      // 特殊业务码：直接把数据交给调用方处理，不弹全局错误
      if (PASS_THROUGH_CODES.includes(data.code)) {
        return data
      }
      message.error(data.message || '操作失败')
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  error => {
    // silent：批量并发请求（年度报告/双月对比一次发几十个下钻请求）专用——单个请求失败/超时
    // 不该弹一次全局 Toast，Render 免费实例冷启动时一次性失败十几个会刷屏报错。这类调用方
    // 自己（report/useReportFetch.js 的重试机制、页面里的"部分数据未加载成功"提示）负责
    // 处理失败，401 登录过期除外——不管是不是静音请求都要正常跳转登录页
    const silent = error.config?.silent === true
    if (error.response) {
      const status = error.response.status
      if (status === 401) {
        // 一次页面生命周期内只处理一次，避免同时发出的多个请求都401时反复弹窗/反复跳转
        if (!sessionExpiredHandled) {
          sessionExpiredHandled = true
          localStorage.removeItem('token')
          localStorage.removeItem('username')
          localStorage.removeItem('displayName')
          localStorage.removeItem('role')
          message.error('登录已过期，请重新登录')
          router.push('/login')
        }
      } else if (!silent) {
        if (status === 403) {
          message.error('无权限执行此操作')
        } else if (status === 400) {
          const msg = error.response.data?.message || '请求参数错误'
          message.error(msg)
        } else {
          message.error('服务器错误，请稍后重试')
        }
      }
    } else if (!silent) {
      message.error('网络连接失败')
    }
    return Promise.reject(error)
  }
)

export default http
