import express from 'express'
import { randomUUID } from 'node:crypto'
import { readJson, writeJson, DEFAULT_TEMPLATES, DEFAULT_CATEGORIES } from './store.js'
import { isConfigured, sendMail } from './mailer.js'

const PORT = 3001
const EDITORS_FILE = 'editors.json'
const TEMPLATES_FILE = 'templates.json'
const CATEGORIES_FILE = 'categories.json'
const CATEGORY_KINDS = ['platforms', 'novelTypes']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const app = express()
app.use(express.json({ limit: '30mb' }))

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// 包装异步路由，统一把异常交给错误处理中间件
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next)

const str = (v) => (typeof v === 'string' ? v.trim() : '')
// 字符串数组：去空格、去空值、去重
const strList = (v) => [...new Set((Array.isArray(v) ? v : []).map(str).filter(Boolean))]

// 编辑是否使用了某个分类：平台为单值，小说类型为数组
const editorUses = (editor, kind, name) =>
  kind === 'platforms' ? editor.platform === name : (editor.novelTypes || []).includes(name)

const readEditors = () => readJson(EDITORS_FILE, [])
const readTemplates = () => readJson(TEMPLATES_FILE, DEFAULT_TEMPLATES)
const readCategories = () => readJson(CATEGORIES_FILE, DEFAULT_CATEGORIES)

async function validateEditor(body) {
  const editor = {
    name: str(body.name),
    email: str(body.email),
    note: str(body.note),
    platform: str(body.platform),
    novelTypes: strList(body.novelTypes)
  }
  if (!editor.name) throw new HttpError(400, '名字不能为空')
  if (!EMAIL_RE.test(editor.email)) throw new HttpError(400, '邮箱格式不正确')
  const categories = await readCategories()
  if (editor.platform && !categories.platforms.includes(editor.platform)) {
    throw new HttpError(400, `平台类型「${editor.platform}」不存在`)
  }
  const missingType = editor.novelTypes.find((t) => !categories.novelTypes.includes(t))
  if (missingType) throw new HttpError(400, `小说类型「${missingType}」不存在`)
  return editor
}

function validateTemplate(body) {
  const template = { name: str(body.name), subject: str(body.subject), body: str(body.body) }
  if (!template.name || !template.subject || !template.body) {
    throw new HttpError(400, '模板名称、主题、正文都不能为空')
  }
  return template
}

// ---------- 配置 ----------

app.get('/api/config', (req, res) => {
  res.json({
    smtpUser: process.env.SMTP_USER || '',
    configured: isConfigured(),
    sendIntervalMs: Number(process.env.SEND_INTERVAL_MS ?? 1000)
  })
})

// ---------- 编辑 ----------

app.get('/api/editors', wrap(async (req, res) => {
  res.json(await readEditors())
}))

app.post('/api/editors', wrap(async (req, res) => {
  const editor = { id: randomUUID(), ...(await validateEditor(req.body)) }
  const editors = await readEditors()
  editors.push(editor)
  await writeJson(EDITORS_FILE, editors)
  res.json(editor)
}))

