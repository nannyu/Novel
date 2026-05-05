<script setup>
import { useExpenseStore } from '../stores/expense.js'

const store = useExpenseStore()
</script>

<template>
  <div class="month-selector">
    <button class="arrow" aria-label="上个月" @click="store.prevMonth()">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="month-display">
      <span class="year">{{ store.currentYear }}年
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="month">{{ store.currentMonth }}月</span>
    </div>
    <button class="arrow" aria-label="下个月" @click="store.nextMonth()">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.month-selector {
  display: grid;
  grid-template-columns: 54px 128px 54px;
  align-items: center;
  justify-content: center;
  gap: 46px;
  width: 100%;
  transform: translateX(-18px);
}

.month-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 128px;
}

.year {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 700;
}

.year svg {
  color: var(--text-primary);
}

.month {
  font-size: 43px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.05;
  margin-top: 4px;
  letter-spacing: 0;
}

.arrow {
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  color: #7d88aa;
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, background 0.18s ease;
}

.arrow:active {
  transform: scale(0.94);
  background: #fff;
}
</style>
