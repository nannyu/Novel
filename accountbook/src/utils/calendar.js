import { holidays, extraWorkdays } from '../data/holidays.js'

const WEEKDAYS_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function isWorkday(dateStr) {
  if (extraWorkdays[dateStr]) return true
  if (holidays[dateStr]) return false
  const day = new Date(dateStr).getDay()
  return day >= 1 && day <= 5
}

export function isToday(dateStr) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return dateStr === `${y}-${m}-${d}`
}

export function formatDateChinese(dateStr) {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAYS_FULL[date.getDay()]
  return `${month}月${day}日 ${weekday}`
}

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  let startDay = firstDay.getDay()
  startDay = startDay === 0 ? 6 : startDay - 1

  const daysInMonth = new Date(year, month, 0).getDate()
  const grid = []
  let row = []

  for (let i = 0; i < startDay; i++) {
    row.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const m = String(month).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    row.push({ date: `${year}-${m}-${d}`, day })
    if (row.length === 7) {
      grid.push(row)
      row = []
    }
  }

  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    grid.push(row)
  }

  while (grid.length < 6) {
    grid.push(new Array(7).fill(null))
  }

  return grid
}

export function getMonthDays(year, month) {
  return new Date(year, month, 0).getDate()
}
