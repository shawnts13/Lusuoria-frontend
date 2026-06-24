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
    if (error.response) {
      const status = error.response.status
      if (status === 401) {
        localStorage.removeItem('token')
        router.push('/login')
        message.error('登录已过期，请重新登录')
      } else if (status === 403) {
        message.error('无权限执行此操作')
      } else if (status === 400) {
        const msg = error.response.data?.message || '请求参数错误'
        message.error(msg)
      } else {
        message.error('服务器错误，请稍后重试')
      }
    } else {
      message.error('网络连接失败')
    }
    return Promise.reject(error)
  }
)

export default http
