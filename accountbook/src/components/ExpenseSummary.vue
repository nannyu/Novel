<script setup>
import { computed } from 'vue'
import { useExpenseStore } from '../stores/expense.js'

const store = useExpenseStore()

const savingCompareText = computed(() => {
  const diff = store.savingDiff
  if (diff > 0) return `比上月多省 ¥${diff.toFixed(2)} ↑`
  if (diff < 0) return `比上月少省 ¥${Math.abs(diff).toFixed(2)} ↓`
  return '和上月省得一样多'
})
</script>

<template>
  <section class="summary-card glass-card">
    <div class="saving-block">
      <div class="saving-icon">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 8h13a3 3 0 013 3v7a2 2 0 01-2 2H5a3 3 0 01-3-3V10a2 2 0 012-2Z" />
          <path d="M7 8V6.5A2.5 2.5 0 019.5 4H17" />
          <circle cx="17" cy="14" r="2" />
          <path d="M17 13v2M16 14h2" />
        </svg>
      </div>
      <div>
        <span class="summary-label">本月已省钱</span>
        <strong class="saving-amount">¥{{ store.totalSaving.toFixed(2) }}</strong>
        <small>{{ savingCompareText }}</small>
      </div>
    </div>

    <div class="summary-divider"></div>

    <div class="expense-block">
      <span class="summary-label">本月共支出</span>
      <strong class="expense-amount">¥{{ store.totalExpense.toFixed(2) }}</strong>
    </div>

    <div class="day-breakdown">
      <div class="day-row">
        <span class="day-dot work"></span>
        <span class="day-label">工作日</span>
        <strong>¥{{ store.workdayExpense.toFixed(2) }}</strong>
      </div>
      <div class="day-row">
        <span class="day-dot rest"></span>
        <span class="day-label">节假日</span>
        <strong>¥{{ store.restdayExpense.toFixed(2) }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-card {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) 1px minmax(96px, 0.82fr) minmax(76px, 0.56fr);
  align-items: center;
  column-gap: 18px;
  row-gap: 12px;
  min-height: 122px;
  margin: 29px 22px 27px;
  padding: 21px 18px 20px;
  border-radius: 30px;
  animation: fadeInUp 0.4s ease both;
}

.saving-block {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.saving-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 17px;
  color: var(--green);
  background: linear-gradient(135deg, rgba(40, 164, 99, 0.18), rgba(40, 164, 99, 0.06));
  flex-shrink: 0;
}

.summary-label {
  display: block;
  color: #6d769b;
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 4px;
  white-space: nowrap;
}

.saving-amount,
.expense-amount {
  display: block;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0;
}

.saving-amount {
  color: var(--green);
}

.expense-amount {
  color: var(--text-primary);
}

small {
  display: block;
  max-width: 118px;
  color: #9aa4c1;
  font-size: 12px;
  font-weight: 700;
  margin-top: 5px;
  line-height: 1.25;
}

.summary-divider {
  width: 1px;
  height: 49px;
  background: rgba(137, 151, 196, 0.22);
}

.expense-block {
  min-width: 0;
  padding-left: 2px;
}

.day-breakdown {
  display: grid;
  gap: 13px;
  min-width: 0;
}

.day-row {
  display: grid;
  grid-template-columns: 8px 1fr;
  column-gap: 6px;
  row-gap: 4px;
  align-items: center;
  padding: 1px 0;
}

.day-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.day-dot.work {
  background: var(--green);
}

.day-dot.rest {
  background: #8a80f4;
}

.day-label {
  color: #8a94ba;
  font-size: 11.5px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.day-row strong {
  grid-column: 2;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

@media (max-width: 390px) {
  .summary-card {
    grid-template-columns: 1fr 1px 0.8fr;
    row-gap: 14px;
  }

  .saving-amount,
  .expense-amount {
    font-size: 23px;
  }

  .day-breakdown {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, 1fr);
    padding-top: 2px;
  }
}
</style>
