<script setup>
import { ref } from 'vue'
import MonthSelector from '../components/MonthSelector.vue'
import CalendarGrid from '../components/CalendarGrid.vue'
import ExpenseList from '../components/ExpenseList.vue'
import ExpenseSummary from '../components/ExpenseSummary.vue'

const showCalendar = ref(false)
</script>

<template>
  <div class="home-view">
    <div class="home-hero">
      <div class="top-bar">
        <MonthSelector />
        <button class="view-toggle" @click="showCalendar = !showCalendar" :title="showCalendar ? '查看列表' : '查看日历'">
          <svg v-if="!showCalendar" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="3" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
          <svg v-else width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>

    <transition name="cal">
      <CalendarGrid v-if="showCalendar" />
    </transition>

    <ExpenseSummary />
    <ExpenseList />
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100%;
  padding-bottom: 20px;
}

.home-hero {
  padding: 38px 22px 8px;
}

.top-bar {
  position: relative;
  min-height: 116px;
}

.view-toggle {
  position: absolute;
  right: 0;
  top: 10px;
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, background 0.18s ease;
}

.view-toggle:active {
  transform: scale(0.94);
  background: #fff;
}

.cal-enter-active {
  animation: scaleIn 0.25s ease both;
}

.cal-leave-active {
  animation: scaleIn 0.2s ease reverse both;
}
</style>
