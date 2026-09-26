async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`)
  return data
}

export const getConfig = () => request('GET', '/api/config')

export const getEditors = () => request('GET', '/api/editors')
export const addEditor = (editor) => request('POST', '/api/editors', editor)
export const updateEditor = (id, editor) => request('PUT', `/api/editors/${id}`, editor)
export const deleteEditor = (id) => request('DELETE', `/api/editors/${id}`)

export const getTemplates = () => request('GET', '/api/templates')
export const addTemplate = (template) => request('POST', '/api/templates', template)
export const updateTemplate = (id, template) => request('PUT', `/api/templates/${id}`, template)
export const deleteTemplate = (id) => request('DELETE', `/api/templates/${id}`)
export const setDefaultTemplate = (id) => request('PUT', `/api/templates/${id}/default`)

export const getCategories = () => request('GET', '/api/categories')
export const addCategory = (kind, name) => request('POST', `/api/categories/${kind}`, { name })
export const deleteCategory = (kind, name) =>
  request('DELETE', `/api/categories/${kind}/${encodeURIComponent(name)}`)

export const renameCategory = (kind, name, newName) =>
  request('PUT', `/api/categories/${kind}/${encodeURIComponent(name)}`, { newName })

export const sendMail = (payload) => request('POST', '/api/send', payload)

export const batchAddEditors = (items) => request('POST', '/api/editors/batch', { items })
