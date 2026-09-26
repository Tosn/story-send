const PALETTE = [
  'red', 'orangered', 'orange', 'gold', 'lime', 'green',
  'cyan', 'blue', 'arcoblue', 'purple', 'pinkpurple', 'magenta'
]

// 按名称在分类列表中的位置取色，offset 用于错开平台与小说类型的起始颜色
export function getTagColor(list, name, offset = 0) {
  const index = list.indexOf(name)
  if (index === -1) return 'gray'
  return PALETTE[(index + offset) % PALETTE.length]
}
