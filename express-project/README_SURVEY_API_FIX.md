# 问卷管理API修复说明

## 问题描述

您反馈前端调用 `/api/admin/surveys?page=1&limit=20&title=&status=&user_id=` 时提示接口不存在。这是因为在admin路由中确实缺少了`/surveys`这个接口定义。

## 解决方案

我已经在 `admin.js` 文件中添加了 `/surveys` 路由，现在该接口可以正常处理前端发送的查询请求。同时，我保留了原有的 `/survey-responses` 路由以确保兼容性。

## 添加的接口说明

### `/api/admin/surveys` 接口

- **请求方法**: GET
- **认证要求**: 需要管理员JWT令牌
- **参数说明**:
  - `page`: 页码，默认为1
  - `limit`: 每页记录数，默认为20
  - `title`: 标题筛选（当前版本仅记录日志，不实际过滤）
  - `status`: 状态筛选（0表示未完成，1表示已完成）
  - `user_id`: 用户ID筛选

- **返回格式**:
  ```json
  {
    "code": 200,
    "message": "获取问卷回答记录成功",
    "data": {
      "data": [
        {
          "id": 1,
          "user_id": 101,
          "answers": "{...}", // JSON字符串格式的回答
          "score": 85,
          "is_complete": 1,
          "is_passed": 1,
          "created_at": "2023-05-10T10:30:00.000Z",
          "updated_at": "2023-05-10T10:45:00.000Z"
        }
        // ... 更多记录
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "pages": 8
      }
    }
  }
  ```

## 现有接口兼容性

原有的 `/api/admin/survey-responses` 接口仍然保留，功能与新添加的 `/api/admin/surveys` 接口基本相同，只是参数名称略有差异。如果前端需要，可以继续使用该接口。

## 使用建议

1. 前端可以直接使用 `/api/admin/surveys` 接口进行查询
2. 如需根据问卷标题进行筛选，可能需要进一步开发关联查询功能
3. 建议前端统一使用新的 `/api/admin/surveys` 接口，以保持代码的一致性

如果您在使用过程中遇到任何问题或需要进一步的功能开发，请随时告知。