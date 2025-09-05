<template>
  <div class="about-modal-overlay" v-click-outside.mousedown="closeModal" v-escape-key="closeModal"
    :class="{ 'animating': isAnimating }">
    <div class="about-modal" @click.stop :class="{ 'scale-in': isAnimating }">
      <div class="about-header">
        <div class="header-content">
          <div class="logo-section">
            <img :src="logoUrl" alt="聚包盆" class="about-logo" />
            <h2 class="about-title">关于聚包盆</h2>
          </div>
          <p class="version">v1.0.0</p>
        </div>
        <button class="close-btn" @click="closeModal">
          <SvgIcon name="close" />
        </button>
      </div>

      <div class="about-content">
        <div class="about-main">
          <div class="intro-section">
            <h3>项目简介</h3>
            <p>
              聚包盆是一个面向R.E.D团粉社群的项目。
            </p>
          </div>
          <div class="author-section">
            <h3>开发者</h3>
            <a href="https://github.com/ZTMYO" target="_blank" class="author-link">
              <div class="author-info">
                <img class="author-avatar" :src="ztmyoUrl" alt="ZTMYO">
                <div class="author-details">
                  <p class="author-name">@PURE81</p>
                  <p class="author-desc">摸鱼王</p>
                </div>
              </div>
            </a>
          </div>

          <div class="privacy-section">
            <h3>隐私声明</h3>
            <div class="privacy-content">
              <p>
                <strong>数据保护：</strong>我们承诺不收集或存储用户的IP地址信息，保护用户的隐私和匿名性。
              </p>
              <p>
                <strong>密码安全：</strong>用户密码采用SHA256加密算法进行哈希处理，确保密码信息的安全性，系统无法获取用户的明文密码。
              </p>
              <p>
                <strong>数据最小化：</strong>我们仅收集必要的用户信息用于基本功能实现，不会收集与服务无关的个人数据。
              </p>
              <p>
                <strong>本地存储：</strong>所有用户数据均存储在本地数据库中，不会上传至第三方服务器或云端。
              </p>
            </div>
          </div>

          <div class="copyright-section">
            <h3>版权声明</h3>
            <div class="copyright-content">
              <p>
                <strong>设计灵感：</strong>本校园图文社区的UI设计和交互体验参考了小红书平台，旨在为下载该开源项目的人员提供一个熟悉的项目体验。
              </p>
              <p>
                <strong>开源项目：</strong>本项目仅供学习交流使用，不用于商业用途。所有代码遵循开源协议，欢迎技术交流与讨论。
              </p>
              <p>
                <strong>免责声明：</strong>本项目与小红书官方无任何关联，所有商标、品牌名称归其各自所有者所有。
              </p>
            </div>
          </div>

          <div class="about-footer">
            <p>&copy; 2025 聚包盆. Made with ❤️ by @PURE81</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useScrollLock } from '@/composables/useScrollLock'

const emit = defineEmits(['close'])

const { lock, unlock } = useScrollLock()

// 静态资源URL
const logoUrl = new URL('@/assets/imgs/logo.gif', import.meta.url).href
const ztmyoUrl = new URL('@/assets/imgs/logo.ico', import.meta.url).href
const liciUrl = new URL('@/assets/imgs/栗次元.ico', import.meta.url).href
const xiaRouUrl = new URL('@/assets/imgs/夏柔.ico', import.meta.url).href
const baoLuoUrl = new URL('@/assets/imgs/保罗.ico', import.meta.url).href

const isAnimating = ref(false)

const closeModal = () => {
  isAnimating.value = false
  unlock()
  setTimeout(() => {
    emit('close')
  }, 200)
}

onMounted(() => {
  lock()

  setTimeout(() => {
    isAnimating.value = true
  }, 10)
})
</script>

<style scoped>
.about-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  opacity: 0;
  transition: opacity 0.2s ease;
  backdrop-filter: blur(4px);
}

.about-modal-overlay.animating {
  opacity: 1;
}

.about-modal {
  background: var(--bg-color-primary);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  position: relative;
  transform: scale(0.9);
  transition: transform 0.2s ease;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.about-modal.scale-in {
  transform: scale(1);
}

.about-header {
  position: relative;
  background: var(--bg-color-primary);
  padding: 24px 32px;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
}

.header-content {
  text-align: center;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  transition: all 0.2s ease;
}

.close-btn:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.about-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.about-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.about-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin: 0;
}

.version {
  font-size: 14px;
  color: var(--text-color-secondary);
  background: var(--bg-color-secondary);
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
  margin: 0;
}

.about-main {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.intro-section h3,
.features-section h3,
.author-section h3,
.api-section h3,
.privacy-section h3,
.copyright-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0 0 12px 0;
}

.intro-section p {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-color-secondary);
  margin: 0;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.features-list li {
  font-size: 14px;
  color: var(--text-color-primary);
  padding: 8px 0;
}

.author-link {
  text-decoration: none;
  color: inherit;
  display: block;
  border-radius: 12px;
  padding: 12px;
  transition: all 0.3s ease;
}

.author-link:hover {
  background-color: rgba(255, 95, 95, 0.05);
}

.author-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.author-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color-primary);
}



.author-details {
  flex: 1;
}

.author-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0 0 4px 0;
}

.author-desc {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0;
}

.privacy-content p,
.copyright-content p {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-color-secondary);
  margin: 0 0 12px 0;
}

.privacy-content p:last-child,
.copyright-content p:last-child {
  margin-bottom: 0;
}

.privacy-content strong,
.copyright-content strong {
  color: var(--text-color-primary);
}



.about-footer {
  text-align: center;
  margin-top: 32px;
  padding-top: 24px;
}

.about-footer p {
  font-size: 13px;
  color: var(--text-color-tertiary);
  margin: 0;
}

.api-content p {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-color-secondary);
  margin: 0 0 12px 0;
}

.api-content p:last-child {
  margin-bottom: 0;
}

.api-content strong {
  color: var(--text-color-primary);
}

.api-link {
  color: var(--text-color-primary);
  font-weight: 450;
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.api-link:hover {
  opacity: 0.8;
}

.api-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  vertical-align: middle;
  border-radius: 2px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .about-modal {
    width: 95%;
    max-height: 95vh;
  }

  .about-header {
    padding: 20px 24px;
  }

  .about-content {
    padding: 24px 20px;
  }

  .logo-section {
    flex-direction: column;
    gap: 12px;
  }

  .about-title {
    font-size: 24px;
  }

  .features-list {
    grid-template-columns: 1fr;
  }

  .author-info {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .contact-links {
    justify-content: center;
  }
}
</style>