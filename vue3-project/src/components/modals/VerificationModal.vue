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

          <!-- 加载状态 -->
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>加载问题中...</p>
          </div>

          <!-- 错误提示 -->
          <div v-if="error" class="error-state">
            <p class="error-message">{{ error }}</p>
            <button @click="loadQuestions" class="retry-button">重试</button>
          </div>

          <!-- 问卷题目 -->
          <div v-else class="questions-container">
            <div class="question-item" v-for="(question, index) in questions" :key="index">
              <h4 class="question-text">{{ (currentPage - 1) * 5 + index + 1 }}. {{ question.question_text }}</h4>
              <div class="answer-options">
                <label class="answer-option" v-for="(option, optionIndex) in Object.values(question.options || {})"
                  :key="optionIndex">
                  <input type="radio" :name="`question-${index}`" :value="String.fromCharCode(65 + optionIndex)"
                    v-model="answers[currentPage][index]" class="answer-input" />
                  <span class="option-text">{{ String.fromCharCode(65 + optionIndex) }}. {{ option }}</span>
                </label>
              </div>
            </div>

          </div>



          <!-- 认证结果 -->
          <div v-if="showResult" class="verification-result">
            <div v-if="isPassed" class="result-passed">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#4CAF50" class="success-icon">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <h4>认证成功！</h4>
              <p>恭喜您获得{{ score }}分，已通过认证。</p>
            </div>
            <div v-else class="result-failed">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#f44336" class="error-icon">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <h4>认证未通过</h4>
              <p>您获得了{{ score }}分，需要达到60分才能通过认证。</p>
              <button class="retry-button" @click="resetForm">重新尝试</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <!-- 分页控件 -->
      <div class="pagination-controls">
        <button @click="previousPage" :disabled="currentPage === 1 || loading">上一页</button>
        <span class="page-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button @click="nextPage" :disabled="currentPage*5 >= totalPages || loading">下一页</button>
      </div>
        <button class="submit-button" @click="handleSubmit"
          :disabled="isSubmitting || showResult || !isAllPagesComplete">
          {{ isSubmitting ? '提交中...' : '提交' }}
        </button>
      </div>
      
    </div>
  </div>

</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { getSurveyQuestions, submitSurveyAnswers } from '@/api/questions'

const props = defineProps({
  // 这个组件通过v-if控制显示，所以不需要额外的isOpen prop
})

const emit = defineEmits(['close', 'success'])

const userStore = useUserStore()

// 分页相关状态
const currentPage = ref(1);
const totalPages = ref(0);
const questionsByPage = ref({}); // 按页存储所有问题
const questions = computed(() => questionsByPage.value[currentPage.value] || []);
const loading = ref(false);
const error = ref(null);

// 从API加载问题
// 上一页
const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

// 下一页
const nextPage = () => {
  console.log(currentPage.value);
  if (currentPage.value*5 < totalPages.value) {
    currentPage.value++;
    loadQuestions();
  }
};

const loadQuestions = async () => {
  // 如果已经加载过该页问题，直接返回
  if (questionsByPage.value[currentPage.value]) {
    return;
  }

  loading.value = true;
  error.value = null;

  let pageQuestions = [];
  try {
    const response = await getSurveyQuestions(currentPage.value, 5);
    // 解析选项JSON并处理数据
    pageQuestions = (response.data || []).map(q => ({
      ...q,
      options: q.options || {}
    }));
    questionsByPage.value[currentPage.value] = pageQuestions;
    totalPages.value = response.pagination?.total || 0;

    // 初始化当前页答案数组
    if (!answers.value[currentPage.value]) {
      answers.value[currentPage.value] = new Array(questions.value.length).fill(null);
    }
  } catch (err) {
    error.value = '加载问题失败，请重试';
    console.error('Failed to load questions:', err);
  } finally {
    loading.value = false;
  }
};

// 监听当前页变化加载问题
watch(currentPage, loadQuestions);

// 用户答案 - 按页存储
const answers = ref({})
const isSubmitting = ref(false)
const showResult = ref(false)
const score = ref(0)
const isPassed = ref(false)

