<script setup>
import { ref, onMounted } from 'vue'
import { useExpenseStore } from '../stores/expense.js'
import db from '../db/index.js'

const store = useExpenseStore()
const storageSize = ref('计算中...')
const totalRecords = ref(0)

async function calcStorageSize() {
  try {
    const data = await db.expenses.toArray()
    totalRecords.value = data.length
    const json = JSON.stringify(data)
    const bytes = new Blob([json]).size
    if (bytes < 1024) {
      storageSize.value = bytes + ' B'
    } else if (bytes < 1024 * 1024) {
      storageSize.value = (bytes / 1024).toFixed(1) + ' KB'
    } else {
      storageSize.value = (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }
  } catch {
    storageSize.value = '计算失败'
  }
}

onMounted(calcStorageSize)

async function exportData() {
  try {
    const data = await db.expenses.toArray()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `记账本备份_${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert('导出失败')
  }
}

async function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      if (!Array.isArray(imported)) {
        alert('文件格式不正确')
        return
      }

      const existing = await db.expenses.toArray()
      const existingIds = new Set(existing.map(e => e.id))
      const duplicates = imported.filter(item => existingIds.has(item.id))

      const confirmed = duplicates.length > 0
        ? confirm(`发现 ${duplicates.length} 条与现有数据重复的记录，确定要导入吗？\n\n重复数据将被覆盖。`)
        : confirm(`确定要导入 ${imported.length} 条记录吗？`)
      if (!confirmed) return

      await db.expenses.bulkPut(imported)
      await store.loadExpenses()
      await calcStorageSize()
      alert(`成功导入 ${imported.length} 条记录`)
    } catch {
      alert('导入失败，请检查文件格式')
    }
  }
  input.click()
}

async function clearAll() {
  if (confirm('确定要清除所有记账数据吗？\n\n清除后无法恢复，建议先导出备份。')) {
    await db.expenses.clear()
    store.expenses = []
    await calcStorageSize()
    alert('数据已清除')
  }
}
</script>

<template>
  <div class="profile-view">
    <header class="page-heading">
      <h2 class="page-title">我的</h2>
    </header>

    <section class="section">
      <div class="section-title">数据存储</div>
      <div class="storage-card glass-card">
        <div class="storage-row">
          <span class="storage-label">存储大小</span>
          <span class="storage-value">{{ storageSize }}</span>
        </div>
        <div class="storage-row">
          <span class="storage-label">记录条数</span>
          <span class="storage-value">{{ totalRecords }} 条</span>
        </div>
        <div class="storage-hint">数据保存在浏览器本地 IndexedDB 中。清除浏览器数据会导致丢失，建议定期导出备份。</div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">数据备份</div>
      <div class="action-card glass-card">
        <button class="action-btn" @click="exportData">
          <div class="action-left">
            <span class="action-icon export-icon">⇩</span>
            <div>
              <span class="action-name">数据导出</span>
              <span class="action-desc">导出所有记账数据到本地文件</span>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="action-btn" @click="importData">
          <div class="action-left">
            <span class="action-icon import-icon">⇧</span>
            <div>
              <span class="action-name">数据导入</span>
              <span class="action-desc">从备份文件恢复记账数据</span>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </section>

    <section class="section">
      <button class="danger-btn glass-card" @click="clearAll">
        <span>清除所有数据</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </section>
  </div>
</template>

<style scoped>
.profile-view {
  min-height: 100%;
  padding: 0 22px 24px;
}

.page-heading {
  padding-left: 2px;
  padding-right: 2px;
}

.section {
  margin-bottom: 20px;
  animation: fadeInUp 0.4s ease both;
}

.section:nth-child(3) {
  animation-delay: 0.05s;
}

.section:nth-child(4) {
  animation-delay: 0.1s;
}

.section-title {
  color: #7883a8;
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 10px;
  padding-left: 2px;
}

.storage-card {
  padding: 18px 20px;
  border-radius: var(--radius-xl);
}

.storage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 0;
}

.storage-row + .storage-row {
  border-top: 1px solid rgba(137, 151, 196, 0.16);
}

.storage-label {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 700;
}

.storage-value {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
}

.storage-hint {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  color: var(--text-secondary);
  background: rgba(238, 242, 251, 0.72);
  font-size: 13px;
  font-weight: 600;
}

.action-card {
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px 18px;
  transition: background 0.18s ease;
}

.action-btn + .action-btn {
  border-top: 1px solid rgba(137, 151, 196, 0.16);
}

.action-btn:active {
  background: rgba(238, 242, 251, 0.5);
}

.action-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.action-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  font-size: 24px;
  font-weight: 800;
}

.export-icon {
  color: var(--accent);
  background: #eaf0ff;
}

.import-icon {
  color: var(--green);
  background: #e8f7ef;
}

.action-name {
  display: block;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
  text-align: left;
}

.action-desc {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  margin-top: 3px;
  text-align: left;
}

.action-btn > svg {
  color: #b3bdd7;
}

.danger-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px 18px;
  border-radius: var(--radius-xl);
  color: var(--danger);
  font-size: 15px;
  font-weight: 800;
}
</style>
