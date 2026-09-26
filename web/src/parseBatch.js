// 解析批量添加文本：每行「邮箱-名称-平台-小说类型」，只有邮箱必填
// 邮箱本身可能含「-」，因此从 @ 之后第一个「-」处切出邮箱
export function parseBatchLines(text) {
  const result = []
  text.split(/\r?\n/).forEach((raw, index) => {
    const lineText = raw.trim()
    if (!lineText) return
    const at = lineText.indexOf('@')
    const cut = at === -1 ? lineText.indexOf('-') : lineText.indexOf('-', at)
    const email = (cut === -1 ? lineText : lineText.slice(0, cut)).trim()
    const rest = cut === -1 ? [] : lineText.slice(cut + 1).split('-').map((s) => s.trim())
    const [name = '', platform = '', types = ''] = rest
    result.push({ line: index + 1, email, name, platform, novelTypes: splitTypes(types) })
  })
  return result
}

// 多个小说类型：按「、」「，」「,」「/」切分，去空格、去空值、去重
export function splitTypes(text) {
  return [...new Set((text || '').split(/[、，,/]/).map((s) => s.trim()).filter(Boolean))]
}
