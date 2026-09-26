// 解析「书名-类型-字数字.docx」，能识别多少填多少，缺少的字段为空字符串
// 规则：末段为数字（可带「字」）则为字数；剩余仍有 2 段及以上时末段为类型；其余拼回为书名
export function parseFilename(filename) {
  const parts = filename.replace(/\.[^.]+$/, '').split('-').map((s) => s.trim())
  let 字数 = ''
  let 类型 = ''
  if (parts.length > 1 && /^\d+字?$/.test(parts[parts.length - 1])) {
    字数 = parts.pop().replace(/字$/, '')
  }
  if (parts.length >= 2) {
    类型 = parts.pop()
  }
  const 书名 = parts.join('-').trim()
  return { 书名, 类型, 字数 }
}

// 只替换有值的字段，空字段保留占位符
export function fillTemplate(text, fields) {
  let result = text
  for (const key of ['书名', '类型', '字数']) {
    if (fields[key]) result = result.replaceAll(`{${key}}`, fields[key])
  }
  return result
}
