/**
 * 统一日期/时间格式化工具。
 *
 * 这个系统是给中国用户用的，所有时间统一按北京时间（Asia/Shanghai，UTC+8）展示，
 * 不管使用者（包括开发者本人）实际所在地区在哪个时区，都不应该受浏览器本地时区影响。
 *
 * 后端传给前端的时间戳本身是精确的时刻（数值毫秒数），这里只是"用哪个时区把这个时刻
 * 转成年月日/时分"来显示，所以必须显式指定 timeZone: 'Asia/Shanghai'，
 * 不能用 new Date(d).getFullYear() 这种依赖运行环境本地时区的写法。
 */

/** 格式化成 "YYYY-MM-DD"（北京时间） */
export function formatDate(d) {
  if (!d) return ''
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(d))
  const map = {}
  for (const p of parts) map[p.type] = p.value
  return `${map.year}-${map.month}-${map.day}`
}

/** 格式化成 "YYYY-MM-DD HH:mm"（北京时间） */
export function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).replace(/\//g, '-')
}

/** 格式化成 "YYYY-MM-DD HH:mm:ss"（北京时间） */
export function formatDateTimeFull(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(/\//g, '-')
}
