import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

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
 * const { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll } = useTopScrollbar()
 */
export function useTopScrollbar() {
  const tableWrapperRef = ref(null)
  const topScrollRef    = ref(null)
  const scrollWidth     = ref(0)
  let bodyEl = null
  let syncing = false

  function findBodyEl() {
    if (!tableWrapperRef.value) return null
    // Ant Design Vue 表格的实际横向滚动容器
    return tableWrapperRef.value.querySelector('.ant-table-content')
        || tableWrapperRef.value.querySelector('.ant-table-body')
  }

  function measure() {
    bodyEl = findBodyEl()
    if (bodyEl) {
      scrollWidth.value = bodyEl.scrollWidth
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
    bodyEl = findBodyEl()
    if (bodyEl) bodyEl.addEventListener('scroll', onBodyScroll)

    // 表格内容变化（分页、筛选）后宽度可能变化，重新测量
    if (window.ResizeObserver && tableWrapperRef.value) {
      resizeObserver = new ResizeObserver(() => measure())
      resizeObserver.observe(tableWrapperRef.value)
    }
  })

  onBeforeUnmount(() => {
    if (bodyEl) bodyEl.removeEventListener('scroll', onBodyScroll)
    if (resizeObserver) resizeObserver.disconnect()
  })

  // 数据变化后表格内容可能重新渲染，下一帧重新测量并重新绑定
  function remeasure() {
    nextTick(() => {
      if (bodyEl) bodyEl.removeEventListener('scroll', onBodyScroll)
      measure()
      bodyEl = findBodyEl()
      if (bodyEl) bodyEl.addEventListener('scroll', onBodyScroll)
    })
  }

  return { tableWrapperRef, topScrollRef, scrollWidth, onTopScroll, remeasure }
}
