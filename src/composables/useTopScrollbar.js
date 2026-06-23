import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

/**
 * 给 Ant Design Vue 的 a-table（带横向滚动 :scroll="{x:...}"）
 * 在表格上方加一条同步联动的横向滚动条
 *
 * 使用方式：
 * <div ref="tableWrapperRef" class="table-card">
 *   <div ref="topScrollRef" class="top-scrollbar" @scroll="onTopScroll">
 *     <div :style="{ width: scrollWidth + 'px', height: '1px' }"></div>
 *   </div>
 *   <a-table ... />
 * </div>
 *
 * const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure } = useTopScrollbar()
 * 数据加载完成后调用 remeasure()
 */
export function useTopScrollbar() {
  const tableWrapperRef = ref(null)
  const topScrollRef    = ref(null)
  const scrollWidth     = ref(0)
  let bodyEl  = null
  let syncing = false

  function findBodyEl() {
    if (!tableWrapperRef.value) return null
    // Ant Design Vue 4.x 横向滚动容器，依次尝试不同 class（版本/场景差异）
    const root = tableWrapperRef.value
    return root.querySelector('.ant-table-content')
        || root.querySelector('.ant-table-body')
        || root.querySelector('.ant-table-container')
        || root.querySelector('.ant-table-scroll')
        || null
  }

  function bindBodyEl(el) {
    if (bodyEl === el) return
    if (bodyEl) bodyEl.removeEventListener('scroll', onBodyScroll)
    bodyEl = el
    if (bodyEl) bodyEl.addEventListener('scroll', onBodyScroll)
  }

  function measure(retriesLeft = 8) {
    const found = findBodyEl()
    if (found && found.scrollWidth > 0) {
      bindBodyEl(found)
      scrollWidth.value = found.scrollWidth
    } else if (retriesLeft > 0) {
      // 表格 DOM 可能还没渲染完成（尤其首次异步加载数据时），稍后重试
      setTimeout(() => measure(retriesLeft - 1), 150)
    }
  }

  function onTopScroll(e) {
    if (syncing || !bodyEl) return
    syncing = true
    bodyEl.scrollLeft = e.target.scrollLeft
    syncing = false
  }

  function onBodyScroll() {
    if (syncing || !bodyEl || !topScrollRef.value) return
    syncing = true
    topScrollRef.value.scrollLeft = bodyEl.scrollLeft
    syncing = false
  }

  let resizeObserver = null

  onMounted(async () => {
    await nextTick()
    measure()
    // 表格内容变化（分页、筛选、窗口缩放）后宽度可能变化，自动重新测量
    if (window.ResizeObserver && tableWrapperRef.value) {
      resizeObserver = new ResizeObserver(() => measure(1))
      resizeObserver.observe(tableWrapperRef.value)
    }
  })

  onBeforeUnmount(() => {
    if (bodyEl) bodyEl.removeEventListener('scroll', onBodyScroll)
    if (resizeObserver) resizeObserver.disconnect()
  })

  // 数据变化（loadData 完成）后调用，下一帧重新测量
  function remeasure() {
    nextTick(() => measure())
  }

  return { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure }
}
