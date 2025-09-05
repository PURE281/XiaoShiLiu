# 问卷管理功能 - 路径修复说明

## 问题原因

您遇到的无法进入 `/admin/surveys/questions` 页面并提示404的问题，是因为**菜单中配置的路径与实际API路由定义不匹配**。

具体来说：
- 在管理员菜单中，问卷问题管理的路径配置为 `/surveys/questions`
- 但在实际的代码中，API路由定义为 `/survey-questions`
- 同样，问卷回答记录的路径配置为 `/surveys/responses`，而实际路由为 `/survey-responses`

## 解决方案

我已经修复了 `admin.js` 文件中的 `getAdminMenu` 函数，将菜单路径与实际路由保持一致：

- 问卷问题管理路径已从 `/surveys/questions` 修改为 `/survey-questions`
- 问卷回答记录路径已从 `/surveys/responses` 修改为 `/survey-responses`

## 验证方法

1. 刷新管理员页面，重新获取菜单
2. 点击问卷管理下的子菜单，现在应该能够正确导航到相应页面
3. 您也可以直接在浏览器中访问以下路径测试：
   - 问卷问题管理: `/admin/survey-questions`
   - 问卷回答记录: `/admin/survey-responses`

## 后续建议

1. 如果前端使用了静态菜单配置，请确保同步更新为新的路径
2. 建议前端通过调用 `/api/admin/menu` 接口动态获取菜单，这样可以避免路径不一致的问题
3. 在实现新功能时，请注意保持菜单路径与实际API路由的一致性

如果您遇到其他导航问题，请检查前端路由配置是否与后端API路由保持一致。