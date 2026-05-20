<script setup>
import { ref, computed } from 'vue'
import { useExpenseStore } from '../stores/expense.js'
import { getCategoryMap } from '../data/categories.js'

const store = useExpenseStore()
const categoryMap = getCategoryMap()
const rankType = ref('expense')
const trendMode = ref('week')
const periodOffset = ref(0)
const selectedPointIndex = ref(null)
const hoveredPointIndex = ref(null)

const trendModes = [
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' }
]

const DAY = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatShortDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}-${d}`
}

function getWeekStart(date) {
  const current = startOfDay(date)
  const day = current.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(current, diff)
}

function getWeekNumber(date) {
  const target = startOfDay(date)
  const firstDay = new Date(target.getFullYear(), 0, 1)
  const pastDays = Math.floor((target - firstDay) / DAY)
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7)
}

function sumExpenseBetween(start, end) {
  const startKey = formatDateKey(start)
  const endKey = formatDateKey(end)
  return store.expenses
    .filter(item => item.date >= startKey && item.date <= endKey)
    .reduce((sum, item) => sum + item.amount, 0)
}

const periodOptions = computed(() => {
  const now = new Date()
  if (trendMode.value === 'week') {
    const thisWeekStart = getWeekStart(now)
    return [-5, -4, -3, -2, -1, 0].map(offset => {
      const start = addDays(thisWeekStart, offset * 7)
      return {
        offset,
        label: offset === 0 ? '本周' : offset === -1 ? '上周' : `${getWeekNumber(start)}周`
      }
    })
  }
  if (trendMode.value === 'month') {
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return [-5, -4, -3, -2, -1, 0].map(offset => {
      const start = addMonths(thisMonthStart, offset)
      return {
        offset,
        label: `${start.getMonth() + 1}月`
      }
    })
  }
  return [-5, -4, -3, -2, -1, 0].map(offset => {
    const year = now.getFullYear() + offset
    return {
      offset,
      label: `${year}年`
    }
  })
})

const trendPoints = computed(() => {
  const now = new Date()
  if (trendMode.value === 'week') {
    const start = addDays(getWeekStart(now), periodOffset.value * 7)
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index)
      const key = formatDateKey(date)
      const label = formatShortDate(date)
      return {
        label,
        axisLabel: label,
        value: sumExpenseBetween(date, date),
        key
      }
    })
  }
  if (trendMode.value === 'month') {
    const monthStart = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), periodOffset.value)
    const days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
    return Array.from({ length: days }, (_, index) => {
      const date = addDays(monthStart, index)
      const day = index + 1
      return {
        label: `${day}日`,
        axisLabel: day === 1 || day % 5 === 0 || day === days ? String(day) : '',
        value: sumExpenseBetween(date, date),
        key: formatDateKey(date)
      }
    })
  }
  const year = now.getFullYear() + periodOffset.value
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(year, index, 1)
    const end = new Date(year, index + 1, 0)
    return {
      label: `${index + 1}月`,
      axisLabel: `${index + 1}月`,
      value: sumExpenseBetween(start, end),
      key: `${year}-${String(index + 1).padStart(2, '0')}`
    }
  })
})

const trendRange = computed(() => {
  const now = new Date()
  if (trendMode.value === 'week') {
    const start = addDays(getWeekStart(now), periodOffset.value * 7)
    return { start, end: addDays(start, 6) }
  }
  if (trendMode.value === 'month') {
    const start = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), periodOffset.value)
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 0) }
  }
  const year = now.getFullYear() + periodOffset.value
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) }
})

const selectedPeriodLabel = computed(() => {
  return periodOptions.value.find(option => option.offset === periodOffset.value)?.label || ''
})

const periodExpenses = computed(() => {
  const startKey = formatDateKey(trendRange.value.start)
  const endKey = formatDateKey(trendRange.value.end)
  return store.expenses.filter(item => item.date >= startKey && item.date <= endKey)
})

const trendTotal = computed(() => trendPoints.value.reduce((sum, item) => sum + item.value, 0))
const trendAverage = computed(() => trendPoints.value.length ? trendTotal.value / trendPoints.value.length : 0)
const trendMax = computed(() => Math.max(...trendPoints.value.map(item => item.value), 1))

const chartGeometry = computed(() => {
  const width = 360
  const height = 136
  const left = 16
  const right = 16
  const top = 14
  const bottom = 28
  const points = trendPoints.value
  const span = Math.max(points.length - 1, 1)

  const coords = points.map((point, index) => {
    const x = left + (index / span) * (width - left - right)
    const y = top + (1 - point.value / trendMax.value) * (height - top - bottom)
    return { ...point, x, y }
  })

  return {
    width,
    height,
    coords,
    line: coords.map(point => `${point.x},${point.y}`).join(' '),
    averageY: top + (1 - trendAverage.value / trendMax.value) * (height - top - bottom)
  }
})

const activeTrendPoint = computed(() => {
  const points = chartGeometry.value.coords
  if (points.length === 0) return null
  if (hoveredPointIndex.value !== null && points[hoveredPointIndex.value]) {
    return points[hoveredPointIndex.value]
  }
  if (selectedPointIndex.value !== null && points[selectedPointIndex.value]) {
    return points[selectedPointIndex.value]
  }
  return null
})

const rankings = computed(() => {
  const map = {}
  periodExpenses.value.forEach(e => {
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

const totalExpense = computed(() => periodExpenses.value.reduce((s, e) => s + e.amount, 0))
const totalSaving = computed(() => periodExpenses.value.reduce((s, e) => s + (e.savingAmount || 0), 0))

function setTrendMode(mode) {
  trendMode.value = mode
  periodOffset.value = 0
  selectedPointIndex.value = null
  hoveredPointIndex.value = null
}

function setPeriod(offset) {
  periodOffset.value = offset
  selectedPointIndex.value = null
  hoveredPointIndex.value = null
}

function toggleTrendPoint(index) {
  selectedPointIndex.value = selectedPointIndex.value === index ? null : index
}
</script>

<template>
  <div class="charts-view">
    <header class="page-heading">
      <h2 class="page-title">图表</h2>
    </header>

    <section class="trend-section glass-card">
      <div class="trend-mode-tabs" role="tablist" aria-label="趋势周期">
        <button
          v-for="mode in trendModes"
          :key="mode.key"
          class="trend-mode-btn"
          :class="{ active: trendMode === mode.key }"
          @click="setTrendMode(mode.key)"
        >
          {{ mode.label }}
        </button>
      </div>

      <div class="period-strip">
        <button
          v-for="option in periodOptions"
          :key="option.offset"
          class="period-btn"
          :class="{ active: periodOffset === option.offset }"
          @click="setPeriod(option.offset)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="trend-stats">
        <span>总支出：<strong>{{ trendTotal.toFixed(2) }}</strong></span>
        <span>平均值：<strong>{{ trendAverage.toFixed(2) }}</strong></span>
      </div>

      <div class="line-chart">
        <svg :viewBox="`0 0 ${chartGeometry.width} ${chartGeometry.height}`" role="img" aria-label="支出趋势折线图">
          <line
            x1="16"
            :x2="chartGeometry.width - 16"
            :y1="chartGeometry.averageY"
            :y2="chartGeometry.averageY"
            class="avg-line"
          />
          <polyline class="trend-line" :points="chartGeometry.line" />
          <g
            v-for="(point, index) in chartGeometry.coords"
            :key="point.key"
            class="point-group"
            tabindex="0"
            @mouseover="hoveredPointIndex = index"
            @mouseout="hoveredPointIndex = null"
            @mouseenter="hoveredPointIndex = index"
            @mouseleave="hoveredPointIndex = null"
            @pointerenter="hoveredPointIndex = index"
            @pointerleave="hoveredPointIndex = null"
            @focus="hoveredPointIndex = index"
            @blur="hoveredPointIndex = null"
            @click="toggleTrendPoint(index)"
          >
            <line v-if="activeTrendPoint?.key === point.key" :x1="point.x" :x2="point.x" :y1="point.y" :y2="chartGeometry.height - 32" class="focus-line" />
            <circle class="trend-hit" :cx="point.x" :cy="point.y" r="13" />
            <circle
              class="trend-dot"
              :class="{ active: activeTrendPoint?.key === point.key, filled: point.value > 0 }"
              :cx="point.x"
              :cy="point.y"
              r="4.5"
            />
            <g
              class="svg-tooltip"
              :transform="`translate(${Math.min(Math.max(point.x - 43, 4), chartGeometry.width - 90)}, ${Math.max(point.y - 58, 4)})`"
            >
              <rect width="86" height="42" rx="7" />
              <path d="M37 42L43 48L49 42Z" />
              <text x="43" y="17" text-anchor="middle">{{ point.value > 0 ? point.value.toFixed(2) : '没有费用' }}</text>
              <text x="43" y="33" text-anchor="middle" class="tooltip-date">{{ point.label }}</text>
            </g>
            <text v-if="point.axisLabel" class="axis-label" :x="point.x" :y="chartGeometry.height - 8" text-anchor="middle">{{ point.axisLabel }}</text>
          </g>
        </svg>
      </div>
    </section>

    <div class="toggle-row glass-card">
      <button class="toggle-btn" :class="{ active: rankType === 'expense' }" @click="rankType = 'expense'">支出排行</button>
      <button class="toggle-btn" :class="{ active: rankType === 'saving' }" @click="rankType = 'saving'">省钱排行</button>
    </div>

    <section class="summary-panel glass-card">
      <span>{{ selectedPeriodLabel }}{{ rankType === 'expense' ? '总支出' : '总省钱' }}</span>
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
      <div class="empty-icon">↗</div>
      <p class="empty-text">暂无数据</p>
      <p class="empty-hint">添加记账记录后查看排行</p>
    </div>
  </div>
</template>

<style scoped>
.charts-view {
  min-height: 100%;
  padding: 0 22px calc(150px + env(safe-area-inset-bottom, 0px));
}

.page-heading {
  padding-left: 2px;
  padding-right: 2px;
}

.trend-section {
  overflow: hidden;
  margin-bottom: 16px;
  border-radius: var(--radius-xl);
  animation: fadeInUp 0.3s ease both;
}

.trend-mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(137, 151, 196, 0.12);
}

.trend-mode-btn {
  height: 34px;
  color: var(--text-secondary);
  border-radius: 13px;
  font-size: 16px;
  font-weight: 800;
  transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.16s ease;
}

.trend-mode-btn:active {
  transform: scale(0.97);
}

.trend-mode-btn.active {
  color: #fff;
  background: linear-gradient(135deg, #7791ff, #4f5df6);
  box-shadow: 0 8px 16px rgba(93, 115, 255, 0.22);
}

.period-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 2px;
  overflow: hidden;
  padding: 9px 10px 0;
  border-bottom: 1px solid rgba(137, 151, 196, 0.2);
}

.period-btn {
  min-width: 0;
  padding: 0 0 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.period-btn.active {
  color: var(--accent);
  box-shadow: 0 3px 0 var(--accent);
}

.trend-stats {
  display: grid;
  gap: 2px;
  padding: 11px 18px 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
}

.trend-stats strong {
  color: var(--text-primary);
  font-weight: 800;
}

.line-chart {
  position: relative;
  height: 150px;
  padding: 0 8px 6px;
}

.line-chart svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.avg-line {
  stroke: rgba(137, 151, 196, 0.28);
  stroke-dasharray: 8 10;
  stroke-width: 1;
}

.trend-line {
  fill: none;
  stroke: #6f7cff;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.focus-line {
  stroke: var(--accent);
  stroke-width: 1.4;
}

.trend-dot {
  fill: #fff;
  stroke: #666a76;
  stroke-width: 1.8;
  cursor: pointer;
}

.point-group {
  cursor: pointer;
  outline: none;
}

.trend-hit {
  fill: transparent;
}

.svg-tooltip {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s ease;
}

.point-group:hover .svg-tooltip,
.point-group:focus .svg-tooltip,
.point-group:focus-within .svg-tooltip {
  opacity: 1;
}

.svg-tooltip rect,
.svg-tooltip path {
  fill: #333331;
}

.svg-tooltip text {
  fill: #fff;
  font-size: 12px;
  font-weight: 800;
}

.svg-tooltip .tooltip-date {
  fill: rgba(255, 255, 255, 0.78);
  font-size: 10px;
}

.trend-dot.filled {
  fill: #fff;
  stroke: var(--accent);
}

.trend-dot.active {
  stroke-width: 2.4;
}

.axis-label {
  fill: #7883a8;
  font-size: 12px;
  font-weight: 700;
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

@media (max-width: 380px) {
  .charts-view {
    padding-left: 14px;
    padding-right: 14px;
    padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px));
  }

  .period-strip {
    gap: 1px;
    padding-left: 8px;
    padding-right: 8px;
  }

  .trend-mode-btn {
    height: 32px;
    font-size: 15px;
  }

  .rank-item {
    grid-template-columns: 26px 42px 1fr;
    gap: 10px;
    padding: 15px 14px;
  }
}
</style>
