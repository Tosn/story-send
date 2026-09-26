<template>
  <a-card title="编辑">
    <template #extra>
      <a-space>
        <a-button size="small" @click="csvInput.click()">
          <template #icon><icon-upload /></template>从文件导入
        </a-button>
        <input ref="csvInput" type="file" accept=".csv" hidden @change="onCsvSelected" />
        <a-button size="small" @click="openBatch">批量添加</a-button>
        <a-button type="primary" size="small" @click="openDialog(null)">
          <template #icon><icon-plus /></template>新增编辑
        </a-button>
      </a-space>
    </template>

    <div class="filter-row">
      <span class="filter-label">搜索：</span>
      <a-input v-model="keyword" allow-clear placeholder="输入邮箱或名字" class="search-input">
        <template #prefix><icon-search /></template>
      </a-input>
    </div>
    <div class="filter-row">
      <span class="filter-label">平台：</span>
      <a-checkbox-group v-model="platformFilter" class="filter-options">
        <a-checkbox v-for="name in categories.platforms" :key="name" :value="name">
          <a-tag :color="getTagColor(categories.platforms, name, 0)">{{ name }}</a-tag>
        </a-checkbox>
      </a-checkbox-group>
      <a-typography-text v-if="!categories.platforms.length" type="secondary">暂无，可在分类管理中添加</a-typography-text>
    </div>
    <div class="filter-row">
      <span class="filter-label">小说类型：</span>
      <a-checkbox-group v-model="novelTypeFilter" class="filter-options">
        <a-checkbox v-for="name in categories.novelTypes" :key="name" :value="name">
          <a-tag :color="getTagColor(categories.novelTypes, name, 6)">{{ name }}</a-tag>
        </a-checkbox>
      </a-checkbox-group>
    </div>

    <div class="toolbar mb">
      <a-space>
        <a-button size="small" @click="selectAllFiltered">全选当前</a-button>
        <a-button size="small" @click="unselectAllFiltered">取消全选当前</a-button>
        <a-tooltip content="在当前筛选结果中，每个平台选择最后录入的一位编辑，未设置平台的编辑全部选中，并替换已选">
          <a-button size="small" @click="selectOnePerPlatform">每平台选一个</a-button>
        </a-tooltip>
        <a-typography-text>已选 {{ selectedIds.length }} 人</a-typography-text>
      </a-space>
      <a-button size="small" @click="exportSelected">
        <template #icon><icon-download /></template>导出 CSV
      </a-button>
    </div>

    <a-table
      row-key="id"
      :data="filteredEditors"
      :columns="columns"
      :pagination="false"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
      :selected-keys="selectedIds"
      size="small"
      @update:selected-keys="emit('update:selectedIds', $event)"
    >
      <template #platform="{ record }">
        <a-tag v-if="record.platform" :color="getTagColor(categories.platforms, record.platform, 0)">{{ record.platform }}</a-tag>
      </template>
      <template #novelTypes="{ record }">
        <a-space wrap size="mini">
          <a-tag v-for="t in record.novelTypes" :key="t" :color="getTagColor(categories.novelTypes, t, 6)">{{ t }}</a-tag>
        </a-space>
      </template>
      <template #actions="{ record }">
        <a-space>
          <a-button type="text" size="mini" @click="openDialog(record)">编辑</a-button>
          <a-popconfirm :content="`确定删除「${record.name}」？`" @ok="remove(record)">
            <a-button type="text" status="danger" size="mini">删除</a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-table>

    <EditorDialog
      v-model:visible="dialogVisible"
      :editor="editingEditor"
      :categories="categories"
      @saved="emit('refresh')"
    />
    <BatchAddDialog
      v-model:visible="batchVisible"
      :editors="editors"
      :categories="categories"
      :preset-items="presetItems"
      :source-name="csvName"
      @imported="onImported"
    />
  </a-card>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { deleteEditor } from '../api.js'
import EditorDialog from './EditorDialog.vue'
import BatchAddDialog from './BatchAddDialog.vue'
import { toCsv, downloadCsv, parseCsvWithLines } from '../exportCsv.js'
import { splitTypes } from '../parseBatch.js'
import { getTagColor } from '../tagColor.js'

const props = defineProps({
  editors: { type: Array, required: true },
  categories: { type: Object, required: true },
  selectedIds: { type: Array, required: true }
})
const emit = defineEmits(['update:selectedIds', 'refresh', 'refresh-categories'])

const columns = [
  { title: '名字', dataIndex: 'name', width: 90 },
  { title: '邮箱', dataIndex: 'email', ellipsis: true, tooltip: true },
  { title: '平台', slotName: 'platform', width: 100 },
  { title: '小说类型', slotName: 'novelTypes', width: 150 },
  { title: '备注', dataIndex: 'note', ellipsis: true, tooltip: true },
  { title: '操作', slotName: 'actions', width: 110 }
]

const platformFilter = ref([])
const novelTypeFilter = ref([])

// 分类改名或删除后，去掉筛选中已不存在的名称
watch(
  () => props.categories,
  (c) => {
    platformFilter.value = platformFilter.value.filter((n) => c.platforms.includes(n))
    novelTypeFilter.value = novelTypeFilter.value.filter((n) => c.novelTypes.includes(n))
  }
)

