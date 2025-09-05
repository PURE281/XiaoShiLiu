-- 问卷管理功能数据库初始化脚本
USE `xiaoshiliu_community`;

CREATE TABLE IF NOT EXISTS `survey_questions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '问题ID',
  `question_text` text NOT NULL COMMENT '问题文本',
  `question_type` varchar(50) NOT NULL COMMENT '问题类型（single_choice/multiple_choice/text/checkbox）',
  `options` json DEFAULT NULL COMMENT '选项（JSON格式，用于选择题）',
  `sort_order` int(11) NOT NULL COMMENT '排序顺序',
  `is_required` tinyint(1) DEFAULT 0 COMMENT '是否必填',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问卷问题表';

-- 3. 创建问卷回答表
CREATE TABLE IF NOT EXISTS `survey_responses` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '回答ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `answers` json NOT NULL COMMENT '回答内容（JSON格式）',
  `score` int(11) DEFAULT NULL COMMENT '得分',
  `is_complete` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否完成（1=是，0=否）',
  `is_passed` tinyint(1) DEFAULT NULL COMMENT '是否通过（1=是，0=否）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_complete` (`is_complete`),
  KEY `idx_is_passed` (`is_passed`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `survey_responses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问卷回答表';

-- 4. 插入示例问卷问题（100道示例题，这里只展示部分）
INSERT INTO `survey_questions` (`question_text`, `question_type`, `options`, `sort_order`, `is_required`)
VALUES
  ('HTML的全称为？', 'single_choice', '{"A": "Hyperlinks and Text Markup Language", "B": "Home Tool Markup Language", "C": "Hyper Text Markup Language", "D": "Hyper Technical Modern Language"}', 1, 1),
  ('CSS的作用是什么？', 'single_choice', '{"A": "增加网页的交互性", "B": "控制网页的样式和布局", "C": "管理数据库", "D": "处理后端逻辑"}', 2, 1),
  ('JavaScript是什么类型的语言？', 'single_choice', '{"A": "编译型语言", "B": "解释型语言", "C": "汇编语言", "D": "机器语言"}', 3, 1),
  ('以下哪些是JavaScript的基本数据类型？（多选）', 'multiple_choice', '{"A": "Number", "B": "String", "C": "Array", "D": "Object", "E": "Boolean"}', 4, 1),
  ('请简述你对前端开发的理解。', 'text', NULL, 5, 1),
  ('Vue.js的核心特性有哪些？（多选）', 'multiple_choice', '{"A": "响应式数据绑定", "B": "组件系统", "C": "虚拟DOM", "D": "双向数据绑定"}', 6, 1),
  ('React中使用什么方法来处理组件的生命周期？', 'single_choice', '{"A": "钩子函数", "B": "事件监听", "C": "回调函数", "D": "以上都不是"}', 7, 1),
  ('什么是RESTful API？', 'text', NULL, 8, 1),
  ('请列举几种常见的HTTP状态码及其含义。', 'text', NULL, 9, 1),
  ('以下哪些属于前端性能优化的方法？（多选）', 'multiple_choice', '{"A": "减少HTTP请求", "B": "使用CDN", "C": "压缩资源文件", "D": "延迟加载非关键资源", "E": "使用缓存策略"}', 10, 1),
  ('Node.js是什么？', 'single_choice', '{"A": "一种编程语言", "B": "一个JavaScript运行环境", "C": "一个前端框架", "D": "一个数据库"}', 11, 1),
  ('什么是跨域？如何解决跨域问题？', 'text', NULL, 12, 1),
  ('Git的基本工作流程是什么？', 'text', NULL, 13, 1),
  ('什么是CSS预处理器？请列举几个常见的CSS预处理器。', 'text', NULL, 14, 1),
  ('HTML5新增了哪些语义化标签？', 'text', NULL, 15, 1),
  ('什么是Flexbox？它的主要用途是什么？', 'text', NULL, 16, 1),
  ('什么是Webpack？它的主要功能是什么？', 'text', NULL, 17, 1),
  ('什么是TypeScript？它与JavaScript有什么区别？', 'text', NULL, 18, 1),
  ('什么是前端框架？请列举几个流行的前端框架。', 'text', NULL, 19, 1),
  ('什么是响应式设计？如何实现响应式设计？', 'text', NULL, 20, 1);

-- 5. 插入示例问卷回答记录
-- 注意：这里的user_id需要替换为实际存在的用户ID
-- INSERT INTO `survey_responses` (`user_id`, `answers`, `score`, `is_complete`, `is_passed`)
-- VALUES
--   (1, '{"1": "C", "2": "B", "3": "B", "4": ["A", "B", "E"]}', 65, 1, 1),
--   (2, '{"1": "A", "2": "B", "3": "A"}', 30, 0, NULL);

-- 数据库初始化完成
SELECT '问卷管理功能数据库初始化完成！' AS message;