import { ref } from 'vue'
import http from '../api/http'

const CACHE_KEY    = 'lusuoria_options_cache'
const CACHE_TTL_MS = 4 * 60 * 60 * 1000  // 4小时

// 模块级缓存（内存），避免同一页面多次调用重复请求
let _memCache = null
let _memCacheTime = 0

/**
 * 获取所有下拉选项，自动缓存4小时
 * 返回的 options 是响应式的，可直接在模板里用
 *
 * 使用示例：
 *   const { getOptions, loaded } = useOptions()
 *   const countries = computed(() => getOptions('country'))
 */
export function useOptions() {
    const loaded  = ref(false)
    const _data   = ref({})

    async function load() {
        const now = Date.now()

        // 1. 先查内存缓存
        if (_memCache && now - _memCacheTime < CACHE_TTL_MS) {
            _data.value = _memCache
            loaded.value = true
            return
        }

        // 2. 再查 sessionStorage
        try {
            const cached = sessionStorage.getItem(CACHE_KEY)
            if (cached) {
                const { data, time } = JSON.parse(cached)
                if (now - time < CACHE_TTL_MS) {
                    _memCache     = data
                    _memCacheTime = time
                    _data.value   = data
                    loaded.value  = true
                    return
                }
            }
        } catch (e) { /* ignore */ }

        // 3. 请求接口
        try {
            const res = await http.get('/api/config/options/all')
            const data = res.data || {}
            _memCache     = data
            _memCacheTime = now
            _data.value   = data
            loaded.value  = true
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, time: now }))
        } catch (e) {
            console.error('Failed to load options:', e)
            loaded.value = true
        }
    }

    /**
     * 获取某类选项数组，格式：[{ value, label }, ...]
     */
    function getOptions(category) {
        return _data.value[category] || []
    }

    /**
     * 获取某类选项的 value 数组（用于 Excel 下拉验证）
     */
    function getValues(category) {
        return getOptions(category).map(o => o.label)
    }

    /**
     * 根据 value 查 label
     */
    function getLabel(category, value) {
        const opt = getOptions(category).find(o => o.value === value)
        return opt ? opt.label : value
    }

    /**
     * 主动清除缓存（管理员修改选项后调用）
     */
    function clearCache() {
        _memCache = null
        _memCacheTime = 0
        try { sessionStorage.removeItem(CACHE_KEY) } catch (e) { /* ignore */ }
    }

    load()

    return { loaded, getOptions, getValues, getLabel, clearCache }
}
