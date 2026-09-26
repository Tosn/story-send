<template>
  <a-row :gutter="16">
    <a-col :span="7">
      <a-card title="模板列表">
        <template #extra>
          <a-button type="primary" size="small" @click="createNew">
            <template #icon><icon-plus /></template>新增
          </a-button>
        </template>
        <a-list size="small" hoverable>
          <a-list-item
            v-for="t in templates"
            :key="t.id"
            :class="{ active: t.id === selectedId }"
            class="item"
            @click="select(t)"
          >
            {{ t.name }}
            <a-tag v-if="t.isDefault" color="green" size="small" class="ml">默认</a-tag>
          </a-list-item>
        </a-list>
      </a-card>
    </a-col>
    <a-col :span="17">
      <a-card :title="selectedId ? '编辑模板' : '新增模板'">
        <a-alert type="info" class="mb">
          可用占位符：{书名}、{类型}、{字数}，发送时会按附件文件名自动替换，主题和正文都支持。
        </a-alert>
        <a-form :model="draft" layout="vertical">
          <a-form-item label="名称" required>
            <a-input v-model="draft.name" />
          </a-form-item>
          <a-form-item label="主题" required>
            <a-input v-model="draft.subject" />
          </a-form-item>
          <a-form-item label="正文" required>
            <a-textarea v-model="draft.body" :auto-size="{ minRows: 12 }" />
          </a-form-item>
        </a-form>
        <a-space>
          <a-button type="primary" @click="save">保存</a-button>
          <a-button :disabled="!selectedId || current?.isDefault" @click="makeDefault">设为默认</a-button>
          <a-popconfirm v-if="selectedId" :content="`确定删除「${current?.name}」？`" @ok="remove">
            <a-button status="danger">删除</a-button>
          </a-popconfirm>
        </a-space>
      </a-card>
    </a-col>
  </a-row>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { addTemplate, updateTemplate, deleteTemplate, setDefaultTemplate } from '../api.js'

const props = defineProps({
  templates: { type: Array, required: true }
})
const emit = defineEmits(['refresh'])

// selectedId 为空表示正在新增
const selectedId = ref('')
const draft = reactive({ name: '', subject: '', body: '' })
const current = computed(() => props.templates.find((t) => t.id === selectedId.value))

function select(t) {
  selectedId.value = t.id
  Object.assign(draft, { name: t.name, subject: t.subject, body: t.body })
}

function createNew() {
  selectedId.value = ''
  Object.assign(draft, { name: '', subject: '{书名}-{类型}-{字数}字', body: '' })
}

// 首次加载或当前模板被删除时，选中默认模板
watch(
  () => props.templates,
  (list) => {
    if (selectedId.value && list.some((t) => t.id === selectedId.value)) return
    const t = list.find((x) => x.isDefault) || list[0]
    if (t) select(t)
  },
  { immediate: true }
)

async function run(fn, successText) {
  try {
    const result = await fn()
    Message.success(successText)
    emit('refresh')
    return result
  } catch (err) {
    Message.error(err.message)
  }
}

async function save() {
  if (selectedId.value) {
    await run(() => updateTemplate(selectedId.value, { ...draft }), '已保存')
  } else {
    const created = await run(() => addTemplate({ ...draft }), '已新增')
    if (created) selectedId.value = created.id
  }
}

const makeDefault = () => run(() => setDefaultTemplate(selectedId.value), '已设为默认')

async function remove() {
  const ok = await run(() => deleteTemplate(selectedId.value), '已删除')
  if (ok) selectedId.value = ''
}
</script>

<style scoped>
.item {
  cursor: pointer;
}
.item.active {
  background: var(--color-primary-light-1);
}
.ml {
  margin-left: 6px;
}
.mb {
  margin-bottom: 16px;
}
</style>
