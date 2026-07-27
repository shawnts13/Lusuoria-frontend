// 纯文本里的关键数字高亮工具，供"薪资信息"这类"标签文字+数字"混排的说明文案复用。
// 金额/比例/计数这些数字，如果跟旁边的说明文字用同一个黑色字体展示，看起来会像一整段
// 没有重点的文字（没有对比度）。规则统一成：
//   - 金额（¥/$ 开头）标红加粗——最需要一眼看到的数字
//   - 笔数/条数/档位/月份/百分比这类"计数/比例"信息标蓝加粗——次一级但仍然重要
// 最早在"设置内部执行成本"弹窗的建议金额说明里引入，任何新增"金额+计数说明"文案的地方
// 都应该复用这个函数，不要各自发明一套高亮规则导致风格不一致。

/** 转义 HTML 特殊字符，拼颜色 span 之前用，避免文本里带 <> 之类字符被当成 HTML 解析 */
export function escapeHtml(s) {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 给一段纯文本里的金额/比例/计数数字上色，返回可以配合 v-html 使用的字符串 */
export function highlightAmounts(text) {
  if (!text) return ''
  let html = escapeHtml(text)
  // 月份
  html = html.replace(/(\d+月)/g, '<span style="color:#1677ff;font-weight:600">$1</span>')
  // "N笔"/"N条"这种计数（含"第N条"/"51条+"里的条数），以及阶梯档位常见的"档"字
  html = html.replace(/(\d+\s*[笔条档])/g, '<span style="color:#1677ff;font-weight:600">$1</span>')
  // 百分比（提成比例、bonus比例）
  html = html.replace(/(\d+(?:\.\d+)?%)/g, '<span style="color:#1677ff;font-weight:600">$1</span>')
  // 金额是最需要一眼看到的数字，单独标红加粗
  html = html.replace(/([¥$][\d,]+(?:\.\d+)?)/g, '<span style="color:#c00000;font-weight:600">$1</span>')
  return html
}
