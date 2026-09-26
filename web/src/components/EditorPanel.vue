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
      <a-select
        v-model="platformFilter"
        :options="categories.platforms"
        multiple
        allow-clear
        allow-search
        :max-tag-count="5"
        :placeholder="categories.platforms.length ? '全部平台' : '暂无平台，可在分类管理中添加'"
        class="platform-select"
      >
        <template #option="{ data }">
          <a-tag :color="getTagColor(categories.platforms, data.value, 0)">{{ data.label }}</a-tag>
        </template>
      </a-select>
    </div>
    <div class="filter-row">
      <span class="filter-label">小说类型：</span>
      <a-checkbox-group v-model="novelTypeFilter" class="filter-options">
        <a-checkbox v-for="name in categories.novelTypes" :key="name" :value="name">
          <a-tag :color="getTagColor(categories.novelTypes, name, 6)">{{ name }}</a-tag>
        </a-checkbox>
      </a-checkbox-group>
    </div>
    <div class="filter-row">
      <span class="filter-label">排序：</span>
      <a-radio-group v-model="sortMode" type="button" size="small" class="sort-group">
        <a-radio value="oldest">最早录入</a-radio>
        <a-radio value="newest">最新录入</a-radio>
        <a-radio value="platform">按平台</a-radio>
      </a-radio-group>
    </div>

    <div class="toolbar mb">
      <a-space>
        <a-button size="small" @click="selectAllFiltered">全选筛选结果</a-button>
        <a-button size="small" @click="unselectAllFiltered">取消全选筛选结果</a-button>
        <a-tooltip content="在当前筛选结果中，每个平台随机选择一位编辑，未设置平台的编辑全部选中，并替换已选">
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
      :data="sortedEditors"
      :columns="columns"
      :pagination="{ current: page, pageSize: PAGE_SIZE, showTotal: true, hideOnSinglePage: true }"
      @page-change="page = $event"
      size="small"
    >
      <template #selectAllHeader>
        <a-checkbox
          :model-value="allFilteredSelected"
          :indeterminate="someFilteredSelected"
          @change="allFilteredSelected ? unselectAllFiltered() : selectAllFiltered()"
        />
      </template>
      <template #select="{ record }">
        <a-checkbox :model-value="selectedIds.includes(record.id)" @change="toggleSelect(record.id)" />
      </template>
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
      @saved="onImported"
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
  { titleSlotName: 'selectAllHeader', slotName: 'select', width: 50 },
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

// 排序：录入顺序即数组顺序；按平台时按分类管理中的顺序分组，组内按录入顺序，未设置平台的排最后
const sortMode = ref('oldest')
const sortedEditors = computed(() => {
  const list = [...filteredEditors.value]
  if (sortMode.value === 'newest') return list.reverse()
  if (sortMode.value === 'platform') {
    const platforms = props.categories.platforms
    const rank = (e) => {
      if (!e.platform) return platforms.length + 1
      const i = platforms.indexOf(e.platform)
      return i === -1 ? platforms.length : i
    }
    return list.sort((a, b) => rank(a) - rank(b))
  }
  return list
})

// 前端分页：筛选条件变化回到第 1 页；删除等导致页码超出时调整到最后一页
const PAGE_SIZE = 20
const page = ref(1)
watch([keyword, platformFilter, novelTypeFilter, sortMode], () => { page.value = 1 })
watch(
  () => filteredEditors.value.length,
  (len) => {
    const lastPage = Math.max(1, Math.ceil(len / PAGE_SIZE))
    if (page.value > lastPage) page.value = lastPage
  }
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

// 表头勾选框按全部筛选结果（所有页）计算
const selectedFilteredCount = computed(() => filteredEditors.value.filter((e) => props.selectedIds.includes(e.id)).length)
const allFilteredSelected = computed(
  () => filteredEditors.value.length > 0 && selectedFilteredCount.value === filteredEditors.value.length
)
const someFilteredSelected = computed(() => selectedFilteredCount.value > 0 && !allFilteredSelected.value)

function toggleSelect(id) {
  emit(
    'update:selectedIds',
    props.selectedIds.includes(id) ? props.selectedIds.filter((x) => x !== id) : [...props.selectedIds, id]
  )
}

// 当前筛选结果中每个平台随机选一位，未设置平台的全部选中，替换已选
function selectOnePerPlatform() {
  if (!filteredEditors.value.length) return Message.warning('当前筛选结果中没有编辑')
  const groups = new Map()
  const noPlatform = []
  filteredEditors.value.forEach((e) => {
    if (!e.platform) return noPlatform.push(e.id)
    if (!groups.has(e.platform)) groups.set(e.platform, [])
    groups.get(e.platform).push(e.id)
  })
  const picked = [...groups.values()].map((ids) => ids[Math.floor(Math.random() * ids.length)])
  emit('update:selectedIds', [...picked, ...noPlatform])
  const parts = []
  if (groups.size) parts.push(`已为 ${groups.size} 个平台各选择 1 位编辑`)
  if (noPlatform.length) parts.push(`${groups.size ? '另' : '已'}选中 ${noPlatform.length} 位未设置平台的编辑`)
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
.sort-group {
  margin-top: 4px;
}
.platform-select {
  flex: 1;
  max-width: 600px;
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
