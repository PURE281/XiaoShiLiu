const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { success, error, handleError } = require('../utils/responseHelper');
const { getRecords, createRecord, updateRecord } = require('../utils/dbHelper');

// 获取问卷问题列表（分页）
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const questions = await getRecords('survey_questions', {
      page,
      limit,
      orderBy: 'sort_order ASC'
    });
    
    success(res, questions, '获取问卷问题成功');
  } catch (err) {
    handleError(err, res, '获取问卷问题');
  }
});

// 保存用户的部分问卷回答
router.post('/responses/save', authenticateToken, async (req, res) => {
  try {
    const { answers } = req.body;
    const userId = req.user.id;
    
    if (!answers || !Array.isArray(answers)) {
      return error(res, '回答数据格式错误', 400, 400);
    }
    
    // 检查是否已存在未完成的回答记录
    const [existingRecord] = await pool.execute(
      'SELECT id FROM survey_responses WHERE user_id = ? AND is_complete = 0',
      [userId]
    );
    
    let responseId;
    
    if (existingRecord.length > 0) {
      // 更新现有记录
      responseId = existingRecord[0].id;
      await updateRecord('survey_responses', responseId, {
        answers: JSON.stringify(answers),
        updated_at: new Date()
      });
    } else {
      // 创建新记录
      responseId = await createRecord('survey_responses', {
        user_id: userId,
        answers: JSON.stringify(answers),
        is_complete: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    success(res, { responseId }, '保存回答成功');
  } catch (err) {
    handleError(err, res, '保存问卷回答');
  }
});

// 提交问卷并计算分数
router.post('/responses/submit', authenticateToken, async (req, res) => {
  try {
    const { answers } = req.body;
    const userId = req.user.id;
    
    if (!answers || !Array.isArray(answers)) {
      return error(res, '回答数据格式错误', 400, 400);
    }
    
    // 计算分数（每一题一分）
    const score = answers.length;
    const isPassed = score >= 60;
    
    // 检查是否已存在未完成的回答记录
    const [existingRecord] = await pool.execute(
      'SELECT id FROM survey_responses WHERE user_id = ? AND is_complete = 0',
      [userId]
    );
    
    if (existingRecord.length > 0) {
      // 更新现有记录
      await updateRecord('survey_responses', existingRecord[0].id, {
        answers: JSON.stringify(answers),
        score,
        is_complete: 1,
        is_passed: isPassed ? 1 : 0,
        updated_at: new Date()
      });
    } else {
      // 创建新记录
      await createRecord('survey_responses', {
        user_id: userId,
        answers: JSON.stringify(answers),
        score,
        is_complete: 1,
        is_passed: isPassed ? 1 : 0,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    // 如果通过，更新用户的isVerified字段
    if (isPassed) {
      await pool.execute(
        'UPDATE users SET is_verified = 1, updated_at = NOW() WHERE id = ?',
        [userId]
      );
    }
    
    success(res, { score, isPassed }, '问卷提交成功');
  } catch (err) {
    handleError(err, res, '提交问卷');
  }
});

// 获取用户的问卷状态
router.get('/responses/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 检查用户是否已通过问卷
    const [userRecord] = await pool.execute(
      'SELECT is_verified FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRecord.length > 0 && userRecord[0].is_verified === 1) {
      return success(res, { isVerified: true, status: 'passed' }, '用户已通过问卷');
    }
    
    // 检查用户是否有未完成的问卷回答
    const [responseRecord] = await pool.execute(
      'SELECT id, answers FROM survey_responses WHERE user_id = ? AND is_complete = 0',
      [userId]
    );
    
    if (responseRecord.length > 0) {
      return success(res, {
        isVerified: false,
        status: 'in_progress',
        lastAnswers: JSON.parse(responseRecord[0].answers)
      }, '用户有未完成的问卷');
    }
    
    // 用户尚未开始问卷
    success(res, {
      isVerified: false,
      status: 'not_started'
    }, '用户尚未开始问卷');
  } catch (err) {
    handleError(err, res, '获取问卷状态');
  }
});

module.exports = router;