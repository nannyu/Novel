<script setup>
import { computed } from 'vue'
import { useExpenseStore } from '../stores/expense.js'
import { isToday } from '../utils/calendar.js'
import { holidays, extraWorkdays } from '../data/holidays.js'

const store = useExpenseStore()
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const grid = computed(() => {
  const year = store.currentYear
  const month = store.currentMonth
  const firstDay = new Date(year, month - 1, 1)
  let startDay = firstDay.getDay()
  startDay = startDay === 0 ? 6 : startDay - 1

  const daysInMonth = new Date(year, month, 0).getDate()
  const prevMonthDays = new Date(year, month - 1, 0).getDate()
  const cells = []

  for (let i = startDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    cells.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, day, currentMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, day, currentMonth: true })
  }

  let nextDay = 1
  while (cells.length < 42) {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    cells.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`, day: nextDay, currentMonth: false })
    nextDay++
  }

  const rows = []
  for (let i = 0; i < 42; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
})

function getCellTag(cell) {
  if (!cell.currentMonth) return null
  if (holidays[cell.date]) return { text: '休', type: 'holiday' }
  if (extraWorkdays[cell.date]) return { text: '班', type: 'work' }
  const dow = new Date(cell.date).getDay()
  if (dow === 0 || dow === 6) return { text: '休', type: 'weekend' }
  return null
}

function formatAmount(amount) {
  if (amount >= 10000) return (amount / 10000).toFixed(1) + 'w'
  if (amount >= 1000) return (amount / 1000).toFixed(1) + 'k'
  return amount >= 100 ? amount.toFixed(0) : amount.toFixed(amount % 1 === 0 ? 0 : 2)
}
</script>

<template>
  <div class="calendar-wrapper">
    <div class="calendar-grid glass-card">
      <div class="weekday-row">
        <span v-for="wd in WEEKDAYS" :key="wd" class="weekday">{{ wd }}</span>
      </div>
      <div class="days-grid">
        <template v-for="(row, ri) in grid" :key="ri">
          <div
            v-for="(cell, ci) in row"
            :key="ci"
            class="day-cell"
            :class="{ today: cell.currentMonth && isToday(cell.date), 'other-month': !cell.currentMonth }"
          >
            <span class="day-num">{{ cell.day }}</span>
            <span v-if="cell.currentMonth && (getCellTag(cell) || store.dailyTotals[cell.date])" class="day-meta">
              <span v-if="getCellTag(cell)" class="day-tag" :class="getCellTag(cell).type">{{ getCellTag(cell).text }}</span>
              <span v-if="store.dailyTotals[cell.date]" class="day-amount">{{ formatAmount(store.dailyTotals[cell.date]) }}</span>
            </span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-wrapper {
  padding: 0 22px 4px;
}

.calendar-grid {
  border-radius: var(--radius-xl);
  padding: 16px 14px 12px;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(137, 151, 196, 0.16);
  margin-bottom: 6px;
}

.weekday {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.day-cell {
  aspect-ratio: 1 / 1.2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 14px;
}

.day-cell.today {
  color: #fff;
  background: linear-gradient(135deg, #7791ff, #4f5df6);
}

.day-cell.other-month .day-num {
  color: var(--text-muted);
  opacity: 0.35;
}

.day-num {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.today .day-num {
  color: #fff;
}

.day-meta {
  min-height: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
}

.day-tag,
.day-amount {
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

.day-tag.holiday,
.day-tag.weekend {
  color: var(--danger);
}

.today .day-tag {
  color: #fff;
}

.day-tag.work {
  color: var(--text-muted);
}

.day-amount {
  color: var(--green);
  max-width: 34px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.today .day-amount {
  color: #fff;
}
</style>
