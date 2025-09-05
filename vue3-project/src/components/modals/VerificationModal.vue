<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">用户认证</h3>
        <button class="close-button" @click="handleClose" aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="verification-form">
          <p class="verification-description">
            完成以下问卷，达到60分及以上即可获得认证标识。
          </p>
          
          <!-- 问卷题目 -->
          <div class="question-item" v-for="(question, index) in questions" :key="index">
            <h4 class="question-text">{{ index + 1 }}. {{ question.text }}</h4>
            <div class="answer-options">
              <label class="answer-option" v-for="(option, optionIndex) in question.options" :key="optionIndex">
                <input 
                  type="radio" 
                  :name="`question-${index}`" 
                  :value="optionIndex" 
                  v-model="answers[index]"
                  class="answer-input"
                />
                <span class="option-text">{{ option }}</span>
              </label>
            </div>
          </div>
          
          <!-- 认证结果 -->
          <div v-if="showResult" class="verification-result">
            <div v-if="isPassed" class="result-passed">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#4CAF50" class="success-icon">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h4>认证成功！</h4>
              <p>恭喜您获得{{ score }}分，已通过认证。</p>
            </div>
            <div v-else class="result-failed">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#f44336" class="error-icon">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <h4>认证未通过</h4>
              <p>您获得了{{ score }}分，需要达到60分才能通过认证。</p>
              <button class="retry-button" @click="resetForm">重新尝试</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          class="submit-button" 
          @click="handleSubmit" 
          :disabled="isSubmitting || showResult || !isFormComplete"
        >
          {{ isSubmitting ? '提交中...' : '提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  // 这个组件通过v-if控制显示，所以不需要额外的isOpen prop
})

const emit = defineEmits(['close', 'success'])

const userStore = useUserStore()

// 问卷题目（模拟数据）
const questions = ref([
  {
    text: '您如何描述自己使用本平台的频率？',
    options: ['偶尔使用', '每周几次', '每天都用', '经常使用并积极参与讨论']
  },
  {
    text: '您在本平台主要进行哪些活动？',
    options: ['浏览内容', '发布内容', '评论互动', '关注其他用户']
  },
  {
    text: '您是否愿意在个人资料中提供真实信息？',
    options: ['不愿意', '可以提供部分信息', '愿意提供基本信息', '愿意提供详细信息']
  },
  {
    text: '您对平台社区规范的了解程度？',
    options: ['不了解', '了解一点', '基本了解', '非常了解']
  },
  {
    text: '您认为自己对平台社区的贡献度如何？',
    options: ['几乎没有', '一般', '较有贡献', '贡献很大']
  }
])

// 用户答案
const answers = ref(new Array(questions.value.length).fill(null))
const isSubmitting = ref(false)
const showResult = ref(false)
const score = ref(0)
const isPassed = ref(false)

// 检查表单是否完整
const isFormComplete = computed(() => {
  return answers.value.every(answer => answer !== null)
})

// 处理关闭模态框
const handleClose = () => {
  console.log(321)
  emit('close')
  if (!isSubmitting) {
    console.log('触发close事件')
    emit('close')
  }
}

// 计算分数（模拟逻辑）
const calculateScore = () => {
  let totalScore = 0
  
  answers.value.forEach((answer, index) => {
    // 每个选项对应不同的分数
    // 选项索引越大，分数越高
    switch (answer) {
      case 0:
        totalScore += 10
        break
      case 1:
        totalScore += 15
        break
      case 2:
        totalScore += 20
        break
      case 3:
        totalScore += 25
        break
    }
  })
  
  // 增加一些随机因素，让分数更真实
  const randomAdjustment = Math.floor(Math.random() * 10) - 5
  totalScore = Math.max(0, Math.min(100, totalScore + randomAdjustment))
  
  return totalScore
}

// 处理提交问卷
const handleSubmit = async () => {
  if (!isFormComplete.value || isSubmitting.value || showResult.value) {
    return
  }
  
  try {
    isSubmitting.value = true
    
    // 模拟API请求延迟
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // 计算分数
    score.value = calculateScore()
    isPassed.value = score.value >= 60
    showResult.value = true
    
    // 如果通过认证，更新用户状态
    if (isPassed.value) {
      await userStore.submitVerificationSurvey({ 
        answers: answers.value, 
        score: score.value 
      })
      emit('success')
      isSubmitting.value = true
      // 认证成功后显示结果2秒，然后自动关闭模态框
      setTimeout(() => {
        handleClose()
      }, 2000)
    }
  } catch (error) {
    console.error('提交认证问卷失败:', error)
    // 这里可以添加错误提示
  } finally {
    isSubmitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  answers.value = new Array(questions.value.length).fill(null)
  showResult.value = false
  score.value = 0
  isPassed.value = false
}

// 当组件挂载时重置表单
onMounted(() => {
  resetForm()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-color-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color-primary);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-color-secondary);
  transition: all 0.2s ease;
}

.close-button:hover {
  background-color: var(--bg-color-secondary);
  color: var(--text-color-primary);
}

.modal-body {
  padding: 24px;
}

.verification-form {
  max-width: 500px;
  margin: 0 auto;
}

.verification-description {
  margin-bottom: 24px;
  color: var(--text-color-secondary);
  line-height: 1.6;
}

.question-item {
  margin-bottom: 24px;
}

.question-text {
  font-size: 16px;
  margin-bottom: 12px;
  font-weight: 500;
}

.answer-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.answer-option {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.answer-option:hover {
  background-color: var(--bg-color-secondary);
}

.answer-input {
  margin-right: 8px;
}

.option-text {
  font-size: 14px;
}

.verification-result {
  text-align: center;
  padding: 30px 0;
}

.result-passed, .result-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.result-passed h4, .result-failed h4 {
  margin: 16px 0 8px;
  font-size: 20px;
}

.result-passed p, .result-failed p {
  color: var(--text-color-secondary);
  margin-bottom: 16px;
}

.retry-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background-color: var(--primary-color-hover);
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color-primary);
  display: flex;
  justify-content: flex-end;
}

.submit-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--primary-color-hover);
}

.submit-button:disabled {
  background-color: var(--bg-color-disabled);
  cursor: not-allowed;
}
</style>