import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data')

// 内置默认模板，templates.json 缺失时作为初始值
export const DEFAULT_TEMPLATES = [
  {
    id: 'default-short',
    name: '短篇默认模板',
    subject: '{书名}-{类型}-{字数}字',
    body: [
      '亲爱的编编老师，',
      '您好！',
      '我的{类型}投稿请见附件。',
      '书名：{书名}',
      '笔名：蜗牛在攀爬',
      '作品类型：{类型}',
      '总字数：{字数}',
      'QQ：305197393',
      'WX: Tosnking',
      '感谢您的宝贵时间，请不吝赐教。',
      '【拒稿求回复】谢谢！'
    ].join('\n'),
    isDefault: true
  }
]

export async function readJson(filename, defaultValue) {
  const file = path.join(DATA_DIR, filename)
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    await writeJson(filename, defaultValue)
    return structuredClone(defaultValue)
  }
}

export async function writeJson(filename, data) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2) + '\n', 'utf8')
}

// 分类默认值，categories.json 缺失时作为初始值
export const DEFAULT_CATEGORIES = {
  platforms: [],
  novelTypes: ['短篇', '中篇', '长篇']
}
