/**
 * 按字符串内容生成一个固定的标签颜色。
 *
 * 用于"品牌方"、"红人团队"、"合作平台"这类值不固定、种类比较多的字段——
 * 同一个值每次算出来的颜色都一样（简单哈希 + 固定调色板取模），不同值大概率
 * 会分到不同颜色，不需要手动维护"哪个品牌配哪个颜色"这种映射表。
 */
const PALETTE = [
  'blue', 'green', 'orange', 'purple', 'cyan', 'magenta',
  'gold', 'geekblue', 'volcano', 'lime', 'red', 'pink'
]

export function colorForValue(value) {
  if (!value) return undefined
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
