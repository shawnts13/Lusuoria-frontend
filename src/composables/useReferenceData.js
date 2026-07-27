import { brandApi, influencerTeamApi, influencerApi, employeeApi } from '../api/index'

// 品牌方/红人团队/红人简单列表/员工列表这几个"下拉筛选用的引用数据"，之前每个页面
// （红人合作跟踪、红人需求管理、红人结款、账号管理...）各自在 onMounted 里独立请求一遍，
// 页面之间切换来回时会反复重新拉取同一批数据，明显拖慢"切换模块"的体验。
// 这里参考 useOptions.js 的思路加一层模块级内存缓存——只用于纯下拉/筛选用途的引用数据，
// 不用于页面自己的主列表（比如品牌方管理页自己的品牌方列表、员工管理页自己的员工列表，
// 那些页面编辑保存后需要立刻看到最新结果，必须绕开缓存直接调用原始 API，不要在那些地方用这个）。
// TTL 特意设得比 useOptions 短很多（分钟级而不是小时级）：这批数据比"选项配置"更新更频繁
// （随时可能有人新增品牌方/团队/员工），缓存太久容易导致"我刚加的东西怎么在别的模块看不到"，
// 短 TTL 能在切换模块的这几分钟内消除重复请求，又能很快自愈，不需要每个编辑入口都手动清缓存。
const CACHE_TTL_MS = 60 * 1000 // 60秒

function makeCachedLoader(fetcher) {
    let data = null
    let time = 0
    return async function load() {
        const now = Date.now()
        if (data && now - time < CACHE_TTL_MS) return data
        const res = await fetcher()
        data = res.data || []
        time = now
        return data
    }
}

const loadBrandsCached      = makeCachedLoader(() => brandApi.list())
const loadTeamsCached       = makeCachedLoader(() => influencerTeamApi.list())
const loadInfluencersCached = makeCachedLoader(() => influencerApi.simple())
const loadEmployeesCached   = makeCachedLoader(() => employeeApi.list())

/**
 * 纯下拉/筛选用途的引用数据，带 60 秒内存缓存。用法：
 *   const { loadBrands, loadTeams, loadInfluencersSimple, loadEmployees } = useReferenceData()
 *   const [b, t] = await Promise.all([loadBrands(), loadTeams()])
 *   brands.value = b; teams.value = t
 */
export function useReferenceData() {
    return {
        loadBrands: loadBrandsCached,
        loadTeams: loadTeamsCached,
        loadInfluencersSimple: loadInfluencersCached,
        loadEmployees: loadEmployeesCached
    }
}
