<script setup>
import { useRouter } from 'vue-router'
import { useExpenseStore } from '../stores/expense.js'
import { formatDateChinese, formatTime } from '../utils/calendar.js'
import { getCategoryMap, savingReasonMap } from '../data/categories.js'

const categoryMap = getCategoryMap()
const router = useRouter()
const store = useExpenseStore()

const paymentLabel = {
  credit: '信用卡',
  cash: '现金'
}

function formatExpenseTime(item) {
  return formatTime(item.createdAt)
}

let longPressTimer = null
let longPressTriggered = false

function editExpense(id) {
  router.push('/edit/' + id)
}

function startLongPress(item) {
  clearLongPress()
  longPressTriggered = false
  longPressTimer = window.setTimeout(async () => {
    longPressTriggered = true
    const categoryName = categoryMap[item.category]?.name || item.category
    const confirmed = confirm(`确定删除这笔「${categoryName}」记录吗？\n\n删除后无法恢复。`)
    if (confirmed) {
      await store.deleteExpense(item.id)
    }
  }, 650)
}

function clearLongPress() {
  if (longPressTimer) {
    window.clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleItemClick(id) {
  if (longPressTriggered) {
    longPressTriggered = false
    return
  }
  editExpense(id)
}
</script>

<template>
  <div class="expense-list">
    <div class="list-heading">
      <h2>支出明细</h2>
      <span v-if="store.expensesByDate.length">{{ formatDateChinese(store.expensesByDate[0].date) }}</span>
    </div>

    <div v-if="store.expensesByDate.length === 0" class="empty glass-card">
      <div class="empty-icon">＋</div>
      <p class="empty-text">还没有记账记录</p>
      <p class="empty-hint">点击下方加号开始记录第一笔</p>
    </div>

    <div
      v-for="(group, gi) in store.expensesByDate"
      :key="group.date"
      class="date-group"
      :style="{ animationDelay: gi * 0.05 + 's' }"
    >
      <div v-if="gi > 0" class="date-divider">{{ formatDateChinese(group.date) }}</div>
      <div class="expense-card glass-card">
        <button
          v-for="(item, ii) in group.items"
          :key="item.id"
          class="expense-item"
          :style="{ animationDelay: (gi * 0.05 + ii * 0.03) + 's' }"
          @click="handleItemClick(item.id)"
          @pointerdown="startLongPress(item)"
          @pointerup="clearLongPress"
          @pointerleave="clearLongPress"
          @pointercancel="clearLongPress"
        >
          <div class="item-icon" :style="{ background: categoryMap[item.category]?.bg || '#eef2fb', color: categoryMap[item.category]?.color || 'var(--accent)' }">
            <span v-if="categoryMap[item.category]?.iconType === 'telecom'" class="telecom-glyph" aria-hidden="true">
              <span v-for="n in 9" :key="n"></span>
            </span>
            <template v-else>{{ categoryMap[item.category]?.icon || '¥' }}</template>
          </div>
          <div class="item-info">
            <span class="item-name">{{ categoryMap[item.category]?.name || item.category }}</span>
            <span class="item-meta">
              <template v-if="formatExpenseTime(item)">{{ formatExpenseTime(item) }} · </template>
              {{ paymentLabel[item.paymentMethod] || '' }}
              <template v-if="item.savingAmount"> · 省 {{ item.savingAmount.toFixed(2) }} · {{ savingReasonMap[item.savingReason] || '省钱' }}</template>
              <template v-if="item.note"> · {{ item.note }}</template>
            </span>
          </div>
          <div class="item-amount">-¥{{ item.amount.toFixed(2) }}</div>
          <svg class="chevron" width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="store.expensesByDate.length > 0" class="end-text">— 没有更多了 —</div>
  </div>
</template>

<style scoped>
.expense-list {
  padding: 0 22px;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.list-heading h2 {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.list-heading span,
.date-divider {
  color: #7883a8;
  font-size: 15px;
  font-weight: 700;
}

.empty {
  text-align: center;
  padding: 44px 20px;
  border-radius: var(--radius-xl);
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  border-radius: 18px;
  color: #fff;
  font-size: 32px;
  background: linear-gradient(135deg, #7d92ff, #4f5df6);
}

.empty-text {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.date-group {
  margin-bottom: 18px;
  animation: fadeInUp 0.35s ease both;
}

.date-divider {
  padding: 0 2px 10px;
}

.expense-card {
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.expense-item {
  width: 100%;
  display: grid;
  grid-template-columns: 54px 1fr auto 20px;
  align-items: center;
  gap: 14px;
  padding: 17px 18px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
  animation: fadeInUp 0.35s ease both;
}

.expense-item + .expense-item {
  border-top: 1px solid rgba(137, 151, 196, 0.16);
}

.expense-item:active {
  transform: scale(0.985);
  background: rgba(238, 242, 251, 0.5);
}

.item-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border-radius: 17px;
  flex-shrink: 0;
}

.item-info {
  min-width: 0;
}

.item-name {
  display: block;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.25;
}

.item-meta {
  display: block;
  margin-top: 6px;
  color: #7f8aad;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-amount {
  color: var(--danger);
  font-size: 20px;
  font-weight: 800;
  white-space: nowrap;
}

.chevron {
  color: #b3bdd7;
}

.telecom-glyph {
  width: 25px;
  height: 31px;
  display: grid;
  grid-template-columns: repeat(3, 4px);
  grid-auto-rows: 4px;
  gap: 3px;
  justify-content: center;
  align-content: center;
  border-radius: 4px;
  background: #5940cf;
  box-shadow: 0 -3px 0 rgba(255, 255, 255, 0.18) inset;
}

.telecom-glyph span {
  border-radius: 1px;
}

.telecom-glyph span:nth-child(3n + 1) {
  background: #ffb02e;
}

.telecom-glyph span:nth-child(3n + 2) {
  background: #ff674b;
}

.telecom-glyph span:nth-child(3n) {
  background: #ffe66a;
}

.end-text {
  margin: 28px 0 12px;
  color: #9aa4c1;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
}

@media (max-width: 430px) {
  .expense-list {
    padding: 0 22px;
  }

  .expense-item {
    grid-template-columns: 48px minmax(0, 1fr) auto 16px;
    gap: 10px;
    padding: 16px 14px;
  }

  .item-icon {
    width: 48px;
    height: 48px;
  }

  .item-meta {
    display: -webkit-box;
    overflow: hidden;
    line-height: 1.25;
    white-space: normal;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .item-amount {
    justify-self: end;
    font-size: 19px;
  }

  .chevron {
    width: 16px;
    height: 16px;
  }
}

@media (max-width: 360px) {
  .expense-item {
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }

  .item-icon {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }

  .chevron {
    display: none;
  }
}
</style>
