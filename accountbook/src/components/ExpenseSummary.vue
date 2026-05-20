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
  grid-template-columns: minmax(0, 1.42fr) 1px minmax(86px, 0.82fr) minmax(72px, 0.58fr);
  align-items: center;
  column-gap: 16px;
  min-height: 118px;
  margin: 10px 22px 27px;
  padding: 20px 20px 20px 18px;
  border-radius: 30px;
  animation: fadeInUp 0.4s ease both;
}

.saving-block {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.saving-block > div {
  min-width: 0;
}

.saving-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: #5aa36b;
  background: linear-gradient(135deg, #dff1e6, #f0faf0);
  flex-shrink: 0;
}

.summary-label {
  display: block;
  color: #697096;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 8px;
  white-space: nowrap;
}

.saving-amount,
.expense-amount {
  display: block;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.saving-amount {
  color: #279f61;
  font-size: 30px;
}

.expense-amount {
  color: #050827;
  font-size: 34px;
}

small {
  display: block;
  color: #9aa4c3;
  font-size: 13px;
  font-weight: 800;
  margin-top: 8px;
  line-height: 1.2;
  white-space: nowrap;
}

.summary-divider {
  width: 1px;
  height: 62px;
  background: rgba(137, 151, 196, 0.24);
}

.expense-block {
  min-width: 0;
}

.day-breakdown {
  display: grid;
  gap: 17px;
  min-width: 0;
}

.day-row {
  display: grid;
  grid-template-columns: 9px minmax(42px, 1fr);
  column-gap: 9px;
  row-gap: 4px;
  align-items: center;
}

.day-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.day-dot.work {
  background: #5ba66d;
}

.day-dot.rest {
  background: #877ae8;
}

.day-label {
  color: #8e91b5;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.day-row strong {
  grid-column: 2;
  color: #050827;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

@media (max-width: 430px) {
  .summary-card {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.86fr);
    column-gap: 16px;
    row-gap: 16px;
    min-height: 138px;
    margin: 8px 22px 27px;
    padding: 19px 18px 16px;
  }

  .saving-block {
    gap: 10px;
  }

  .saving-icon {
    width: 42px;
    height: 42px;
    border-radius: 16px;
  }

  .summary-label,
  .day-label {
    font-size: 14px;
  }

  .saving-amount {
    font-size: 26px;
  }

  .expense-amount {
    font-size: 29px;
  }

  small {
    font-size: 11px;
  }

  .summary-divider {
    display: none;
  }

  .expense-block {
    align-self: center;
    justify-self: end;
    text-align: left;
  }

  .day-breakdown {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(137, 151, 196, 0.14);
  }

  .day-row {
    grid-template-columns: 9px minmax(0, 1fr);
  }

  .day-row strong {
    font-size: 13px;
  }
}

@media (max-width: 360px) {
  .summary-card {
    grid-template-columns: minmax(0, 1fr) minmax(78px, auto);
    row-gap: 14px;
    margin-left: 18px;
    margin-right: 18px;
  }

  .summary-divider {
    display: none;
  }

  .expense-block {
    text-align: right;
  }

  .day-breakdown {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(137, 151, 196, 0.14);
  }
}
</style>
