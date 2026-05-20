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
      <span class="year">
        {{ store.currentYear }}年
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
  position: relative;
  width: 100%;
  height: 88px;
}

.month-display {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 132px;
}

.year {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 800;
  line-height: 1;
}

.month {
  margin-top: 7px;
  color: var(--text-primary);
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
}

.arrow {
  position: absolute;
  top: 32px;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  color: #7d88aa;
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, background 0.18s ease;
}

.arrow:first-child {
  left: 30px;
}

.arrow:active {
  transform: scale(0.94);
  background: #fff;
}

.arrow:last-child {
  right: 62px;
}

@media (max-width: 430px) {
  .month-selector {
    height: 88px;
  }

  .arrow:first-child {
    left: 28px;
  }

  .arrow:last-child {
    right: 58px;
  }
}

@media (max-width: 380px) {
  .month {
    font-size: 38px;
  }

  .arrow {
    width: 40px;
    height: 40px;
  }

  .arrow:first-child {
    left: 22px;
  }

  .arrow:last-child {
    right: 54px;
  }
}
</style>
