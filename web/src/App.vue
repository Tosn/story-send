<template>
  <a-layout class="layout">
    <a-layout-header class="header">小说一键投稿</a-layout-header>
    <a-layout-content class="content">
      <a-alert v-if="config && !config.configured" type="warning" class="mb">
        .env 中的 SMTP_USER 或 SMTP_PASS 未填写，暂时无法发送邮件。填写后请重新执行 start.sh。
      </a-alert>
      <a-tabs default-active-key="submit">
        <a-tab-pane key="submit" title="投稿">
          <a-row :gutter="16">
            <a-col :span="13">
              <EditorPanel
                v-model:selected-ids="selectedIds"
                :editors="editors"
                :categories="categories"
                @refresh="loadEditors"
                @refresh-categories="loadCategories"
              />
            </a-col>
            <a-col :span="11">
              <SubmitPanel :editors="selectedEditors" :templates="templates" :config="config" />
            </a-col>
          </a-row>
        </a-tab-pane>
        <a-tab-pane key="templates" title="模板管理">
          <TemplatePanel :templates="templates" @refresh="loadTemplates" />
        </a-tab-pane>
        <a-tab-pane key="categories" title="分类管理">
          <CategoryPanel :categories="categories" @refresh="loadCategories" @refresh-editors="loadEditors" />
        </a-tab-pane>
      </a-tabs>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import * as api from './api.js'
import EditorPanel from './components/EditorPanel.vue'
import SubmitPanel from './components/SubmitPanel.vue'
import TemplatePanel from './components/TemplatePanel.vue'
import CategoryPanel from './components/CategoryPanel.vue'

const config = ref(null)
const editors = ref([])
const templates = ref([])
const categories = ref({ platforms: [], novelTypes: [] })
const selectedIds = ref([])

const selectedEditors = computed(() => editors.value.filter((e) => selectedIds.value.includes(e.id)))

async function load(fn, target) {
  try {
    target.value = await fn()
  } catch (err) {
    Message.error(err.message)
  }
}

const loadEditors = () => load(api.getEditors, editors)
const loadTemplates = () => load(api.getTemplates, templates)
const loadCategories = () => load(api.getCategories, categories)

onMounted(() => {
  load(api.getConfig, config)
  loadEditors()
  loadTemplates()
  loadCategories()
})
</script>

<style>
body {
  margin: 0;
  background: var(--color-fill-2);
}
.layout {
  min-height: 100vh;
}
.header {
  padding: 0 24px;
  height: 56px;
  line-height: 56px;
  font-size: 18px;
  font-weight: 600;
  background: var(--color-bg-2);
  border-bottom: 1px solid var(--color-border);
}
.content {
  padding: 16px 24px;
}
.mb {
  margin-bottom: 12px;
}
</style>
