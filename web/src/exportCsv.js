// 含逗号、双引号或换行的单元格用双引号包裹，内部双引号写成两个
function escapeCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

// 加 BOM，避免 Excel 打开中文乱码
export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// 解析 CSV：支持引号包裹、"" 转义、引号内逗号和换行、\r\n 与 \n、开头 BOM；跳过空白行
// 返回 [{ cells, line }]，line 为该行在文件中的起始行号（从 1 开始）
export function parseCsvWithLines(text) {
  const src = text.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1
  const endRow = () => {
    row.push(cell)
    rows.push({ cells: row, line: rowLine })
    row = []
    cell = ''
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    const isNewline = ch === '\n' || ch === '\r'
    if (ch === '\r' && src[i + 1] === '\n') i++
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += isNewline ? '\n' : ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (isNewline) {
      endRow()
    } else {
      cell += ch
    }
    if (isNewline) {
      line++
      if (!inQuotes && !row.length && !cell) rowLine = line
    }
  }
  if (cell || row.length) endRow()
  return rows.filter((r) => r.cells.some((c) => c.trim()))
}

export function parseCsv(text) {
  return parseCsvWithLines(text).map((r) => r.cells)
}
