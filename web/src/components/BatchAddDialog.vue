<template>
  <a-modal
    :visible="visible"
    :title="isFileMode ? `从文件导入：${sourceName}` : '批量添加编辑'"
    width="880px"
    :ok-text="`导入 ${importableCount} 条`"
    :ok-button-props="{ disabled: importableCount === 0 }"
    :on-before-ok="submit"
    unmount-on-close
    @cancel="emit('update:visible', false)"
    @before-open="onOpen"
  >
    <template v-if="!isFileMode">
      <a-alert type="info" class="mb">
        每行一个，格式：邮箱-名称-平台-小说类型，只有邮箱必填。
        例如只写 9898989@qq.com，则只录入邮箱，名称使用邮箱，平台和小说类型为空。
        多个小说类型用顿号分隔，如 短篇、中篇。
        邮箱已存在时更新该编辑，只覆盖填写了的字段。
      </a-alert>
      <a-textarea
        v-model="text"
        :auto-size="{ minRows: 6, maxRows: 12 }"
        placeholder="9898989@qq.com-小王-知乎盐言-短篇、中篇"
        class="mb"
      />
    </template>
    <div v-if="rows.length" class="toolbar mb">
      <a-space>
        <a-button size="small" @click="selectAll">全选</a-button>
        <a-button size="small" @click="unselectAll">取消全选</a-button>
        <a-button size="small" @click="invertSelection">反选</a-button>
      </a-space>
      <a-typography-text>已选 {{ importableCount }} 条</a-typography-text>
    </div>
    <a-table
      v-if="rows.length"
      row-key="key"
      :data="rows"
      :columns="columns"
      :pagination="false"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
      :selected-keys="selectedKeys"
      :scroll="{ y: 360 }"
      size="small"
      @update:selected-keys="onSelectedChange"
    >
      <template #check="{ record }">
        <a-space>
          <a-tag :color="record.check.color">{{ record.check.text }}</a-tag>
          <a-tag v-if="record.selected && record.createsCategory" color="arcoblue">将新建分类</a-tag>
        </a-space>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { batchAddEditors } from '../api.js'
import { parseBatchLines } from '../parseBatch.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  editors: { type: Array, required: true },
  categories: { type: Object, required: true },
  // 传入时为文件导入模式：[{ line, email, name, platform, novelTypes, note }]
  presetItems: { type: Array, default: null },
  sourceName: { type: String, default: '' }
})
const emit = defineEmits(['update:visible', 'imported'])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isFileMode = computed(() => Array.isArray(props.presetItems))

const columns = computed(() => [
  { title: '邮箱', dataIndex: 'email', ellipsis: true, tooltip: true },
  { title: '名称', dataIndex: 'displayName', ellipsis: true, tooltip: true },
  { title: '平台', dataIndex: 'platform', width: 100 },
  { title: '小说类型', dataIndex: 'typesText', width: 110, ellipsis: true, tooltip: true },
  ...(isFileMode.value ? [{ title: '备注', dataIndex: 'note', ellipsis: true, tooltip: true }] : []),
  { title: '预检', slotName: 'check', width: 170 }
])

const text = ref('')
// 记录被取消勾选的行，其余可选行默认勾选（新出现的行也自动勾选）
const deselected = ref(new Set())

function onOpen() {
  text.value = ''
  deselected.value = new Set()
}

const items = computed(() =>
  (isFileMode.value ? props.presetItems : parseBatchLines(text.value)).map((item) => ({
    ...item,
    note: item.note || '',
    key: `${item.line}|${item.email}`,
    disabled: !EMAIL_RE.test(item.email)
  }))
)

const selectableKeys = computed(() => items.value.filter((i) => !i.disabled).map((i) => i.key))
const selectedKeys = computed(() => selectableKeys.value.filter((k) => !deselected.value.has(k)))

function onSelectedChange(keys) {
  deselected.value = new Set(selectableKeys.value.filter((k) => !keys.includes(k)))
}
const selectAll = () => { deselected.value = new Set() }
const unselectAll = () => { deselected.value = new Set(selectableKeys.value) }
const invertSelection = () => { deselected.value = new Set(selectedKeys.value) }

// 前端预检，最终以后端结果为准；唯一判定条件为邮箱（不区分大小写），只按已勾选的行依次计算
const rows = computed(() => {
  const selected = new Set(selectedKeys.value)
  const byEmail = new Map(props.editors.map((e) => [e.email.toLowerCase(), e.name]))
  return items.value.map((item) => {
    const key = item.email.toLowerCase()
    const isSelected = selected.has(item.key)
    let check
    let displayName = item.name || item.email
    if (item.disabled) {
      check = { text: '邮箱格式错误', color: 'red' }
    } else if (!isSelected) {
      check = { text: '不导入', color: 'gray' }
      displayName = item.name || byEmail.get(key) || item.email
    } else if (byEmail.has(key)) {
      check = { text: '更新', color: 'orange' }
      displayName = item.name || byEmail.get(key)
    } else {
      check = { text: '新增', color: 'green' }
    }
    if (isSelected) byEmail.set(key, displayName)
    const createsCategory =
      (item.platform && !props.categories.platforms.includes(item.platform)) ||
      item.novelTypes.some((t) => !props.categories.novelTypes.includes(t))
    return { ...item, typesText: item.novelTypes.join('、'), displayName, check, selected: isSelected, createsCategory }
  })
})

const importableCount = computed(() => selectedKeys.value.length)

async function submit() {
  const payload = rows.value
    .filter((r) => r.selected)
    .map(({ line, email, name, platform, novelTypes, note }) => ({ line, email, name, platform, novelTypes, note }))
  try {
    const result = await batchAddEditors(payload)
    Message.success(`新增 ${result.added} 条，更新 ${result.updated} 条，失败 ${result.failed.length} 条`)
    emit('imported')
    emit('update:visible', false)
    return true
  } catch (err) {
    Message.error(err.message)
    return false
  }
}
</script>

<style scoped>
.mb {
  margin-bottom: 12px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
