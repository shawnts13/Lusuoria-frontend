/**
 * 有限并发请求池（2026-07 新增，年度报告/双月对比用）。
 *
 * 这两个报告页面一次加载要发几十到上百个下钻请求，Render 免费层数据库连接池只有3个连接，
 * 不能用 Promise.all 一次性把所有请求全部同时发出去，否则会打满连接池导致排队/超时。
 * 用这个按批次控制并发数（默认4个一批）。
 *
 * @param tasks 一组"无参数、返回 Promise"的函数（不要传已经发出去的 Promise，要传函数，
 *              这样才能真正控制"什么时候发起下一个请求"，而不是全部立刻发出去再等待）
 * @param concurrency 同时进行的最大请求数
 * @returns 按 tasks 顺序对应的结果数组；某个请求失败时对应位置是 null，不影响其他请求
 */
export function runLimited(tasks, concurrency = 4) {
  return new Promise((resolve) => {
    const results = new Array(tasks.length)
    if (tasks.length === 0) {
      resolve(results)
      return
    }
    let nextIndex = 0
    let finishedCount = 0

    function runNext() {
      const i = nextIndex++
      if (i >= tasks.length) return
      Promise.resolve()
        .then(() => tasks[i]())
        .then(r => { results[i] = r })
        .catch(() => { results[i] = null })
        .finally(() => {
          finishedCount++
          if (finishedCount === tasks.length) {
            resolve(results)
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
