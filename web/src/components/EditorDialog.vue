<template>
  <a-modal
    :visible="visible"
    :title="editor ? '修改编辑' : '新增编辑'"
    :on-before-ok="save"
    unmount-on-close
    @cancel="emit('update:visible', false)"
    @before-open="reset"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="名字" required>
        <a-input v-model="form.name" placeholder="编辑名字" />
      </a-form-item>
      <a-form-item label="邮箱" required>
        <a-input v-model="form.email" placeholder="xxx@example.com" />
      </a-form-item>
      <a-form-item label="平台类型">
        <a-select v-if="categories.platforms.length" v-model="form.platform" :options="categories.platforms" allow-clear allow-search placeholder="不选" />
        <a-empty v-else description="请先到分类管理中添加" />
      </a-form-item>
      <a-form-item label="小说类型">
        <a-select v-if="categories.novelTypes.length" v-model="form.novelTypes" :options="categories.novelTypes" multiple allow-clear allow-search placeholder="不选" />
        <a-empty v-else description="请先到分类管理中添加" />
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model="form.note" :auto-size="{ minRows: 2 }" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { reactive } from 'vue'
import { Message } from '@arco-design/web-vue'
import { addEditor, updateEditor } from '../api.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  editor: { type: Object, default: null },
  categories: { type: Object, required: true }
})
const emit = defineEmits(['update:visible', 'saved'])

const form = reactive({ name: '', email: '', platform: '', novelTypes: [], note: '' })

function reset() {
  const e = props.editor
  Object.assign(form, {
    name: e?.name ?? '',
    email: e?.email ?? '',
    note: e?.note ?? '',
    platform: e?.platform ?? '',
    // 新增时默认短篇，短篇已被删除则不选
    novelTypes: e ? [...(e.novelTypes || [])] : props.categories.novelTypes.includes('短篇') ? ['短篇'] : []
  })
}

async function save() {
  const payload = { ...form, platform: form.platform || '', novelTypes: form.novelTypes || [] }
  try {
    if (props.editor) await updateEditor(props.editor.id, payload)
    else await addEditor(payload)
    Message.success('已保存')
    emit('saved')
    emit('update:visible', false)
    return true
  } catch (err) {
    Message.error(err.message)
    return false
  }
}
</script>