// 批量添加/导入：唯一判定条件为邮箱（去空格、不区分大小写）
// 已存在则更新（只覆盖有值的字段，小说类型不为空时整体替换；id、邮箱原文、位置不变），不存在则新增（名称为空时用邮箱）
// 同一批中后出现的行更新前面的；缺失的分类自动新建
app.post('/api/editors/batch', wrap(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : []
  const editors = await readEditors()
  const categories = await readCategories()
  const byEmail = new Map(editors.map((e) => [e.email.toLowerCase(), e]))
  const newCategories = { platforms: [], novelTypes: [] }
  const failed = []
  let added = 0
  let updated = 0

  const ensureCategory = (kind, name) => {
    if (name && !categories[kind].includes(name)) {
      categories[kind].push(name)
      newCategories[kind].push(name)
    }
  }

  for (const item of items) {
    const line = item.line
    const email = str(item.email)
    if (!EMAIL_RE.test(email)) {
      failed.push({ line, email, reason: '邮箱格式不正确' })
      continue
    }
    const fields = {
      name: str(item.name),
      platform: str(item.platform),
      note: str(item.note)
    }
    const novelTypes = strList(item.novelTypes)
    ensureCategory('platforms', fields.platform)
    novelTypes.forEach((t) => ensureCategory('novelTypes', t))
    const existing = byEmail.get(email.toLowerCase())
    if (existing) {
      for (const [key, value] of Object.entries(fields)) {
        if (value) existing[key] = value
      }
      if (novelTypes.length) existing.novelTypes = novelTypes
      updated++
    } else {
      const editor = { id: randomUUID(), ...fields, novelTypes, name: fields.name || email, email }
      editors.push(editor)
      byEmail.set(email.toLowerCase(), editor)
      added++
    }
  }

  if (added || updated) await writeJson(EDITORS_FILE, editors)
  if (newCategories.platforms.length || newCategories.novelTypes.length) {
    await writeJson(CATEGORIES_FILE, categories)
  }
  res.json({ added, updated, failed, newCategories })
}))

app.put('/api/editors/:id', wrap(async (req, res) => {
  const editors = await readEditors()
  const index = editors.findIndex((e) => e.id === req.params.id)
  if (index === -1) throw new HttpError(404, '编辑不存在')
  editors[index] = { id: req.params.id, ...(await validateEditor(req.body)) }
  await writeJson(EDITORS_FILE, editors)
  res.json(editors[index])
}))

app.delete('/api/editors/:id', wrap(async (req, res) => {
  const editors = await readEditors()
  const next = editors.filter((e) => e.id !== req.params.id)
  if (next.length === editors.length) throw new HttpError(404, '编辑不存在')
  await writeJson(EDITORS_FILE, next)
  res.json({ ok: true })
}))

// ---------- 模板 ----------

app.get('/api/templates', wrap(async (req, res) => {
  res.json(await readTemplates())
}))

app.post('/api/templates', wrap(async (req, res) => {
  const template = { id: randomUUID(), ...validateTemplate(req.body), isDefault: false }
  const templates = await readTemplates()
  templates.push(template)
  await writeJson(TEMPLATES_FILE, templates)
  res.json(template)
}))

app.put('/api/templates/:id', wrap(async (req, res) => {
  const templates = await readTemplates()
  const target = templates.find((t) => t.id === req.params.id)
  if (!target) throw new HttpError(404, '模板不存在')
  Object.assign(target, validateTemplate(req.body))
  await writeJson(TEMPLATES_FILE, templates)
  res.json(target)
}))

app.delete('/api/templates/:id', wrap(async (req, res) => {
  const templates = await readTemplates()
  const target = templates.find((t) => t.id === req.params.id)
  if (!target) throw new HttpError(404, '模板不存在')
  if (templates.length === 1) throw new HttpError(400, '至少需要保留一套模板')
  const next = templates.filter((t) => t.id !== req.params.id)
  if (target.isDefault) next[0].isDefault = true
  await writeJson(TEMPLATES_FILE, next)
  res.json({ ok: true })
}))

app.put('/api/templates/:id/default', wrap(async (req, res) => {
  const templates = await readTemplates()
  if (!templates.some((t) => t.id === req.params.id)) throw new HttpError(404, '模板不存在')
  templates.forEach((t) => { t.isDefault = t.id === req.params.id })
  await writeJson(TEMPLATES_FILE, templates)
  res.json({ ok: true })
}))

// ---------- 分类 ----------

function checkKind(kind) {
  if (!CATEGORY_KINDS.includes(kind)) throw new HttpError(400, '分类种类不正确')
}

app.get('/api/categories', wrap(async (req, res) => {
  res.json(await readCategories())
}))

