import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import db from '../db/index.js'
import { isWorkday } from '../utils/calendar.js'
import { getCanonicalCategoryKey, getSnackAliasKeys } from '../data/categories.js'
import {
  deleteExpenseFromCloud,
  isCloudStorageEnabled,
  syncAllExpensesToCloud,
  syncExpenseToCloud
} from '../services/cloudSync.js'

export const useExpenseStore = defineStore('expense', () => {
  const expenses = ref([])
  const currentYear = ref(new Date().getFullYear())
  const currentMonth = ref(new Date().getMonth() + 1)
  const viewMode = ref('calendar')
  const cloudSyncError = ref('')

  const monthExpenses = computed(() => {
    const prefix = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`
    return expenses.value.filter(e => e.date.startsWith(prefix))
  })

  const totalExpense = computed(() => {
    return monthExpenses.value.reduce((sum, e) => sum + e.amount, 0)
  })

  const totalSaving = computed(() => {
    return monthExpenses.value.reduce((sum, e) => sum + (e.savingAmount || 0), 0)
  })

  const previousMonthSaving = computed(() => {
    let year = currentYear.value
    let month = currentMonth.value - 1
    if (month < 1) {
      month = 12
      year--
    }
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return expenses.value
      .filter(e => e.date.startsWith(prefix))
      .reduce((sum, e) => sum + (e.savingAmount || 0), 0)
  })

  const savingDiff = computed(() => totalSaving.value - previousMonthSaving.value)

  const workdayExpense = computed(() => {
    return monthExpenses.value
      .filter(e => isWorkday(e.date))
      .reduce((sum, e) => sum + e.amount, 0)
  })

  const restdayExpense = computed(() => {
    return monthExpenses.value
      .filter(e => !isWorkday(e.date))
      .reduce((sum, e) => sum + e.amount, 0)
  })

  const creditTotal = computed(() => {
    return monthExpenses.value
      .filter(e => e.paymentMethod === 'credit')
      .reduce((sum, e) => sum + e.amount, 0)
  })

  const cashTotal = computed(() => {
    return monthExpenses.value
      .filter(e => e.paymentMethod === 'cash')
      .reduce((sum, e) => sum + e.amount, 0)
  })

  const dailyTotals = computed(() => {
    const map = {}
    monthExpenses.value.forEach(e => {
      map[e.date] = (map[e.date] || 0) + e.amount
    })
    return map
  })

  const expensesByDate = computed(() => {
    const groups = {}
    monthExpenses.value.forEach(e => {
      if (!groups[e.date]) {
        groups[e.date] = []
      }
      groups[e.date].push(e)
    })
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        items: groups[date].sort((a, b) => b.createdAt - a.createdAt)
      }))
  })

  const categoryStats = computed(() => {
    const map = {}
    monthExpenses.value.forEach(e => {
      if (!map[e.category]) {
        map[e.category] = { category: e.category, expense: 0, saving: 0 }
      }
      map[e.category].expense += e.amount
      map[e.category].saving += e.savingAmount || 0
    })
    return Object.values(map).sort((a, b) => (b.expense + b.saving) - (a.expense + a.saving))
  })

  async function loadExpenses() {
    const snackAliases = ['retail', ...getSnackAliasKeys()]
    cloudSyncError.value = ''

    // 始终从本地缓存加载，立即展示
    const rows = await db.expenses.toArray()
    if (snackAliases.length > 0) {
      const snackAliasSet = new Set(snackAliases)
      await Promise.all(rows
        .filter(item => snackAliasSet.has(item.category))
        .map(item => db.expenses.update(item.id, { category: 'snack' })))
    }
    expenses.value = rows.map(item => ({
      ...item,
      category: getCanonicalCategoryKey(item.category)
    }))

    // 云端存储开启时，将本地未同步的数据推送到云端
    if (isCloudStorageEnabled()) {
      syncLocalExpensesToCloud().catch(error => {
        cloudSyncError.value = error.message || '云端同步失败'
        console.warn('Cloud expense sync failed:', error)
      })
    }
  }

  async function addExpense(data) {
    const record = { ...data, category: getCanonicalCategoryKey(data.category), createdAt: Date.now() }
    const id = await db.expenses.add(record)
    const saved = { ...record, id }
    expenses.value.push(saved)
    try {
      await syncExpenseToCloud(saved)
      cloudSyncError.value = ''
    } catch (error) {
      cloudSyncError.value = error.message || '云端同步失败'
      console.warn('Cloud expense add sync failed:', error)
    }
  }

  async function updateExpense(id, data) {
    const normalizedData = data.category
      ? { ...data, category: getCanonicalCategoryKey(data.category) }
      : data
    await db.expenses.update(id, normalizedData)
    const idx = expenses.value.findIndex(e => e.id === id)
    if (idx !== -1) {
      expenses.value[idx] = { ...expenses.value[idx], ...normalizedData }
      try {
        await syncExpenseToCloud(expenses.value[idx])
        cloudSyncError.value = ''
      } catch (error) {
        cloudSyncError.value = error.message || '云端同步失败'
        console.warn('Cloud expense update sync failed:', error)
      }
    }
  }

  async function deleteExpense(id) {
    await db.expenses.delete(id)
    expenses.value = expenses.value.filter(e => e.id !== id)
    try {
      await deleteExpenseFromCloud(id)
      cloudSyncError.value = ''
    } catch (error) {
      cloudSyncError.value = error.message || '云端同步失败'
      console.warn('Cloud expense delete sync failed:', error)
    }
  }

  async function syncLocalExpensesToCloud() {
    cloudSyncError.value = ''
    const rows = await db.expenses.toArray()
    try {
      const count = await syncAllExpensesToCloud(rows.map(item => ({
        ...item,
        category: getCanonicalCategoryKey(item.category)
      })))
      return count
    } catch (error) {
      cloudSyncError.value = error.message || '云端同步失败'
      throw error
    }
  }

  function setMonth(year, month) {
    currentYear.value = year
    currentMonth.value = month
  }

  function prevMonth() {
    if (currentMonth.value === 1) {
      currentMonth.value = 12
      currentYear.value--
    } else {
      currentMonth.value--
    }
  }

  function nextMonth() {
    if (currentMonth.value === 12) {
      currentMonth.value = 1
      currentYear.value++
    } else {
      currentMonth.value++
    }
  }

  return {
    expenses, currentYear, currentMonth, viewMode, cloudSyncError,
    monthExpenses, totalExpense, totalSaving, previousMonthSaving, savingDiff,
    workdayExpense, restdayExpense, creditTotal, cashTotal, dailyTotals,
    expensesByDate, categoryStats,
    loadExpenses, addExpense, updateExpense, deleteExpense,
    syncLocalExpensesToCloud, setMonth, prevMonth, nextMonth
  }
})
