<script setup>
import { ref, computed } from 'vue'
import { useExpenseStore } from '../stores/expense.js'
import { getCategoryMap } from '../data/categories.js'

const store = useExpenseStore()
const categoryMap = getCategoryMap()
const rankType = ref('expense')

const rankings = computed(() => {
  const map = {}
  store.monthExpenses.forEach(e => {
    if (!map[e.category]) {
      map[e.category] = { category: e.category, expense: 0, saving: 0, count: 0 }
    }
    map[e.category].expense += e.amount
    map[e.category].saving += e.savingAmount || 0
    map[e.category].count++
  })
  const list = Object.values(map)
  const key = rankType.value === 'expense' ? 'expense' : 'saving'
  return list
    .filter(item => rankType.value === 'expense' ? item.expense > 0 : item.saving > 0)
    .sort((a, b) => b[key] - a[key])
})

const maxAmount = computed(() => {
  if (rankings.value.length === 0) return 1
  const key = rankType.value === 'expense' ? 'expense' : 'saving'
  return Math.max(...rankings.value.map(item => item[key]), 1)
})

const totalExpense = computed(() => store.monthExpenses.reduce((s, e) => s + e.amount, 0))
const totalSaving = computed(() => store.monthExpenses.reduce((s, e) => s + (e.savingAmount || 0), 0))
</script>

<template>
  <div class="charts-view">
    <header class="page-heading">
      <h2 class="page-title">图表</h2>
    </header>

    <div class="toggle-row glass-card">
      <button class="toggle-btn" :class="{ active: rankType === 'expense' }" @click="rankType = 'expense'">支出排行</button>
      <button class="toggle-btn" :class="{ active: rankType === 'saving' }" @click="rankType = 'saving'">省钱排行</button>
    </div>

    <section class="summary-panel glass-card">
      <span>{{ rankType === 'expense' ? '本月总支出' : '本月总省钱' }}</span>
      <strong :class="{ green: rankType === 'saving' }">¥{{ (rankType === 'expense' ? totalExpense : totalSaving).toFixed(2) }}</strong>
    </section>

    <div v-if="rankings.length > 0" class="rank-list glass-card">
      <div v-for="(item, index) in rankings" :key="item.category" class="rank-item" :style="{ animationDelay: index * 0.05 + 's' }">
        <div class="rank-num" :class="{ top: index < 3 }">{{ index + 1 }}</div>
        <div class="rank-icon" :style="{ background: categoryMap[item.category]?.bg || '#eef2fb', color: categoryMap[item.category]?.color || 'var(--accent)' }">
          {{ categoryMap[item.category]?.icon || '¥' }}
        </div>
        <div class="rank-body">
          <div class="rank-head">
            <span class="rank-name">{{ categoryMap[item.category]?.name || item.category }}</span>
            <span class="rank-amount">¥{{ (rankType === 'expense' ? item.expense : item.saving).toFixed(2) }}</span>
          </div>
          <div class="rank-bar-track">
            <div class="rank-bar-fill" :class="rankType" :style="{ width: `${(rankType === 'expense' ? item.expense : item.saving) / maxAmount * 100}%` }"></div>
          </div>
          <div class="rank-meta">
            <span>{{ item.count }}笔</span>
            <span v-if="rankType === 'expense' && item.saving > 0" class="meta-saving">省 ¥{{ item.saving.toFixed(2) }}</span>
            <span v-if="rankType === 'saving' && item.expense > 0" class="meta-expense">支出 ¥{{ item.expense.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty glass-card">
      <div class="empty-icon">⌁</div>
      <p class="empty-text">暂无数据</p>
      <p class="empty-hint">添加记账记录后查看排行</p>
    </div>
  </div>
</template>

<style scoped>
.charts-view {
  min-height: 100%;
  padding: 0 22px 24px;
}

.page-heading {
  padding-left: 2px;
  padding-right: 2px;
}

.toggle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 6px;
  border-radius: 20px;
  margin-bottom: 16px;
}

.toggle-btn {
  padding: 11px 14px;
  border-radius: 15px;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.toggle-btn.active {
  color: #fff;
  background: linear-gradient(135deg, #7791ff, #4f5df6);
  box-shadow: 0 10px 20px rgba(93, 115, 255, 0.24);
}

.summary-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  margin-bottom: 16px;
  border-radius: var(--radius-lg);
  animation: fadeInUp 0.3s ease both;
}

.summary-panel span {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
}

.summary-panel strong {
  color: var(--text-primary);
  font-size: 26px;
  font-weight: 800;
}

.summary-panel strong.green {
  color: var(--green);
}

.rank-list {
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.rank-item {
  display: grid;
  grid-template-columns: 30px 46px 1fr;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  animation: fadeInUp 0.35s ease both;
}

.rank-item + .rank-item {
  border-top: 1px solid rgba(137, 151, 196, 0.16);
}

.rank-num {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  background: #eef2fb;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 800;
}

.rank-num.top {
  color: #fff;
  background: linear-gradient(135deg, #7d92ff, #4f5df6);
}

.rank-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  font-size: 22px;
}

.rank-body {
  min-width: 0;
}

.rank-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.rank-name {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
}

.rank-amount {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
}

.rank-bar-track {
  height: 7px;
  background: #eef2fb;
  border-radius: 999px;
  overflow: hidden;
}

.rank-bar-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.rank-bar-fill.expense {
  background: var(--danger);
}

.rank-bar-fill.saving {
  background: var(--green);
}

.rank-meta {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.meta-saving {
  color: var(--green);
}

.meta-expense {
  color: var(--danger);
}

.empty {
  text-align: center;
  padding: 54px 20px;
  border-radius: var(--radius-xl);
}

.empty-icon {
  color: var(--accent);
  font-size: 38px;
  margin-bottom: 10px;
}

.empty-text {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 800;
}

.empty-hint {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}
</style>
