<template>
  <CrudTable title="问卷问题管理" entity-name="问卷问题" api-endpoint="/surveys/questions" :columns="columns"
    :form-fields="formFields" :search-fields="searchFields" :pagination="true" :page-size="10" />
</template>

<script setup>
import CrudTable from '@/views/admin/components/CrudTable.vue'

// 问题类型映射
const questionTypeMap = {
  'single_choice': '单选题',
  'multiple_choice': '多选题',
  'text': '文本题'
}

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'question_text', label: '问题内容', sortable: false, maxLength: 50 },
  { key: 'question_type', label: '问题类型', type: 'mapped', map: questionTypeMap, sortable: true },
  { key: 'options', label: '选项', type: 'content', sortable: false },
  { key: 'answer', label: '答案', type: 'text', sortable: false },
  { key: 'sort_order', label: '排序', sortable: true },
  { key: 'is_required', label: '是否必填', type: 'boolean', trueText: '是', falseText: '否', sortable: true },
  // { key: 'survey_id', label: '问卷ID', sortable: true },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true },
  { key: 'updated_at', label: '更新时间', type: 'date', sortable: true }
]

const formFields = [
  // { key: 'survey_id', label: '问卷ID', type: 'number', required: true, placeholder: '请输入问卷ID', editable: false },
  { key: 'question_text', label: '问题内容', type: 'textarea', required: true, placeholder: '请输入问题内容', rows: 3 },
  { key: 'is_required', label: '是否必填', type: 'checkbox', required: false, editable: false },

  {
    key: 'question_type', label: '问题类型', type: 'select', required: true, placeholder: '请选择问题类型', options: [
      { value: 'single_choice', label: '单选题' },
      { value: 'multiple_choice', label: '多选题' },
      { value: 'text', label: '文本题' }
    ]
  },
  { key: 'options', label: '选项配置', type: 'textarea', required: false, placeholder: '请以JSON格式输入选项，例如：{"A":"选项A","B":"选项B"}', rows: 4, description: '单选题和多选题需要配置选项，文本题无需配置' },
  { key: 'answer', label: '答案选项', type: 'text', required: true, placeholder: '请输入正确答案选项（如A、B、C等）' },
  { key: 'sort_order', label: '排序序号', type: 'number', required: true, placeholder: '请输入排序序号', editable: false },
]

const searchFields = [
  { key: 'survey_id', label: '问卷ID', type: 'number', placeholder: '搜索问卷ID' },
  { key: 'question_text', label: '问题内容', placeholder: '搜索问题内容' },
  {
    key: 'question_type', label: '问题类型', type: 'select', options: [
      { value: 'single_choice', label: '单选题' },
      { value: 'multiple_choice', label: '多选题' },
      { value: 'text', label: '文本题' }
    ]
  }
]
</script>