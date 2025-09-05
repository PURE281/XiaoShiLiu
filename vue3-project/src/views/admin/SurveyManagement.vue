<template>
  <CrudTable title="问卷管理" entity-name="问卷" api-endpoint="/admin/surveys" :columns="columns" :form-fields="formFields"
    :search-fields="searchFields" />
</template>

<script setup>
import CrudTable from '@/views/admin/components/CrudTable.vue'

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'title', label: '问卷标题', sortable: true, maxLength: 20 },
  { key: 'description', label: '问卷描述', sortable: false, maxLength: 30 },
  { key: 'status', label: '状态', type: 'mapped', map: { 'published': '已发布', 'draft': '草稿' }, sortable: true },
  { key: 'question_count', label: '问题数量', sortable: true },
  { key: 'response_count', label: '回答数量', sortable: true },
  { key: 'user_id', label: '创建人ID', sortable: false },
  { key: 'created_at', label: '创建时间', type: 'date', sortable: true },
  { key: 'updated_at', label: '更新时间', type: 'date', sortable: true }
]

const formFields = [
  { key: 'title', label: '问卷标题', type: 'text', required: true, placeholder: '请输入问卷标题' },
  { key: 'description', label: '问卷描述', type: 'textarea', required: false, placeholder: '请输入问卷描述' },
  { key: 'status', label: '状态', type: 'select', required: true, placeholder: '请选择状态', options: [
    { value: 'draft', label: '草稿' },
    { value: 'published', label: '已发布' }
  ]},
  { key: 'user_id', label: '创建人ID', type: 'number', required: true, placeholder: '请输入创建人ID' },
  { key: 'questions', label: '问题列表', type: 'textarea', required: false, placeholder: '请以JSON格式输入问题列表', rows: 6 }
]

const searchFields = [
  { key: 'title', label: '问卷标题', placeholder: '搜索问卷标题' },
  { key: 'status', label: '状态', type: 'select', options: [
    { value: 'published', label: '已发布' },
    { value: 'draft', label: '草稿' }
  ]},
  { key: 'user_id', label: '创建人ID', type: 'number', placeholder: '搜索创建人ID' }
]
</script>