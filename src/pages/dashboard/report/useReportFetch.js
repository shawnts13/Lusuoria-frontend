/**
 * 有限并发请求池（2026-07 新增，年度报告/双月对比用）。
 *
 * 这两个报告页面一次加载要发几十到上百个下钻请求，Render 免费层数据库连接池只有3个连接，
 * 不能用 Promise.all 一次性把所有请求全部同时发出去，否则会打满连接池导致排队/超时。
 * 用这个按批次控制并发数（默认3个一批，跟连接池大小对齐）。
 *
 * 2026-07-30 补充：Render 免费实例闲置一段时间会休眠，报告页面刚打开时如果实例正在冷启动，
 * 前几个请求经常直接超时/连接失败——单纯"失败就放弃"会导致部分图表长期空白，用户体验是
 * "刷了好几次才有数据"。这里加了自动重试（默认2次，间隔递增），让实例冷启动这类瞬时性失败
 * 能自己恢复，不需要用户手动刷新页面。
 *
 * @param tasks 一组"无参数、返回 Promise"的函数（不要传已经发出去的 Promise，要传函数，
 *              这样才能真正控制"什么时候发起下一个请求"，而不是全部立刻发出去再等待）
 * @param concurrency 同时进行的最大请求数
 * @param retries 单个请求失败后的最大重试次数
 * @returns { results, failedCount } —— results 按 tasks 顺序对应，某个请求重试耗尽后仍失败时
 *          对应位置是 null；failedCount 是最终失败（重试耗尽）的请求数，供页面显示"部分数据未
 *          加载成功"提示用
 */
export function runLimited(tasks, concurrency = 3, retries = 2) {
  return new Promise((resolve) => {
    const results = new Array(tasks.length)
    if (tasks.length === 0) {
      resolve({ results, failedCount: 0 })
      return
    }
    let nextIndex = 0
    let finishedCount = 0
    let failedCount = 0

    function sleep(ms) {
      return new Promise(r => setTimeout(r, ms))
    }

    async function runWithRetry(task) {
      let lastError = null
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await sleep(800 * attempt) // 800ms、1600ms 递增间隔
        try {
          return await task()
        } catch (e) {
          lastError = e
        }
      }
      throw lastError
    }

    function runNext() {
      const i = nextIndex++
      if (i >= tasks.length) return
      runWithRetry(tasks[i])
        .then(r => { results[i] = r })
        .catch(() => { results[i] = null; failedCount++ })
        .finally(() => {
          finishedCount++
          if (finishedCount === tasks.length) {
            resolve({ results, failedCount })
          } else {
            runNext()
          }
        })
    }

    for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
      runNext()
    }
  })
}

/**
 * 服务器"预热"（2026-07-30 新增）：Render 免费实例闲置一段时间会休眠，冷启动可能要几十秒。
 * 之前的做法是直接把几十个下钻请求全部打过去，冷启动期间大量超时失败，失败后只能提示用户
 * "刷新页面重试"——但刷新页面本质上就是把同样几十个请求原样再打一遍，并不能真正解决"服务器
 * 还没醒"这个问题，用户体验是反复刷新、反复失败。
 *
 * 改成：真正发年度报告/双月对比那一大批请求之前，先反复 ping 一个很轻量的接口
 * （/actuator/health，不查数据库），直到它成功或者等够 maxWaitMs——这样后面的大批请求
 * 发出去的时候服务器已经是醒着的，不需要事后靠重试/刷新来补救。
 *
 * @param pingFn 一个轻量级探测请求（如 systemApi.health()）
 * @returns 服务器是否在 maxWaitMs 内醒了（超时仍然会 resolve false，调用方决定要不要继续发正式请求——
 *          等太久也不该无限卡住用户，实在没醒也让后面的自动重试机制兜底）
 */
export async function warmUpBackend(pingFn, { maxWaitMs = 60000, intervalMs = 3000 } = {}) {
  const start = Date.now()
  while (true) {
    try {
      await pingFn()
      return true
    } catch (e) {
      if (Date.now() - start >= maxWaitMs) return false
      await new Promise(r => setTimeout(r, intervalMs))
    }
  }
}
