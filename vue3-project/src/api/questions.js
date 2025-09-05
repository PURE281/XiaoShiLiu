
import request from './request';

// 获取问卷问题列表（支持分页）
export const getSurveyQuestions = async (page = 1, limit = 5) => {
  try {
    const response = await request.get('/surveys/questions', {
      params: { page, limit }
    });
    return response.data;
  } catch (error) {
    console.error('获取问卷问题失败:', error);
    throw error;
  }
};

// 提交问卷答案
export const submitSurveyAnswers = async (answers) => {
  try {
    const response = await request.post('/surveys/responses/submit', answers);
    return response.data;
  } catch (error) {
    console.error('提交问卷答案失败:', error);
    throw error;
  }
};