app.post('/api/categories/:kind', wrap(async (req, res) => {
  const { kind } = req.params
  checkKind(kind)
  const name = str(req.body.name)
  if (!name) throw new HttpError(400, '分类名称不能为空')
  const categories = await readCategories()
  if (categories[kind].includes(name)) throw new HttpError(400, `「${name}」已存在`)
  categories[kind].push(name)
  await writeJson(CATEGORIES_FILE, categories)
  res.json(categories)
}))

// 改名：原位替换（颜色不变），并同步更新使用该分类的编辑
app.put('/api/categories/:kind/:name', wrap(async (req, res) => {
  const { kind, name } = req.params
  checkKind(kind)
  const categories = await readCategories()
  const index = categories[kind].indexOf(name)
  if (index === -1) throw new HttpError(404, `「${name}」不存在`)
  const newName = str(req.body.newName)
  if (!newName) throw new HttpError(400, '新名称不能为空')
  if (newName === name) return res.json({ categories, updatedCount: 0 })
  if (categories[kind].includes(newName)) throw new HttpError(400, `「${newName}」已存在`)

  const editors = await readEditors()
  let updatedCount = 0
  editors.forEach((e) => {
    if (!editorUses(e, kind, name)) return
    if (kind === 'platforms') e.platform = newName
    else e.novelTypes = e.novelTypes.map((t) => (t === name ? newName : t))
    updatedCount++
  })
  categories[kind][index] = newName
  if (updatedCount) await writeJson(EDITORS_FILE, editors)
  await writeJson(CATEGORIES_FILE, categories)
  res.json({ categories, updatedCount })
}))

app.delete('/api/categories/:kind/:name', wrap(async (req, res) => {
  const { kind, name } = req.params
  checkKind(kind)
  const categories = await readCategories()
  if (!categories[kind].includes(name)) throw new HttpError(404, `「${name}」不存在`)
  const usedCount = (await readEditors()).filter((e) => editorUses(e, kind, name)).length
  if (usedCount > 0) {
    throw new HttpError(400, `有 ${usedCount} 位编辑正在使用该分类，请先修改这些编辑`)
  }
  categories[kind] = categories[kind].filter((c) => c !== name)
  await writeJson(CATEGORIES_FILE, categories)
  res.json(categories)
}))

// ---------- 发信 ----------

app.post('/api/send', wrap(async (req, res) => {
  if (!isConfigured()) throw new HttpError(500, '请在 .env 中填写 SMTP_USER 和 SMTP_PASS')
  const { to, subject, text, filename, contentBase64 } = req.body
  if (!to || !subject || !text || !filename || !contentBase64) {
    throw new HttpError(400, '收件人、主题、正文、附件都不能为空')
  }
  try {
    await sendMail({ to, subject, text, filename, contentBase64 })
  } catch (err) {
    throw new HttpError(500, `发送失败：${err.message}`)
  }
  res.json({ ok: true })
}))

// ---------- 错误处理 ----------

app.use((err, req, res, next) => {
  const status = err.status || 500
  if (status === 500 && !(err instanceof HttpError)) console.error(err)
  res.status(status).json({ error: err instanceof HttpError ? err.message : `服务器错误：${err.message}` })
})

// 旧数据迁移：novelType（单值）→ novelTypes（数组），迁移前备份
async function migrateEditors() {
  const editors = await readEditors()
  if (!editors.some((e) => 'novelType' in e)) return
  await writeJson('editors.backup-before-novelTypes.json', editors)
  const migrated = editors.map(({ novelType, ...rest }) => ({
    ...rest,
    novelTypes: rest.novelTypes || (novelType ? [novelType] : [])
  }))
  await writeJson(EDITORS_FILE, migrated)
  console.log(`[server] 已将 ${migrated.length} 位编辑的小说类型迁移为多选，原数据备份在 data/editors.backup-before-novelTypes.json`)
}

await migrateEditors()

app.listen(PORT, () => {
  console.log(`[server] 已启动：http://localhost:${PORT}`)
  if (!isConfigured()) {
    console.warn('[server] 警告：.env 中 SMTP_USER 或 SMTP_PASS 未填写，暂时无法发送邮件')
  }
})
