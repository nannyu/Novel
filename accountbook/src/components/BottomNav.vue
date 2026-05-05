<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <nav class="bottom-nav">
    <router-link to="/" class="nav-item" :class="{ active: route.path === '/' }" aria-label="记账">
      <svg class="nav-svg home-icon" viewBox="0 0 24 24" fill="none">
        <path d="M4.2 11.1L12 4.4l7.8 6.7v7.1a2 2 0 01-2 2H6.2a2 2 0 01-2-2v-7.1Z" fill="currentColor"/>
        <rect x="9" y="14.1" width="6" height="3.2" rx="1.35" fill="white"/>
      </svg>
      <span class="nav-label">记账</span>
    </router-link>

    <router-link to="/charts" class="nav-item" :class="{ active: route.path === '/charts' }" aria-label="图表">
      <svg class="nav-svg chart-icon" viewBox="0 0 24 24" fill="none">
        <rect x="4.5" y="12.3" width="3.4" height="7.2" rx="1.7" fill="currentColor" opacity="0.72"/>
        <rect x="10.3" y="6.2" width="3.4" height="13.3" rx="1.7" fill="currentColor"/>
        <rect x="16.1" y="2.8" width="3.4" height="16.7" rx="1.7" fill="currentColor" opacity="0.78"/>
      </svg>
      <span class="nav-label">图表</span>
    </router-link>

    <button class="nav-add" aria-label="新增记录" @click="router.push('/add')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>

    <router-link to="/savings" class="nav-item" :class="{ active: route.path === '/savings' }" aria-label="省钱">
      <span class="coin-icon">
        <span>¥</span>
      </span>
      <span class="nav-label">省钱</span>
    </router-link>

    <router-link to="/profile" class="nav-item" :class="{ active: route.path === '/profile' }" aria-label="我的">
      <svg class="nav-svg profile-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="7.6" r="4.1" fill="currentColor"/>
        <path d="M4.4 20.4c.8-4.2 3.5-6.4 7.6-6.4s6.8 2.2 7.6 6.4H4.4Z" fill="currentColor"/>
      </svg>
      <span class="nav-label">我的</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 44px);
  max-width: 436px;
  display: grid;
  grid-template-columns: 1fr 1fr 76px 1fr 1fr;
  align-items: center;
  min-height: 68px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.9);
  border: var(--border-soft);
  border-radius: 25px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(18px);
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  text-decoration: none;
  color: #98a2bd;
  transition: color 0.18s ease, transform 0.18s ease;
  padding: 7px 2px;
}

.nav-item.active {
  color: var(--accent);
}

.nav-item:active {
  transform: scale(0.94);
}

.nav-svg {
  width: 24px;
  height: 24px;
}

.coin-icon {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #9aa4bd;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}

.coin-icon span {
  transform: translateY(0.5px);
}

.nav-item.active .coin-icon {
  background: var(--accent);
}

.nav-label {
  font-size: 11.5px;
  font-weight: 800;
}

.nav-add {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7791ff 0%, #4b55f5 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: -31px auto 0;
  box-shadow: var(--shadow-float);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.nav-add svg {
  width: 34px;
  height: 34px;
}

.nav-add:active {
  transform: scale(0.92);
  box-shadow: 0 8px 18px rgba(93, 115, 255, 0.26);
}
</style>