// 同一行内满足其一，两行之间同时满足；某行不选则不限制
const keyword = ref('')

// 搜索：名字或邮箱不区分大小写包含关键字
const matchKeyword = (e) => {
  const k = keyword.value.trim().toLowerCase()
  return !k || e.name.toLowerCase().includes(k) || e.email.toLowerCase().includes(k)
}

const filteredEditors = computed(() =>
  props.editors.filter(
    (e) =>
      matchKeyword(e) &&
      (!platformFilter.value.length || platformFilter.value.includes(e.platform)) &&
      (!novelTypeFilter.value.length || novelTypeFilter.value.some((t) => (e.novelTypes || []).includes(t)))
  )
)

function selectAllFiltered() {
  const ids = new Set(props.selectedIds)
  filteredEditors.value.forEach((e) => ids.add(e.id))
  emit('update:selectedIds', [...ids])
}

function unselectAllFiltered() {
  const filteredIds = new Set(filteredEditors.value.map((e) => e.id))
  emit('update:selectedIds', props.selectedIds.filter((id) => !filteredIds.has(id)))
}

// 当前筛选结果中每个平台取最后录入（数组中最后出现）的一位，未设置平台的全部选中，替换已选
function selectOnePerPlatform() {
  if (!filteredEditors.value.length) return Message.warning('当前筛选结果中没有编辑')
  const latest = new Map()
  const noPlatform = []
  filteredEditors.value.forEach((e) => {
    if (e.platform) latest.set(e.platform, e.id)
    else noPlatform.push(e.id)
  })
  emit('update:selectedIds', [...latest.values(), ...noPlatform])
  const parts = []
  if (latest.size) parts.push(`已为 ${latest.size} 个平台各选择 1 位编辑`)
  if (noPlatform.length) parts.push(`${latest.size ? '另' : '已'}选中 ${noPlatform.length} 位未设置平台的编辑`)
  Message.success(parts.join('，'))
}

const dialogVisible = ref(false)
const editingEditor = ref(null)

function openDialog(editor) {
  editingEditor.value = editor
  dialogVisible.value = true
}

const batchVisible = ref(false)
const presetItems = ref(null)
const csvName = ref('')
const csvInput = ref(null)

function openBatch() {
  presetItems.value = null
  batchVisible.value = true
}

// 先按 UTF-8 严格解码，失败则按 GBK（Excel 另存的 CSV 常为 GBK）
function decodeCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gbk').decode(buffer)
  }
}

const CSV_HEADERS = { 邮箱: 'email', 名称: 'name', 平台: 'platform', 收稿类型: 'novelTypes', 备注: 'note' }

async function onCsvSelected(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  try {
    const [headerRow, ...data] = parseCsvWithLines(decodeCsv(await file.arrayBuffer()))
    const header = headerRow?.cells ?? []
    // 按表头名称匹配列，不要求顺序
    const index = {}
    header.forEach((h, i) => {
      const key = CSV_HEADERS[h.trim()]
      if (key && !(key in index)) index[key] = i
    })
    if (!('email' in index)) return Message.error('文件格式不正确：缺少「邮箱」列')
    if (!data.length) return Message.warning('文件中没有数据')
    const cell = (row, key) => (key in index ? (row[index[key]] ?? '').trim() : '')
    presetItems.value = data.map(({ cells: row, line }) => ({
      line,
      email: cell(row, 'email'),
      name: cell(row, 'name'),
      platform: cell(row, 'platform'),
      novelTypes: splitTypes(cell(row, 'novelTypes')),
      note: cell(row, 'note')
    }))
    csvName.value = file.name
    batchVisible.value = true
  } catch (err) {
    Message.error(`读取文件失败：${err.message}`)
  }
}

const pad = (n) => String(n).padStart(2, '0')

// 导出全部已勾选的编辑（不受筛选影响），按录入顺序
function exportSelected() {
  const selected = props.editors.filter((e) => props.selectedIds.includes(e.id))
  if (!selected.length) return Message.warning('请先勾选要导出的编辑')
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const csv = toCsv(
    ['邮箱', '名称', '平台', '收稿类型', '备注'],
    selected.map((e) => [e.email, e.name, e.platform, (e.novelTypes || []).join('、'), e.note])
  )
  downloadCsv(`编辑数据-${stamp}.csv`, csv)
  Message.success(`已导出 ${selected.length} 位编辑`)
}

function onImported() {
  emit('refresh')
  emit('refresh-categories')
}

async function remove(editor) {
  try {
    await deleteEditor(editor.id)
    emit('update:selectedIds', props.selectedIds.filter((id) => id !== editor.id))
    Message.success('已删除')
    emit('refresh')
  } catch (err) {
    Message.error(err.message)
  }
}
</script>

<style scoped>
.filter-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
}
.filter-label {
  width: 80px;
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 32px;
  color: var(--color-text-2);
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-input {
  width: 300px;
}
.filter-options {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  row-gap: 4px;
}
.mb {
  margin-bottom: 12px;
}
</style>
