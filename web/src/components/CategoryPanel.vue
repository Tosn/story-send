<template>
  <a-row :gutter="16">
    <a-col v-for="kind in kinds" :key="kind.key" :span="12">
      <a-card :title="kind.title">
        <a-typography-text type="secondary" class="hint">点击标签可修改名称</a-typography-text>
        <div class="tags">
          <a-tag
            v-for="name in categories[kind.key]"
            :key="name"
            :visible="true"
            closable
            size="large"
            :color="getTagColor(categories[kind.key], name, kind.offset)"
            @close="remove(kind.key, name)"
          >
            <span class="tag-name" @click="openRename(kind.key, name)">{{ name }}</span>
          </a-tag>
          <a-typography-text v-if="!categories[kind.key].length" type="secondary">暂无</a-typography-text>
        </div>
        <a-input-search
          v-model="inputs[kind.key]"
          search-button
          button-text="添加"
          :placeholder="`新增${kind.title}`"
          @search="add(kind.key)"
          @press-enter="add(kind.key)"
        />
      </a-card>
    </a-col>
  </a-row>

  <a-modal v-model:visible="rename.visible" title="修改名称" :on-before-ok="submitRename">
    <a-input v-model="rename.newName" />
  </a-modal>
</template>

<script setup>
import { reactive } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { addCategory, deleteCategory, renameCategory } from '../api.js'
import { getTagColor } from '../tagColor.js'

defineProps({
  categories: { type: Object, required: true }
})
const emit = defineEmits(['refresh', 'refresh-editors'])

const kinds = [
  { key: 'platforms', title: '平台类型', offset: 0 },
  { key: 'novelTypes', title: '小说类型', offset: 6 }
]
const inputs = reactive({ platforms: '', novelTypes: '' })

async function add(kind) {
  const name = inputs[kind].trim()
  if (!name) return
  try {
    await addCategory(kind, name)
    inputs[kind] = ''
    Message.success('已添加')
    emit('refresh')
  } catch (err) {
    Message.error(err.message)
  }
}

function remove(kind, name) {
  Modal.confirm({
    title: '删除分类',
    content: `确定删除「${name}」？`,
    onOk: async () => {
      try {
        await deleteCategory(kind, name)
        Message.success('已删除')
        emit('refresh')
      } catch (err) {
        Message.error(err.message)
      }
    }
  })
}

const rename = reactive({ visible: false, kind: '', name: '', newName: '' })

function openRename(kind, name) {
  Object.assign(rename, { visible: true, kind, name, newName: name })
}

// 返回 false 时弹窗保持打开
async function submitRename() {
  try {
    const { updatedCount } = await renameCategory(rename.kind, rename.name, rename.newName)
    Message.success(`已修改，同步更新 ${updatedCount} 位编辑`)
    emit('refresh')
    emit('refresh-editors')
    return true
  } catch (err) {
    Message.error(err.message)
    return false
  }
}
</script>

<style scoped>
.hint {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
  margin-bottom: 16px;
}
.tag-name {
  cursor: pointer;
}
</style>