// 检查当前页表单是否完整
const isCurrentPageComplete = computed(() => {
  const pageAnswers = answers.value[currentPage.value] || [];
  return pageAnswers.length > 0 && pageAnswers.every(answer => answer !== null);
})

// 检查所有页面是否完成
const isAllPagesComplete = computed(() => {
  // 如果没有问题，返回false
  if (totalPages.value === 0) {
    return false;
  }
  
  // 遍历所有已加载的页面
  for (const page of Object.keys(questionsByPage.value)) {
    const pageNum = parseInt(page);
    const pageAnswers = answers.value[pageNum] || [];
    const pageQuestions = questionsByPage.value[pageNum] || [];
    
    // 检查当前页是否有答案，且答案数量与问题数量匹配
    if (pageAnswers.length !== pageQuestions.length || pageAnswers.some(answer => answer === null)) {
      return false;
    }
  }
  
  return true;
})


// 处理关闭模态框
const handleClose = () => {
  emit('close')
  if (!isSubmitting) {
    console.log('触发close事件')
    emit('close')
  }
}

// 计算分数（整合所有页面答案）
const calculateScore = () => {
  let totalScore = 0;
  const allAnswers = [];

  // 收集所有页面的答案
  for (let i = 1; i <= totalPages.value; i++) {
    if (answers.value[i]) {
      allAnswers.push(...answers.value[i]);
    }
  }

  // 根据正确答案计算分数
  allAnswers.forEach((answer, index) => {
    // 查找对应的问题
    let question = null;
    // 遍历所有页面查找匹配的问题
    Object.values(questionsByPage.value).forEach(pageQuestions => {
      const found = pageQuestions.find(q => q.index === index);
      if (found) question = found;
    });

    if (question && answer === question.answer) {
      totalScore += 100 / allAnswers.length; // 平均分
    }
  });

  return totalScore;
}

// 处理提交问卷
// 提交表单
const handleSubmit = async () => {
  if (!isAllPagesComplete.value) return;

  isSubmitting.value = true;
  try {
    // 收集所有答案数据
    const submissionData = [];

    // 遍历所有页面
    Object.keys(questionsByPage.value).forEach(page => {
      const pageQuestions = questionsByPage.value[page];
      const pageAnswers = answers.value[page] || [];

      // 遍历当前页问题
      pageQuestions.forEach((question, index) => {
        const userAnswer = pageAnswers[index];
        if (userAnswer !== null) {
          submissionData.push({
            questionId: question.id,
            userAnswer: userAnswer
          });
        }
      });
    });

    // 调用API提交答案
    await submitSurveyAnswers(submissionData);

    // 计算分数并显示结果
    score.value = calculateScore();
    isPassed.value = score.value >= 60;
    showResult.value = true;

    if (isPassed.value) {
      emit('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  } catch (error) {
    console.error('提交失败:', error);
    alert('提交失败，请重试');
  } finally {
    isSubmitting.value = false;
  }
}

// 重置表单
const resetForm = () => {
  currentPage.value = 1;
  answers.value = {};
  showResult.value = false;
  score.value = 0;
  isPassed.value = false;
  loadQuestions();
}

// 当组件挂载时加载第一页问题
onMounted(() => {
  loadQuestions()
})
</script>

<style scoped>
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding-top: 1rem;
  /* border-top: 1px solid #e5e7eb; */
  width: 100%;
  box-sizing: border-box;
}

.pagination-controls button {
  padding: 0.5rem 1rem;
  border: 1px solid #4f46e5;
  border-radius: 4px;
  background-color: #4f46e5;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-controls button:disabled {
  background-color: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
}

.pagination-controls button:not(:disabled):hover {
  background-color: #4338ca;
}

.page-info {
  color: #6b7280;
  font-size: 0.9rem;
}
</style>

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

.result-passed,
.result-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.result-passed h4,
.result-failed h4 {
  margin: 16px 0 8px;
  font-size: 20px;
}

.result-passed p,
.result-failed p {
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
  padding: 12px 28px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  outline: none;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--primary-color-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.2);
}

.submit-button:focus-visible {
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
}

.submit-button:disabled {
  background-color: var(--bg-color-disabled);
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
  box-shadow: none;
}
</style>