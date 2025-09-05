const express = require('express')
const router = express.Router()
const { pool } = require('../config/database')
const { createCrudHandlers } = require('../middleware/crudFactory')
const { recordExists, getRecords } = require('../utils/dbHelper')
const { adminAuth, uploadBase64ToImageHost } = require('../utils/uploadHelper')
const {
  validateLikeOrFavoriteData,
  validateFollowData,
  validateNotificationData
} = require('../utils/validationHelpers')
const { success, error, handleError } = require('../utils/responseHelper')
const { authenticateToken } = require('../middleware/auth')

// 创建笔记
// Posts CRUD 配置
const postsCrudConfig = {
  table: 'posts',
  name: '笔记',
  requiredFields: ['user_id', 'title', 'content'],
  updateFields: ['title', 'content', 'category', 'view_count', 'is_draft'],
  cascadeRules: [
    { table: 'post_images', field: 'post_id' },
    { table: 'post_tags', field: 'post_id' },
    { table: 'comments', field: 'post_id' },
    { table: 'likes', field: 'target_id', condition: 'target_type = 1' },
    { table: 'collections', field: 'post_id' }
  ],
  searchFields: {
    title: { operator: 'LIKE' },
    user_id: { operator: '=' },
    category: { operator: '=' },
    is_draft: { operator: '=' }
  },
  allowedSortFields: ['id', 'view_count', 'like_count', 'collect_count', 'comment_count', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 创建前的自定义验证和处理
  beforeCreate: async (data, req) => {
    const { user_id, images, image_urls, tags } = data

    // 检查用户是否存在
    const [userResult] = await pool.execute('SELECT id FROM users WHERE id = ?', [user_id])
    if (userResult.length === 0) {
      throw new Error('用户不存在')
    }

    // 设置默认分类
    if (!data.category) {
      data.category = ''
    }

    return data
  },

  // 创建后的处理（处理图片和标签）
  afterCreate: async (postId, data, req) => {
    const { images, image_urls, tags } = data

    // 处理图片信息
    if (images !== undefined || image_urls !== undefined) {
      // 合并两种图片来源
      const allImages = []
      const base64Images = []

      // 添加文件上传的图片
      if (images && Array.isArray(images)) {
        for (const image of images) {
          if (typeof image === 'string') {
            if (image.startsWith('data:image/')) {
              base64Images.push(image)
            } else {
              allImages.push(image)
            }
          } else if (image && typeof image === 'object') {
            const possibleUrlProps = ['url', 'preview', 'src', 'path', 'link']
            let foundValidUrl = false

            for (const prop of possibleUrlProps) {
              if (image[prop] && typeof image[prop] === 'string') {
                if (image[prop].startsWith('data:image/')) {
                  base64Images.push(image[prop])
                  foundValidUrl = true
                  break
                } else {
                  allImages.push(image[prop])
                  foundValidUrl = true
                  break
                }
              }
            }
          }
        }
      }

      // 添加URL输入的图片
      if (image_urls && Array.isArray(image_urls)) {
        const validUrls = image_urls.filter(url =>
          url &&
          typeof url === 'string' &&
          !url.startsWith('[待上传]') &&
          !url.startsWith('data:image/')
        )
        allImages.push(...validUrls)
      }

      // 上传base64图片到图床
      if (base64Images.length > 0) {
        const token = req.headers.authorization?.replace('Bearer ', '')
        const uploadedUrls = await uploadBase64ToImageHost(base64Images)
        if (uploadedUrls.length > 0) {
          allImages.push(...uploadedUrls)
        }
      }

      // 插入图片
      if (allImages.length > 0) {
        for (const imageUrl of allImages) {
          const cleanUrl = imageUrl ? imageUrl.trim().replace(/\`/g, '').replace(/\s+/g, '') : ''
          if (cleanUrl && !cleanUrl.startsWith('data:image/')) {
            await pool.execute(
              'INSERT INTO post_images (post_id, image_url) VALUES (?, ?)',
              [postId, cleanUrl]
            )
          }
        }
      }
    }

    // 处理标签
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        let tagId
        let tagName

        // 处理字符串格式的标签
        if (typeof tag === 'string') {
          tagName = tag
          // 查找现有标签
          const [existingTag] = await pool.execute(
            'SELECT id FROM tags WHERE name = ?',
            [tagName]
          )

          if (existingTag.length > 0) {
            tagId = existingTag[0].id
          } else {
            // 创建新标签
            const [tagResult] = await pool.execute(
              'INSERT INTO tags (name) VALUES (?)',
              [tagName]
            )
            tagId = tagResult.insertId
          }
        } else {
          // 处理对象格式的标签（向后兼容）
          tagId = tag.id
          tagName = tag.name

          // 如果是新标签，先创建标签
          if (tag.is_new || String(tag.id).startsWith('temp_')) {
            const [existingTag] = await pool.execute(
              'SELECT id FROM tags WHERE name = ?',
              [tag.name]
            )

            if (existingTag.length > 0) {
              tagId = existingTag[0].id
            } else {
              const [tagResult] = await pool.execute(
                'INSERT INTO tags (name) VALUES (?)',
                [tag.name]
              )
              tagId = tagResult.insertId
            }
          }
        }

        // 关联笔记和标签
        await pool.execute(
          'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)',
          [postId, tagId]
        )

        // 更新标签使用次数
        await pool.execute(
          'UPDATE tags SET use_count = use_count + 1 WHERE id = ?',
          [tagId]
        )
      }
    }
  },

  // 更新前的处理
  beforeUpdate: async (data, req, id) => {
    // 确保浏览量不为负数
    if (data.view_count !== undefined && data.view_count !== null) {
      data.view_count = Math.max(0, parseInt(data.view_count) || 0)
    }

    // 设置默认分类
    if (data.category === undefined) {
      data.category = ''
    }

    return { isValid: true }
  },

  // 更新后的处理（处理图片和标签）
  afterUpdate: async (postId, data, req) => {
    const { images, image_urls, tags } = data

    // 更新图片信息
    if (images !== undefined || image_urls !== undefined) {
      // 删除原有图片
      await pool.execute('DELETE FROM post_images WHERE post_id = ?', [postId])

      // 使用Set来避免重复的图片URL
      const allImagesSet = new Set()
      const base64Images = []

      // 处理image_urls字段
      if (image_urls && Array.isArray(image_urls)) {
        for (const url of image_urls) {
          if (url && typeof url === 'string') {
            if (url.startsWith('data:image/')) {
              base64Images.push(url)
            } else if (!url.startsWith('[待上传:')) {
              allImagesSet.add(url)
            }
          }
        }
      }

      // 处理images字段中的base64数据
      if (images && Array.isArray(images)) {
        for (const image of images) {
          if (typeof image === 'string') {
            if (image.startsWith('data:image/')) {
              base64Images.push(image)
            }
          } else if (image && typeof image === 'object') {
            const possibleUrlProps = ['url', 'preview', 'src', 'path', 'link']
            for (const prop of possibleUrlProps) {
              if (image[prop] && typeof image[prop] === 'string') {
                if (image[prop].startsWith('data:image/')) {
                  base64Images.push(image[prop])
                  break
                }
              }
            }
          }
        }
      }

      // 上传base64图片到图床
      if (base64Images.length > 0) {
        const uploadedUrls = []
        for (const base64Data of base64Images) {
          const result = await uploadBase64ToImageHost(base64Data)
          if (result.success) {
            uploadedUrls.push(result.url)
          }
        }
        if (uploadedUrls.length > 0) {
          uploadedUrls.forEach(url => allImagesSet.add(url))
          // 记录管理员图片上传操作日志
          console.log(`管理员Base64图片上传成功 - 用户ID: ${req.user.id}, 上传数量: ${uploadedUrls.length}`);
        }
      }

      // 插入新图片
      const allImages = Array.from(allImagesSet)
      if (allImages.length > 0) {
        for (const imageUrl of allImages) {
          const cleanUrl = imageUrl ? imageUrl.trim().replace(/\`/g, '').replace(/\s+/g, '') : ''
          if (cleanUrl && !cleanUrl.startsWith('data:image/')) {
            await pool.execute(
              'INSERT INTO post_images (post_id, image_url) VALUES (?, ?)',
              [postId, cleanUrl]
            )
          }
        }
      }
    }

    // 更新标签信息
    if (tags !== undefined) {
      // 获取原有标签，用于更新使用次数
      const [oldTags] = await pool.execute(
        'SELECT tag_id FROM post_tags WHERE post_id = ?',
        [postId]
      )

      // 删除原有标签关联
      await pool.execute('DELETE FROM post_tags WHERE post_id = ?', [postId])

      // 减少原有标签的使用次数
      for (const oldTag of oldTags) {
        await pool.execute(
          'UPDATE tags SET use_count = GREATEST(use_count - 1, 0) WHERE id = ?',
          [oldTag.tag_id]
        )
      }

      // 处理新标签
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          let tagId
          let tagName

          // 处理字符串格式的标签
          if (typeof tag === 'string') {
            tagName = tag
            // 查找现有标签
            const [existingTag] = await pool.execute(
              'SELECT id FROM tags WHERE name = ?',
              [tagName]
            )

            if (existingTag.length > 0) {
              tagId = existingTag[0].id
            } else {
              // 创建新标签
              const [tagResult] = await pool.execute(
                'INSERT INTO tags (name) VALUES (?)',
                [tagName]
              )
              tagId = tagResult.insertId
            }
          } else {
            // 处理对象格式的标签（向后兼容）
            tagId = tag.id
            tagName = tag.name

            // 如果是新标签，先创建标签
            if (tag.is_new || String(tag.id).startsWith('temp_')) {
              const [existingTag] = await pool.execute(
                'SELECT id FROM tags WHERE name = ?',
                [tag.name]
              )

              if (existingTag.length > 0) {
                tagId = existingTag[0].id
              } else {
                const [tagResult] = await pool.execute(
                  'INSERT INTO tags (name) VALUES (?)',
                  [tag.name]
                )
                tagId = tagResult.insertId
              }
            }
          }

          // 关联笔记和标签
          await pool.execute(
            'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)',
            [postId, tagId]
          )

          // 更新标签使用次数
          await pool.execute(
            'UPDATE tags SET use_count = use_count + 1 WHERE id = ?',
            [tagId]
          )
        }
      }
    }
  },

  // 删除前的处理（减少标签使用次数）
  beforeDelete: async (id) => {
    // 获取笔记关联的标签，减少标签使用次数
    const [tagResult] = await pool.execute(
      'SELECT tag_id FROM post_tags WHERE post_id = ?',
      [id]
    )

    // 减少标签使用次数
    for (const tag of tagResult) {
      await pool.execute('UPDATE tags SET use_count = use_count - 1 WHERE id = ?', [tag.tag_id])
    }
  },

  // 批量删除前的处理
  beforeDeleteMany: async (ids) => {
    const placeholders = ids.map(() => '?').join(',')

    // 获取所有笔记关联的标签，减少标签使用次数
    const [tagResult] = await pool.execute(
      `SELECT tag_id FROM post_tags WHERE post_id IN (${placeholders})`,
      ids
    )

    // 减少标签使用次数
    for (const tag of tagResult) {
      await pool.execute('UPDATE tags SET use_count = use_count - 1 WHERE id = ?', [tag.tag_id])
    }
  },

  // 自定义查询（获取详情和列表）
  customQueries: {
    getOne: async (req) => {
      const postId = req.params.id

      // 获取笔记基本信息
      const [postResult] = await pool.execute(`
        SELECT p.id, p.user_id, p.title, p.content, p.category,
               p.view_count, p.like_count, p.collect_count, p.comment_count,
               p.is_draft, p.created_at,
               u.nickname, COALESCE(u.user_id, CONCAT('user', LPAD(u.id, 3, '0'))) as user_display_id
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `, [postId])

      if (postResult.length === 0) {
        return null
      }

      const post = postResult[0]

      // 获取笔记图片
      const [images] = await pool.execute('SELECT image_url FROM post_images WHERE post_id = ?', [postId])
      post.images = images.map(img => img.image_url)

      // 获取笔记标签
      const [tags] = await pool.execute(`
        SELECT t.id, t.name 
        FROM tags t 
        INNER JOIN post_tags pt ON t.id = pt.tag_id 
        WHERE pt.post_id = ?
      `, [postId])
      post.tags = tags

      return post
    },

    getList: async (req) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 搜索条件
      let whereClause = ''
      const params = []

      if (req.query.title) {
        whereClause += ' WHERE p.title LIKE ?'
        params.push(`%${req.query.title}%`)
      }

      if (req.query.user_id) {
        whereClause += whereClause ? ' AND u.user_id LIKE ?' : ' WHERE u.user_id LIKE ?'
        params.push(`%${req.query.user_id}%`)
      }

      if (req.query.category) {
        whereClause += whereClause ? ' AND p.category = ?' : ' WHERE p.category = ?'
        params.push(req.query.category)
      }

      if (req.query.is_draft !== undefined) {
        whereClause += whereClause ? ' AND p.is_draft = ?' : ' WHERE p.is_draft = ?'
        params.push(req.query.is_draft)
      }

      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM posts p 
        LEFT JOIN users u ON p.user_id = u.id
        ${whereClause}
      `
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY p.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'view_count', 'like_count', 'collect_count', 'comment_count', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = sortField === 'nickname' ? 'u.' : 'p.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT p.id, p.user_id, p.title, p.content, p.category,
               p.view_count, p.like_count, p.collect_count, p.comment_count,
               p.is_draft, p.created_at,
               u.nickname, COALESCE(u.user_id, CONCAT('user', LPAD(u.id, 3, '0'))) as user_display_id
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [posts] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      // 为每个笔记获取图片信息和标签信息
      for (let post of posts) {
        const [images] = await pool.execute('SELECT image_url FROM post_images WHERE post_id = ?', [post.id])
        post.images = images.map(img => img.image_url)

        // 获取笔记标签
        const [tags] = await pool.execute(`
          SELECT t.id, t.name 
          FROM tags t 
          INNER JOIN post_tags pt ON t.id = pt.tag_id 
          WHERE pt.post_id = ?
        `, [post.id])
        post.tags = tags
      }

      return {
        data: posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

const postsHandlers = createCrudHandlers(postsCrudConfig)

// 注册 Posts CRUD 路由
router.post('/posts', adminAuth, postsHandlers.create)
router.put('/posts/:id', adminAuth, postsHandlers.update)
router.delete('/posts/:id', adminAuth, postsHandlers.deleteOne)
router.delete('/posts', adminAuth, postsHandlers.deleteMany)
router.get('/posts/:id', adminAuth, async (req, res) => {
  try {
    const result = await postsCrudConfig.customQueries.getOne(req)
    if (!result) {
      return res.status(404).json({
        code: 404,
        message: '笔记不存在'
      })
    }
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取笔记详情失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取笔记详情失败'
    })
  }
})
// 使用自定义查询覆盖默认的getList
router.get('/posts', adminAuth, async (req, res) => {
  try {
    const result = await postsCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取笔记列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取笔记列表失败'
    })
  }
})

// 创建评论
// ===== COMMENTS CRUD (使用工厂模式) =====
const commentsCrudConfig = {
  table: 'comments',
  name: '评论',
  requiredFields: ['user_id', 'post_id', 'content'],
  updateFields: ['content'],
  cascadeRules: [
    { table: 'likes', field: 'target_id', condition: 'target_type = 2' },
    { table: 'comments', field: 'parent_id' } // 删除子评论
  ],
  searchFields: {
    post_id: { operator: '=' },
    user_id: { operator: '=' },
    content: { operator: 'LIKE' }
  },
  allowedSortFields: ['id', 'like_count', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义验证
  beforeCreate: async (data) => {
    const { user_id, post_id, parent_id } = data

    // 检查用户是否存在
    const [userResult] = await pool.execute('SELECT id FROM users WHERE id = ?', [user_id])
    if (userResult.length === 0) {
      return { isValid: false, message: '用户不存在' }
    }

    // 检查笔记是否存在
    const [postResult] = await pool.execute('SELECT id FROM posts WHERE id = ?', [post_id])
    if (postResult.length === 0) {
      return { isValid: false, message: '笔记不存在' }
    }

    // 如果是回复评论，检查父评论是否存在
    if (parent_id) {
      const [parentResult] = await pool.execute('SELECT id FROM comments WHERE id = ?', [parent_id])
      if (parentResult.length === 0) {
        return { isValid: false, message: '父评论不存在' }
      }
    }

    return { isValid: true }
  },

  // 自定义查询（用于管理后台的复杂查询）
  customQueries: {
    getList: async (req) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 搜索条件
      let whereClause = ''
      const params = []

      if (req.query.post_id) {
        whereClause += ' WHERE c.post_id = ?'
        params.push(req.query.post_id)
      }

      if (req.query.user_id) {
        whereClause += whereClause ? ' AND u.user_id LIKE ?' : ' WHERE u.user_id LIKE ?'
        params.push(`%${req.query.user_id}%`)
      }

      if (req.query.content) {
        whereClause += whereClause ? ' AND c.content LIKE ?' : ' WHERE c.content LIKE ?'
        params.push(`%${req.query.content}%`)
      }

      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM comments c 
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN posts p ON c.post_id = p.id
        ${whereClause}
      `
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY c.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'like_count', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = sortField === 'nickname' ? 'u.' : 'c.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT c.id, c.content, c.parent_id, c.like_count, c.created_at,
               c.user_id, u.nickname, 
               COALESCE(u.user_id, CONCAT('user', LPAD(u.id, 3, '0'))) as user_display_id,
               p.id as post_id, p.title as post_title
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN posts p ON c.post_id = p.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [comments] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      return {
        data: comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

const commentsHandlers = createCrudHandlers(commentsCrudConfig)

// 评论CRUD路由
router.post('/comments', adminAuth, commentsHandlers.create)
router.put('/comments/:id', adminAuth, commentsHandlers.update)
router.delete('/comments/:id', adminAuth, commentsHandlers.deleteOne)
router.delete('/comments', adminAuth, commentsHandlers.deleteMany)
router.get('/comments/:id', adminAuth, commentsHandlers.getOne)
// 使用自定义查询覆盖默认的getList
router.get('/comments', adminAuth, async (req, res) => {
  try {
    const result = await commentsCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取评论列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取评论列表失败'
    })
  }
})

// 创建标签
// ==================== 标签管理（使用CRUD工厂重构） ====================

// 标签CRUD配置
const tagsCrudConfig = {
  table: 'tags',
  name: '标签',
  requiredFields: ['name'],
  updateFields: ['name', 'description'],
  uniqueFields: ['name'],
  cascadeRules: [
    { table: 'post_tags', field: 'tag_id' }
  ],
  searchFields: {
    name: { operator: 'LIKE' }
  },
  allowedSortFields: ['id', 'use_count', 'created_at'],
  defaultOrderBy: 'created_at DESC'
}

// 生成标签CRUD处理器
const tagsHandlers = createCrudHandlers(tagsCrudConfig)

// 标签路由（240行代码减少到6行）
router.post('/tags', adminAuth, tagsHandlers.create)
router.put('/tags/:id', adminAuth, tagsHandlers.update)
router.delete('/tags/:id', adminAuth, tagsHandlers.deleteOne)
router.delete('/tags', adminAuth, tagsHandlers.deleteMany)
router.get('/tags/:id', adminAuth, tagsHandlers.getOne)
router.get('/tags', adminAuth, tagsHandlers.getList)

// ==================== 点赞管理（使用CRUD工厂重构） ====================

// 点赞CRUD配置
const likesCrudConfig = {
  table: 'likes',
  name: '点赞',
  requiredFields: ['user_id', 'target_type', 'target_id'],
  updateFields: ['target_type', 'target_id'],
  searchFields: {
    user_id: { operator: '=' },
    target_type: { operator: '=' },
    target_id: { operator: '=' }
  },
  allowedSortFields: ['id', 'user_id', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义验证逻辑
  beforeCreate: async (data) => {
    await validateLikeOrFavoriteData(data)

    // 检查目标是否存在
    const targetTable = data.target_type == 1 ? 'posts' : 'comments'
    if (!(await recordExists(targetTable, 'id', data.target_id))) {
      return {
        isValid: false,
        message: data.target_type == 1 ? '笔记不存在' : '评论不存在',
        code: 404
      }
    }

    return { isValid: true }
  },

  beforeUpdate: async (data) => {
    await validateLikeOrFavoriteData(data)
    return { isValid: true }
  },

  // 自定义查询（用于管理后台的复杂查询）
  customQueries: {
    getList: async (req) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 搜索条件
      let whereClause = ''
      const params = []

      if (req.query.user_id) {
        whereClause += whereClause ? ' AND l.user_id = ?' : 'WHERE l.user_id = ?'
        params.push(req.query.user_id)
      }

      if (req.query.target_type) {
        whereClause += whereClause ? ' AND l.target_type = ?' : 'WHERE l.target_type = ?'
        params.push(req.query.target_type)
      }

      if (req.query.target_id) {
        whereClause += whereClause ? ' AND l.target_id = ?' : 'WHERE l.target_id = ?'
        params.push(req.query.target_id)
      }

      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM likes l ${whereClause}`
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY l.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'user_id', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = 'l.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT l.id, l.user_id, l.target_type, l.target_id, l.created_at,
               u.nickname, 
               COALESCE(u.user_id, CONCAT('user', LPAD(u.id, 3, '0'))) as user_display_id
        FROM likes l
        LEFT JOIN users u ON l.user_id = u.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [likes] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      return {
        data: likes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

// 生成点赞CRUD处理器
const likesHandlers = createCrudHandlers(likesCrudConfig)

// 临时测试接口 - 检查用户数据
router.get('/test-users', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../config/database')
    const [users] = await pool.execute(
      'SELECT id, user_id, nickname FROM users WHERE id IN (SELECT DISTINCT user_id FROM likes LIMIT 10)'
    )
    res.json({ code: 200, data: users })
  } catch (error) {
    console.error('测试用户数据失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

// 点赞路由（300行代码减少到6行）
router.post('/likes', adminAuth, likesHandlers.create)
router.put('/likes/:id', adminAuth, likesHandlers.update)
router.delete('/likes/:id', adminAuth, likesHandlers.deleteOne)
router.delete('/likes', adminAuth, likesHandlers.deleteMany)
router.get('/likes/:id', adminAuth, likesHandlers.getOne)
// 使用自定义查询覆盖默认的getList
router.get('/likes', adminAuth, async (req, res) => {
  try {
    const result = await likesCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取点赞列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取点赞列表失败'
    })
  }
})

// 创建收藏
// ==================== 收藏管理（使用CRUD工厂重构） ====================

// 收藏CRUD配置
const collectionsCrudConfig = {
  table: 'collections',
  name: '收藏',
  requiredFields: ['user_id', 'post_id'],
  updateFields: ['post_id'],
  searchFields: {
    user_id: { operator: '=' },
    post_id: { operator: '=' }
  },
  allowedSortFields: ['id', 'user_id', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义验证逻辑
  beforeCreate: async (data) => {
    // 检查用户是否存在
    if (!(await recordExists('users', 'id', data.user_id))) {
      return {
        isValid: false,
        message: '用户不存在',
        code: 404
      }
    }

    // 检查笔记是否存在
    if (!(await recordExists('posts', 'id', data.post_id))) {
      return {
        isValid: false,
        message: '笔记不存在',
        code: 404
      }
    }

    // 检查是否已经收藏
    const { pool } = require('../config/database')
    const [existing] = await pool.execute(
      'SELECT id FROM collections WHERE user_id = ? AND post_id = ?',
      [data.user_id, data.post_id]
    )
    if (existing.length > 0) {
      return {
        isValid: false,
        message: '已经收藏过该笔记',
        code: 409
      }
    }

    return { isValid: true }
  },

  beforeUpdate: async (data) => {
    // 检查笔记是否存在
    if (data.post_id && !(await recordExists('posts', 'id', data.post_id))) {
      return {
        isValid: false,
        message: '笔记不存在',
        code: 404
      }
    }

    return { isValid: true }
  },

  // 自定义查询（用于管理后台的复杂查询）
  customQueries: {
    getList: async (req) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 搜索条件
      let whereClause = ''
      const params = []

      if (req.query.user_id) {
        whereClause += whereClause ? ' AND c.user_id = ?' : 'WHERE c.user_id = ?'
        params.push(req.query.user_id)
      }

      if (req.query.post_id) {
        whereClause += whereClause ? ' AND c.post_id = ?' : 'WHERE c.post_id = ?'
        params.push(req.query.post_id)
      }

      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM collections c ${whereClause}`
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY c.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'user_id', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = 'c.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT c.id, c.user_id, c.post_id, c.created_at,
               u.nickname, 
               COALESCE(u.user_id, CONCAT('user', LPAD(u.id, 3, '0'))) as user_display_id,
               p.title as post_title
        FROM collections c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN posts p ON c.post_id = p.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [collections] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      return {
        data: collections,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

// 生成收藏CRUD处理器
const collectionsHandlers = createCrudHandlers(collectionsCrudConfig)

// 收藏路由（268行代码减少到6行）
router.post('/collections', adminAuth, collectionsHandlers.create)
router.put('/collections/:id', adminAuth, collectionsHandlers.update)
router.delete('/collections/:id', adminAuth, collectionsHandlers.deleteOne)
router.delete('/collections', adminAuth, collectionsHandlers.deleteMany)
router.get('/collections/:id', adminAuth, collectionsHandlers.getOne)
// 使用自定义查询覆盖默认的getList
router.get('/collections', adminAuth, async (req, res) => {
  try {
    const result = await collectionsCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取收藏列表失败'
    })
  }
})

// 创建关注
// ==================== 关注管理（使用CRUD工厂重构） ====================

// 关注CRUD配置
const followsCrudConfig = {
  table: 'follows',
  name: '关注',
  requiredFields: ['follower_id', 'following_id'],
  updateFields: ['following_id'],
  searchFields: {
    follower_id: { operator: '=' },
    following_id: { operator: '=' }
  },
  allowedSortFields: ['id', 'follower_id', 'following_id', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义验证逻辑
  beforeCreate: async (data) => {
    await validateFollowData(data)

    // 检查是否已经关注
    const { pool } = require('../config/database')
    const [existing] = await pool.execute(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [data.follower_id, data.following_id]
    )
    if (existing.length > 0) {
      return {
        isValid: false,
        message: '已经关注过了',
        code: 409
      }
    }

    return { isValid: true }
  },

  beforeUpdate: async (data, id) => {
    if (data.following_id) {
      // 获取当前记录的关注者ID
      const { pool } = require('../config/database')
      const [current] = await pool.execute('SELECT follower_id FROM follows WHERE id = ?', [id])
      if (current.length === 0) {
        return {
          isValid: false,
          message: '关注记录不存在',
          code: 404
        }
      }

      const updateData = {
        follower_id: current[0].follower_id,
        following_id: data.following_id
      }
      await validateFollowData(updateData)
    }

    return { isValid: true }
  },

  // 自定义查询（用于管理后台的复杂查询）
  customQueries: {
    getList: async (req) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 搜索条件
      let whereClause = ''
      const params = []

      if (req.query.follower_id) {
        whereClause += whereClause ? ' AND f.follower_id = ?' : 'WHERE f.follower_id = ?'
        params.push(req.query.follower_id)
      }

      if (req.query.following_id) {
        whereClause += whereClause ? ' AND f.following_id = ?' : 'WHERE f.following_id = ?'
        params.push(req.query.following_id)
      }

      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM follows f ${whereClause}`
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY f.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'follower_id', 'following_id', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = 'f.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT f.id, f.follower_id, f.following_id, f.created_at,
               u1.nickname as follower_nickname, 
               COALESCE(u1.user_id, CONCAT('user', LPAD(u1.id, 3, '0'))) as follower_display_id,
               u2.nickname as following_nickname, 
               COALESCE(u2.user_id, CONCAT('user', LPAD(u2.id, 3, '0'))) as following_display_id
        FROM follows f
        LEFT JOIN users u1 ON f.follower_id = u1.id
        LEFT JOIN users u2 ON f.following_id = u2.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [follows] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      return {
        data: follows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

// 生成关注CRUD处理器
const followsHandlers = createCrudHandlers(followsCrudConfig)

// 关注路由（291行代码减少到6行）
router.post('/follows', adminAuth, followsHandlers.create)
router.put('/follows/:id', adminAuth, followsHandlers.update)
router.delete('/follows/:id', adminAuth, followsHandlers.deleteOne)
router.delete('/follows', adminAuth, followsHandlers.deleteMany)
router.get('/follows/:id', adminAuth, followsHandlers.getOne)
// 使用自定义查询覆盖默认的getList
router.get('/follows', adminAuth, async (req, res) => {
  try {
    const result = await followsCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取关注列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取关注列表失败'
    })
  }
})

// 通知管理 CRUD 配置
const notificationsCrudConfig = {
  table: 'notifications',
  name: '通知',
  requiredFields: ['user_id', 'sender_id', 'type', 'title'],
  updateFields: ['user_id', 'sender_id', 'type', 'title', 'target_id', 'comment_id', 'is_read'],
  searchFields: {
    user_id: { operator: '=' },
    type: { operator: '=' },
    is_read: { operator: '=' }
  },
  allowedSortFields: ['id', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义查询（用于管理后台的复杂查询）
  customQueries: {
    getList: async (req) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 搜索条件
      let whereClause = ''
      const params = []

      if (req.query.user_id) {
        whereClause += whereClause ? ' AND n.user_id = ?' : 'WHERE n.user_id = ?'
        params.push(req.query.user_id)
      }

      if (req.query.type) {
        whereClause += whereClause ? ' AND n.type = ?' : 'WHERE n.type = ?'
        params.push(req.query.type)
      }

      if (req.query.is_read !== undefined) {
        whereClause += whereClause ? ' AND n.is_read = ?' : 'WHERE n.is_read = ?'
        params.push(req.query.is_read)
      }

      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM notifications n ${whereClause}`
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY n.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = 'n.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT n.id, n.user_id, n.sender_id, n.type, n.title, n.target_id, n.comment_id, n.is_read, n.created_at,
               u1.nickname as user_nickname, 
               COALESCE(u1.user_id, CONCAT('user', LPAD(u1.id, 3, '0'))) as user_display_id,
               u2.nickname as sender_nickname, 
               COALESCE(u2.user_id, CONCAT('user', LPAD(u2.id, 3, '0'))) as sender_display_id
        FROM notifications n
        LEFT JOIN users u1 ON n.user_id = u1.id
        LEFT JOIN users u2 ON n.sender_id = u2.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [notifications] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      return {
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

const notificationsHandlers = createCrudHandlers(notificationsCrudConfig)

// 通知管理路由
router.post('/notifications', adminAuth, notificationsHandlers.create)
router.put('/notifications/:id', adminAuth, notificationsHandlers.update)
router.delete('/notifications/:id', adminAuth, notificationsHandlers.deleteOne)
router.delete('/notifications', adminAuth, notificationsHandlers.deleteMany)
router.get('/notifications/:id', adminAuth, notificationsHandlers.getOne)
// 使用自定义查询覆盖默认的getList
router.get('/notifications', adminAuth, async (req, res) => {
  try {
    const result = await notificationsCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取通知列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取通知列表失败'
    })
  }
})

// 会话管理 CRUD 配置
const sessionsCrudConfig = {
  table: 'user_sessions',
  name: '会话',
  requiredFields: ['user_id'],
  updateFields: ['user_agent', 'is_active'],
  searchFields: {
    user_id: { operator: '=' },
    is_active: { operator: '=' }
  },
  allowedSortFields: ['id', 'is_active', 'expires_at', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义创建前验证
  beforeCreate: async (data) => {
    await validateNotificationData(data)

    // 生成refresh_token
    const crypto = require('crypto')
    data.refresh_token = crypto.randomBytes(32).toString('hex')

    // 设置过期时间（30天）
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + 30)
    data.expires_at = expires_at

    // 设置默认值
    data.user_agent = data.user_agent || ''
    data.is_active = data.is_active ? 1 : 0
  },

  // 自定义查询
  customQueries: {
    getList: async (req) => {
      const { pool } = require('../config/database')
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      // 构建搜索条件
      let whereClause = ''
      const params = []

      if (req.query.user_id) {
        whereClause += whereClause ? ' AND s.user_id = ?' : 'WHERE s.user_id = ?'
        params.push(req.query.user_id)
      }

      if (req.query.is_active !== undefined) {
        whereClause += whereClause ? ' AND s.is_active = ?' : 'WHERE s.is_active = ?'
        params.push(req.query.is_active)
      }



      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM user_sessions s ${whereClause}`
      const [countResult] = await pool.execute(countQuery, params)
      const total = countResult[0].total

      // 排序处理
      let orderClause = 'ORDER BY s.created_at DESC'
      if (req.query.sortBy && req.query.sortOrder) {
        const allowedSortFields = ['id', 'is_active', 'expires_at', 'created_at']
        const sortField = req.query.sortBy
        const sortOrder = req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        if (allowedSortFields.includes(sortField)) {
          const fieldPrefix = 's.'
          orderClause = `ORDER BY ${fieldPrefix}${sortField} ${sortOrder}`
        }
      }

      // 获取数据
      const dataQuery = `
        SELECT s.id, s.user_id, s.refresh_token, s.user_agent, s.is_active, s.expires_at, s.created_at,
               u.nickname, 
               COALESCE(u.user_id, CONCAT('user', LPAD(u.id, 3, '0'))) as user_display_id
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      const [sessions] = await pool.execute(dataQuery, [...params, String(limit), String(offset)])

      return {
        data: sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }
  }
}

const sessionsHandlers = createCrudHandlers(sessionsCrudConfig)

// 会话管理路由
router.post('/sessions', adminAuth, sessionsHandlers.create)

router.put('/sessions/:id', adminAuth, sessionsHandlers.update)
router.delete('/sessions/:id', adminAuth, sessionsHandlers.deleteOne)
router.delete('/sessions', adminAuth, sessionsHandlers.deleteMany)
router.get('/sessions/:id', adminAuth, sessionsHandlers.getOne)
// 使用自定义查询覆盖默认的getList
router.get('/sessions', adminAuth, async (req, res) => {
  try {
    const result = await sessionsCrudConfig.customQueries.getList(req)
    res.json({
      code: 200,
      message: 'success',
      data: result
    })
  } catch (error) {
    console.error('获取会话列表失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取会话列表失败'
    })
  }
})



// ===== USERS CRUD (使用工厂模式) =====
const usersCrudConfig = {
  table: 'users',
  name: '用户',
  requiredFields: ['user_id', 'nickname'],
  updateFields: ['user_id', 'nickname', 'avatar', 'bio', 'location', 'is_active', 'gender', 'zodiac_sign', 'mbti', 'education', 'major', 'interests'],
  uniqueFields: ['user_id'],
  cascadeRules: [
    { table: 'posts', field: 'user_id' },
    { table: 'comments', field: 'user_id' },
    { table: 'likes', field: 'user_id' },
    { table: 'collections', field: 'user_id' },
    { table: 'follows', field: 'follower_id' },
    { table: 'follows', field: 'following_id' },
    { table: 'notifications', field: 'user_id' },
    { table: 'user_sessions', field: 'user_id' }
  ],
  searchFields: {
    user_id: { operator: 'LIKE' },
    nickname: { operator: 'LIKE' },
    location: { operator: 'LIKE' },
    is_active: { operator: '=' }
  },
  allowedSortFields: ['id', 'fans_count', 'like_count', 'created_at'],
  defaultOrderBy: 'created_at DESC',

  // 自定义数据处理
  beforeCreate: async (data) => {
    // 处理interests字段（转换为JSON字符串）
    if (data.interests) {
      data.interests = Array.isArray(data.interests) ? JSON.stringify(data.interests) : data.interests
    }

    // 设置默认值
    // 如果没有提供密码，设置默认哈希密码（123456的SHA256哈希值）
    if (!data.password) {
      // 使用MySQL的SHA2函数生成默认密码的哈希值
      const [result] = await pool.execute('SELECT SHA2(?, 256) as hashed_password', ['123456'])
      data.password = result[0].hashed_password
    } else {
      // 如果提供了密码，进行哈希处理
      const [result] = await pool.execute('SELECT SHA2(?, 256) as hashed_password', [data.password])
      data.password = result[0].hashed_password
    }
    data.avatar = data.avatar || ''
    data.bio = data.bio || ''
    data.location = data.location || ''
    data.is_active = data.is_active ? 1 : 0

    return { isValid: true }
  },

  beforeUpdate: async (data) => {
    // 处理interests字段（转换为JSON字符串）
    if (data.interests) {
      data.interests = Array.isArray(data.interests) ? JSON.stringify(data.interests) : data.interests
    }

    // 处理is_active字段
    if (data.is_active !== undefined) {
      data.is_active = data.is_active ? 1 : 0
    }

    return { isValid: true }
  }
}

const usersHandlers = createCrudHandlers(usersCrudConfig)

// 用户CRUD路由
router.post('/users', adminAuth, usersHandlers.create)
router.put('/users/:id', adminAuth, usersHandlers.update)
router.delete('/users/:id', adminAuth, usersHandlers.deleteOne)
router.delete('/users', adminAuth, usersHandlers.deleteMany)
router.get('/users/:id', adminAuth, usersHandlers.getOne)
router.get('/users', adminAuth, usersHandlers.getList)

// ===== ADMINS CRUD (使用工厂模式) =====
const adminsCrudConfig = {
  table: 'admin',
  name: '管理员',
  requiredFields: ['username', 'password'],
  updateFields: ['password'],
  uniqueFields: ['username'],
  searchFields: {
    username: { operator: 'LIKE' }
  },
  allowedSortFields: ['username', 'created_at'],
  defaultOrderBy: 'created_at DESC',
  primaryKey: 'username' // 使用username作为主键
}

const adminsHandlers = createCrudHandlers(adminsCrudConfig)

// 问卷问题CRUD配置
const surveyQuestionsCrudConfig = {
  table: 'survey_questions',
  name: '问卷问题',
  requiredFields: ['question_text', 'question_type', 'options', 'sort_order'],
  updateFields: ['question_text', 'question_type', 'options', 'sort_order', 'is_required'],
  searchFields: {
    question_text: { operator: 'LIKE' },
    question_type: { operator: '=' },
    is_required: { operator: '=' }
  },
  allowedSortFields: ['id', 'sort_order', 'created_at'],
  defaultOrderBy: 'sort_order ASC',
  
  // 创建前的自定义处理
  beforeCreate: async (data, req) => {
    // 确保options是JSON格式
    if (data.options && typeof data.options === 'object') {
      data.options = JSON.stringify(data.options);
    }
    // 设置默认值
    if (data.is_required === undefined) {
      data.is_required = 0;
    }
    return data;
  },
  
  // 更新前的自定义处理
  beforeUpdate: async (data, req) => {
    // 确保options是JSON格式
    if (data.options && typeof data.options === 'object') {
      data.options = JSON.stringify(data.options);
    }
    return data;
  }
}

const surveyQuestionsHandlers = createCrudHandlers(surveyQuestionsCrudConfig)

// 问卷问题CRUD路由
router.post('/survey-questions', authenticateToken, surveyQuestionsHandlers.create)
router.put('/survey-questions/:id', authenticateToken, surveyQuestionsHandlers.update)
router.delete('/survey-questions/:id', authenticateToken, surveyQuestionsHandlers.deleteOne)
router.delete('/survey-questions', authenticateToken, surveyQuestionsHandlers.deleteMany)
router.get('/survey-questions/:id', authenticateToken, surveyQuestionsHandlers.getOne)
router.get('/survey-questions', authenticateToken, surveyQuestionsHandlers.getList)

// 问卷回答记录管理（前端使用的/surveys接口）
router.get('/surveys', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, title, status, user_id } = req.query;
    
    let where = '';
    const params = [];
    
    
    
    // 如果有title参数，可能需要关联查询问卷问题
    if (title) {
      // 这里只是简单处理，实际可能需要根据业务需求进行调整
      console.log('Title filter:', title);
    }
    
    const responses = await getRecords('survey_questions', {
      page: parseInt(page),
      limit: parseInt(limit),
      where,
      params,
      orderBy: 'created_at DESC'
    });
    
    success(res, responses, '获取问卷回答记录成功');
  } catch (err) {
    handleError(err, res, '获取问卷回答记录');
  }
});


// 获取管理员菜单
const getAdminMenu = async (req, res) => {
  try {
    const menu = [
      {
        id: 'dashboard',
        name: '仪表盘',
        path: '/dashboard',
        icon: 'dashboard'
      },
      {
        id: 'users',
        name: '用户管理',
        path: '/users',
        icon: 'users'
      },
      {
        id: 'posts',
        name: '笔记管理',
        path: '/posts',
        icon: 'file-text'
      },
      {
        id: 'comments',
        name: '评论管理',
        path: '/comments',
        icon: 'comment'
      },
      {
        id: 'notifications',
        name: '通知管理',
        path: '/notifications',
        icon: 'bell'
      },
      {
        id: 'surveys',
        name: '问卷管理',
        path: '/surveys',
        icon: 'list-alt',
        children: [
          {
            id: 'survey-questions',
            name: '问卷问题管理',
            path: '/survey-questions'
          },
          {
            id: 'survey-responses',
            name: '问卷回答记录',
            path: '/survey-responses'
          }
        ]
      },
      {
        id: 'admins',
        name: '管理员管理',
        path: '/admins',
        icon: 'shield'
      }
    ];
    
    success(res, menu, '获取管理员菜单成功');
  } catch (err) {
    handleError(err, res, '获取管理员菜单');
  }
}

router.get('/menu', authenticateToken, getAdminMenu);

// 管理员CRUD路由
router.post('/admins', adminAuth, adminsHandlers.create)
router.put('/admins/:id', adminAuth, adminsHandlers.update)
router.delete('/admins/:id', adminAuth, adminsHandlers.deleteOne)
router.delete('/admins', adminAuth, adminsHandlers.deleteMany)
router.get('/admins/:id', adminAuth, adminsHandlers.getOne)
router.get('/admins', adminAuth, adminsHandlers.getList)

module.exports = router