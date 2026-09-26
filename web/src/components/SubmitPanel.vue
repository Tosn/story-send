<template>
  <a-card title="投稿">
    <template #extra>
      <a-popconfirm content="将清空附件、书名/类型/字数、主题正文和发送结果，并恢复默认模板，确认重置？" @ok="resetAll">
        <a-button size="small" :disabled="sending">
          <template #icon><icon-refresh /></template>重置
        </a-button>
      </a-popconfirm>
    </template>
    <a-form layout="vertical" :disabled="sending">
      <a-form-item label="附件">
        <div class="full">
          <a-upload
            v-model:file-list="fileList"
            :auto-upload="false"
            :limit="1"
            @change="onFileChange"
          />
          <a-row v-if="file" :gutter="8" class="mt">
            <a-col :span="12">
              <a-input v-model="fields.书名"><template #prepend>书名</template></a-input>
            </a-col>
            <a-col :span="6">
              <a-input v-model="fields.类型"><template #prepend>类型</template></a-input>
            </a-col>
            <a-col :span="6">
              <a-input v-model="fields.字数"><template #prepend>字数</template></a-input>
            </a-col>
          </a-row>
          <a-alert v-if="file && missingFields.length" type="warning" class="mt">
            文件名未能识别出：{{ missingFields.join('、') }}，请手动填写
          </a-alert>
        </div>
      </a-form-item>

      <a-form-item label="模板">
        <a-select v-model="templateId">
          <a-option v-for="t in templates" :key="t.id" :value="t.id">
            {{ t.name }}{{ t.isDefault ? '（默认）' : '' }}
          </a-option>
        </a-select>
      </a-form-item>

      <a-form-item label="主题">
        <a-input v-model="subject" />
      </a-form-item>
      <a-form-item label="正文（预览，可直接修改）">
        <a-textarea v-model="body" :auto-size="{ minRows: 8 }" />
      </a-form-item>
    </a-form>

    <a-collapse v-model:active-key="collapseKeys" class="mb">
      <a-collapse-item key="recipients" :header="`收件人（${editors.length}）`">
        <a-space wrap>
          <a-tag v-for="e in editors" :key="e.id">{{ e.name }}</a-tag>
          <a-typography-text v-if="!editors.length" type="secondary">请在左侧勾选编辑</a-typography-text>
        </a-space>
      </a-collapse-item>
    </a-collapse>

    <a-space class="mb">
      <a-button :disabled="sending" @click="regenerate">重新生成</a-button>
      <a-button type="primary" :loading="sending" @click="confirmSend">
        <template #icon><icon-send /></template>一键投稿
      </a-button>
    </a-space>

    <a-list v-if="results.length" size="small" class="mb">
      <a-list-item v-for="r in results" :key="r.id">
        <a-space>
          <a-tag :color="STATUS[r.status].color">{{ STATUS[r.status].text }}</a-tag>
          <span>{{ r.name }} &lt;{{ r.email }}&gt;</span>
          <a-typography-text v-if="r.error" type="danger">{{ r.error }}</a-typography-text>
        </a-space>
      </a-list-item>
    </a-list>
    <a-alert v-if="summary" :type="summary.failed ? 'warning' : 'success'">
      发送完成：成功 {{ summary.success }} / 失败 {{ summary.failed }}
    </a-alert>
  </a-card>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { sendMail } from '../api.js'
import { parseFilename, fillTemplate } from '../parseFilename.js'

const props = defineProps({
  editors: { type: Array, required: true },
  templates: { type: Array, required: true },
  config: { type: Object, default: null }
})

const STATUS = {
  waiting: { text: '等待中', color: 'gray' },
  sending: { text: '发送中', color: 'arcoblue' },
  success: { text: '成功', color: 'green' },
  failed: { text: '失败', color: 'red' }
}

const fileList = ref([])
const file = ref(null)
const contentBase64 = ref('')
const fields = reactive({ 书名: '', 类型: '', 字数: '' })
const missingFields = computed(() => ['书名', '类型', '字数'].filter((k) => !fields[k].trim()))

function readBase64(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(f)
  })
}

async function onFileChange(list) {
  const f = list[0]?.file || null
  file.value = f
  contentBase64.value = ''
  Object.assign(fields, f ? parseFilename(f.name) : { 书名: '', 类型: '', 字数: '' })
  // 文件名中没有类型时默认短篇
  if (f && !fields.类型) fields.类型 = '短篇'
  if (!f) return
  try {
    contentBase64.value = await readBase64(f)
  } catch (err) {
    Message.error(`读取附件失败：${err.message}`)
  }
}

// 模板：默认选中默认模板；当前模板被删除时回到默认模板
const templateId = ref('')
watch(
  () => props.templates,
  (list) => {
    if (!list.some((t) => t.id === templateId.value)) {
      templateId.value = (list.find((t) => t.isDefault) || list[0])?.id || ''
    }
  },
  { immediate: true }
)
const currentTemplate = computed(() => props.templates.find((t) => t.id === templateId.value))

const subject = ref('')
const body = ref('')

function regenerate() {
  const t = currentTemplate.value
  if (!t) return
  subject.value = fillTemplate(t.subject, fields)
  body.value = fillTemplate(t.body, fields)
}

// 选了新附件、换了模板或修改书名/类型/字数时重新生成（覆盖手动修改）
watch([file, templateId, () => ({ ...fields })], regenerate, { immediate: true })

const sending = ref(false)
const results = ref([])
const summary = ref(null)

function confirmSend() {
  if (!props.editors.length) return Message.warning('请先勾选编辑')
  if (!file.value || !contentBase64.value) return Message.warning('请先选择附件')
  if (missingFields.value.length) return Message.warning(`请填写：${missingFields.value.join('、')}`)
  if (!/^\d+$/.test(fields.字数.trim())) return Message.warning('字数需为数字')
  if (!subject.value.trim() || !body.value.trim()) return Message.warning('主题和正文不能为空')
  const title = fields.书名.trim()
  Modal.confirm({
    title: '确认投稿',
    content: `将向 ${props.editors.length} 位编辑分别发送《${title}》，确认？`,
    onOk: () => {
      send()
    }
  })
}

const collapseKeys = ref([])

// 重置右侧投稿面板的所有状态，收件人由左侧同步，不在此处理
function resetAll() {
  fileList.value = []
  file.value = null
  contentBase64.value = ''
  Object.assign(fields, { 书名: '', 类型: '', 字数: '' })
  templateId.value = (props.templates.find((t) => t.isDefault) || props.templates[0])?.id || ''
  results.value = []
  summary.value = null
  collapseKeys.value = []
  regenerate()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function send() {
  sending.value = true
  summary.value = null
  results.value = props.editors.map((e) => ({ id: e.id, name: e.name, email: e.email, status: 'waiting', error: '' }))
  const interval = props.config?.sendIntervalMs ?? 1000
  const payload = {
    subject: subject.value,
    text: body.value,
    filename: file.value.name,
    contentBase64: contentBase64.value
  }
  for (let i = 0; i < results.value.length; i++) {
    const r = results.value[i]
    r.status = 'sending'
    try {
      await sendMail({ ...payload, to: r.email })
      r.status = 'success'
    } catch (err) {
      r.status = 'failed'
      r.error = err.message
    }
    if (i < results.value.length - 1 && interval > 0) await sleep(interval)
  }
  const success = results.value.filter((r) => r.status === 'success').length
  summary.value = { success, failed: results.value.length - success }
  sending.value = false
}
</script>

<style scoped>
.full {
  width: 100%;
}
.mt {
  margin-top: 8px;
}
.mb {
  margin-bottom: 12px;
}
</style>
