import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authApi, userApi } from '@/api/index.js'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '')
  const refreshToken = ref(localStorage.getItem('refreshToken') || '')
  const userInfo = ref(null)
  const isLoading = ref(false)
  const showVerificationModal = ref(false)
  const verificationScore = ref(0)
  const isVerified = ref(true)

  // 计算属性
  const isLoggedIn = computed(() => {
    return !!token.value && (!!userInfo.value || !!localStorage.getItem('userInfo'))
  })

  // 登录
  const login = async (credentials) => {
    try {
      isLoading.value = true
      const response = await authApi.login(credentials)

      if (response.success && response.data) {
        // 保存token
        token.value = response.data.tokens.access_token
        refreshToken.value = response.data.tokens.refresh_token
        userInfo.value = response.data.user
        console.log(response.data)
        // 保存到localStorage
        localStorage.setItem('token', response.data.tokens.access_token)
        localStorage.setItem('refreshToken', response.data.tokens.refresh_token)
        localStorage.setItem('userInfo', JSON.stringify(response.data.user))
        localStorage.setItem('isVerified', response.data.tokens.isVerified)
        localStorage.setItem('verificationScore', verificationScore.value.toString())

        // Token已保存到localStorage

        return { success: true }
      } else {
        return {
          success: false,
          message: response.message || '登录失败'
        }
      }
    } catch (error) {
      console.error('登录失败:', error)
      return {
        success: false,
        message: error.message || '网络错误，请稍后重试'
      }
    } finally {
      isLoading.value = false
    }
  }

  // 注册
  const register = async (userData) => {
    try {
      isLoading.value = true
      const response = await authApi.register(userData)

      if (response.success) {
        // 保存到localStorage
        localStorage.setItem('token', response.data.tokens.access_token)
        localStorage.setItem('refreshToken', response.data.tokens.refresh_token)
        userInfo.value = response.data.user

        // 保存到localStorage
        localStorage.setItem('token', response.data.tokens.access_token)
        localStorage.setItem('refreshToken', response.data.tokens.refresh_token)
        localStorage.setItem('userInfo', JSON.stringify(response.data.user))
        localStorage.setItem('isVerified', isVerified.value.toString())
        localStorage.setItem('verificationScore', verificationScore.value.toString())

        // 注册成功后打开认证模态框
        showVerificationModal.value = true

        return { success: true }
      } else {
        return { success: false, message: response.message || '注册失败' }
      }
    } catch (error) {
      console.error('注册失败:', error)
      return {
        success: false,
        message: error.message || '网络错误，请稍后重试'
      }
    } finally {
      isLoading.value = false
    }
  }

  // 退出登录
  const logout = async () => {
    try {
      // 调用后端退出接口
      if (token.value) {
        await authApi.logout()
      }
    } catch (error) {
      console.error('退出登录失败:', error)
    } finally {
      // 清除本地数据
      token.value = ''
      refreshToken.value = ''
      userInfo.value = null

      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('userInfo')
      localStorage.removeItem('isVerified')
      localStorage.removeItem('verificationScore')
      isVerified.value = false
      verificationScore.value = 0

      // 重置未读通知数量
      try {
        const { useNotificationStore } = await import('./notification')
        const notificationStore = useNotificationStore()
        notificationStore.resetUnreadCount()
      } catch (error) {
        console.error('重置未读通知数量失败:', error)
      }
    }
  }

  // 初始化用户信息（从localStorage恢复）
  const initUserInfo = () => {
    const savedUserInfo = localStorage.getItem('userInfo')
    if (savedUserInfo && token.value) {
      try {
        userInfo.value = JSON.parse(savedUserInfo)
        isVerified.value = localStorage.getItem('isVerified') === 'true'
        verificationScore.value = parseInt(localStorage.getItem('verificationScore') || '0')
      } catch (error) {
        console.error('解析用户信息失败:', error)
        // 清除无效数据
        localStorage.removeItem('userInfo')
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        token.value = ''
        refreshToken.value = ''
      }
    }
  }

  // 刷新token
  const refreshUserToken = async () => {
    try {
      const response = await authApi.refreshToken()
      if (response.success) {
        token.value = response.data.tokens.access_token
        localStorage.setItem('token', response.data.tokens.access_token)
        return true
      }
      return false
    } catch (error) {
      console.error('刷新token失败:', error)
      // token刷新失败，清除登录状态
      await logout()
      // 不再强制刷新页面，让组件自己处理未登录情况
      return false
    }
  }

  // 获取当前用户信息
  const getCurrentUser = async () => {
    try {
      const response = await authApi.getCurrentUser()
      if (response.success && response.data) {
        userInfo.value = response.data
        // 更新用户信息和认证状态
      isVerified.value = response.data.isVerified || false
      verificationScore.value = response.data.verificationScore || 0
      
      // 更新localStorage中的用户信息
      localStorage.setItem('userInfo', JSON.stringify(response.data))
      localStorage.setItem('isVerified', isVerified.value.toString())
      localStorage.setItem('verificationScore', verificationScore.value.toString())
        return response.data
      } else {
        console.error('获取当前用户信息失败:', response.message)
        return null
      }
    } catch (error) {
      console.error('获取当前用户信息失败:', error)
      return null
    }
  }

  // 获取用户统计信息
  const getUserStats = async (userId) => {
    try {
      const response = await userApi.getUserStats(userId)

      if (response.success) {
        return response.data
      } else {
        console.error('获取用户统计信息失败:', response.message)
        return null
      }
    } catch (error) {
      console.error('获取用户统计信息失败:', error)
      return null
    }
  }

  // 更新用户信息
  const updateUserInfo = (newUserInfo) => {
    if (userInfo.value) {
      // 合并新的用户信息
      userInfo.value = {
        ...userInfo.value,
        ...newUserInfo
      }

      // 更新localStorage中的用户信息
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
  }

  // 提交认证问卷
  const submitVerificationSurvey = async (surveyData) => {
    try {
      isLoading.value = true
      
      // 模拟API请求
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 更新认证状态
      isVerified.value = surveyData.score >= 60
      verificationScore.value = surveyData.score
      
      // 更新用户信息
      if (userInfo.value) {
        userInfo.value.isVerified = isVerified.value
        userInfo.value.verificationScore = verificationScore.value
        localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
      }
      
      // 保存认证状态到localStorage
      localStorage.setItem('isVerified', isVerified.value.toString())
      localStorage.setItem('verificationScore', verificationScore.value.toString())
      
      return {
        success: true,
        isVerified: isVerified.value,
        score: verificationScore.value
      }
    } catch (error) {
      console.error('提交认证问卷失败:', error)
      return {
        success: false,
        message: error.message || '提交失败，请稍后重试'
      }
    } finally {
      isLoading.value = false
    }
  }

  // 打开认证模态框
  const openVerificationModal = () => {
    showVerificationModal.value = true
  }

  // 关闭认证模态框
  const closeVerificationModal = () => {
    showVerificationModal.value = false
  }

  return {
    // 状态
    token,
    refreshToken,
    userInfo,
    isLoading,
    showVerificationModal,
    isVerified,
    verificationScore,

    // 计算属性
    isLoggedIn,

    // 方法
    login,
    register,
    logout,
    initUserInfo,
    refreshUserToken,
    getCurrentUser,
    getUserStats,
    updateUserInfo,
    submitVerificationSurvey,
    openVerificationModal,
    closeVerificationModal
  }
})