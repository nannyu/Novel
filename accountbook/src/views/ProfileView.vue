<script setup>
import { computed, onMounted, ref } from 'vue'
import { useExpenseStore } from '../stores/expense.js'
import db from '../db/index.js'
import { getUserProfile } from '../services/userIdentity.js'
import {
  bindUserId,
  deleteAllCloudExpenses,
  ensureAuthReady,
  fetchCloudExpenses,
  getStorageMode,
  getUserId,
  isCloudConfigured,
  isCloudStorageEnabled,
  resetMigration,
  setStorageMode,
  syncUserProfileToCloud
} from '../services/cloudSync.js'

const store = useExpenseStore()
const userProfile = ref(getUserProfile())
const storageMode = ref(getStorageMode())
const isSyncing = ref(false)
const syncStatus = ref('')

const isDebug = import.meta.env.DEV
const currentUserId = ref(getUserId() || '')
const showBindInput = ref(false)
const bindInputValue = ref('')
const totalRecords = computed(() => store.expenses.length)
const totalDays = computed(() => new Set(store.expenses.map(item => item.date)).size)
const displayName = computed(() => userProfile.value.displayName || 'momo')
const visibleSyncStatus = computed(() => {
  if (store.cloudSyncError) return store.cloudSyncError
  if (!syncStatus.value) return ''
  if (isDebug) return syncStatus.value
  if (syncStatus.value.includes('云端存储')) return '已开启云端存储'
  return syncStatus.value
})
const cloudReady = computed(() => isCloudConfigured())
const storageHint = computed(() => {
  if (storageMode.value === 'cloud') {
    return '当前已开启云端备份。数据以本地为准，新增/编辑/删除会自动同步到云端。换设备可通过「数据导入」恢复。'
  }
  return '数据默认保存在浏览器本地 IndexedDB。清除浏览器数据可能导致丢失，建议开启云端存储。'
})

onMounted(async () => {
  if (isCloudStorageEnabled()) {
    try {
      await ensureAuthReady()
      currentUserId.value = getUserId() || ''
      const name = await syncUserProfileToCloud()
      if (name) userProfile.value.displayName = name
    } catch (error) {
      syncStatus.value = error.message || '用户资料同步失败'
    }
  } else {
    currentUserId.value = getUserId() || ''
  }
})

async function switchStorageMode(mode) {
  if (storageMode.value === mode || isSyncing.value) return

  if (mode === 'cloud') {
    if (!cloudReady.value) {
      alert('请先配置 Supabase 环境变量，再开启云端存储。')
      return
    }

    isSyncing.value = true
    syncStatus.value = '正在同步数据...'
    try {
      resetMigration()
      await ensureAuthReady()
      currentUserId.value = getUserId() || ''
      setStorageMode('cloud')
      storageMode.value = 'cloud'
      const name = await syncUserProfileToCloud()
      if (name) userProfile.value.displayName = name

      // 先从云端拉取已有数据（恢复旧账号数据）
      const cloudExpenses = await fetchCloudExpenses()
      if (cloudExpenses.length > 0) {
        await db.expenses.bulkPut(cloudExpenses)
        syncStatus.value = isDebug ? `从云端恢复了 ${cloudExpenses.length} 条记录` : '正在同步数据...'
      }

      // 再把本地数据推到云端
      const count = await store.syncLocalExpensesToCloud()
      await store.loadExpenses()
      const total = cloudExpenses.length + count
      syncStatus.value = isDebug ? `已开启云端存储（云端恢复 ${cloudExpenses.length} 条，本地同步 ${count} 条）` : '已开启云端存储'
    } catch (error) {
      setStorageMode('local')
      storageMode.value = 'local'
      syncStatus.value = error.message || '云端同步失败'
      alert(syncStatus.value)
    } finally {
      isSyncing.value = false
    }
    return
  }

  setStorageMode('local')
  storageMode.value = 'local'
  syncStatus.value = '已切换为本地存储'
}

function handleBindUserId() {
  const id = bindInputValue.value.trim()
  if (!id) {
    alert('请输入用户 ID')
    return
  }
  if (storageMode.value === 'cloud') {
    alert('请先切换到本地存储，再绑定用户 ID。')
    return
  }
  bindUserId(id)
  currentUserId.value = id
  showBindInput.value = false
  bindInputValue.value = ''
  alert('绑定成功！切换到云端存储后将使用此 ID 同步数据。')
}

function copyUserId() {
  const id = currentUserId.value
  if (!id) return
  navigator.clipboard?.writeText(id).then(() => {
    alert('已复制: ' + id)
  }).catch(() => {
    prompt('请手动复制用户 ID:', id)
  })
}

async function exportData() {
  try {
    const data = await db.expenses.toArray()
    const cleaned = data.map(({ id, date, category, amount, paymentMethod, expectedAmount, savingAmount, savingReason, note, createdAt }) => ({
      id, date, category, amount, paymentMethod, expectedAmount, savingAmount, savingReason, note, createdAt
    }))
    const json = JSON.stringify(cleaned, null, 2)
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

function validateImportRecord(item) {
  if (!item || typeof item !== 'object') return false
  if (typeof item.id !== 'number' || item.id <= 0 || !Number.isInteger(item.id)) return false
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false
  if (typeof item.category !== 'string' || !item.category.trim()) return false
  if (typeof item.amount !== 'number' || item.amount < 0 || !Number.isFinite(item.amount)) return false
  return true
}

async function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      if (!Array.isArray(imported)) {
        alert('文件格式不正确')
        return
      }

      const valid = imported.filter(validateImportRecord)
      const skipped = imported.length - valid.length
      if (valid.length === 0) {
        alert('文件中没有有效的记账记录')
        return
      }

      const existing = await db.expenses.toArray()
      const existingIds = new Set(existing.map(item => item.id))
      const duplicates = valid.filter(item => existingIds.has(item.id))

      let msg = `共 ${imported.length} 条记录，有效 ${valid.length} 条`
      if (skipped > 0) msg += `，跳过 ${skipped} 条无效记录`
      if (duplicates.length > 0) msg += `，其中 ${duplicates.length} 条与现有数据重复将被覆盖`
      msg += '。确定要导入吗？'

      if (!confirm(msg)) return

      await db.expenses.bulkPut(valid)
      await store.loadExpenses()
      if (isCloudStorageEnabled()) {
        await store.syncLocalExpensesToCloud()
        syncStatus.value = isDebug ? '导入数据已同步到云端' : '已开启云端存储'
      }
      alert(`成功导入 ${valid.length} 条记录`)
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
    if (isCloudStorageEnabled()) {
      try {
        await deleteAllCloudExpenses()
        syncStatus.value = '本地和云端数据已清除'
      } catch (error) {
        syncStatus.value = error.message || '云端数据清除失败'
        alert(syncStatus.value)
      }
    }
    alert('数据已清除')
  }
}
</script>

<template>
  <div class="profile-view">
    <header class="page-heading">
      <h2 class="page-title">我的</h2>
    </header>

    <section class="profile-card glass-card">
      <div class="profile-top">
        <div class="avatar" aria-hidden="true">
          <span>m</span>
        </div>
        <div class="profile-name">{{ displayName }}</div>
      </div>
      <div class="profile-stats">
        <div class="stat-item">
          <span class="stat-value">{{ totalDays }}</span>
          <span class="stat-label">记账总天数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ totalRecords }}</span>
          <span class="stat-label">记账总笔数</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">数据存储方式</div>
      <div class="storage-mode-card glass-card">
        <div class="mode-toggle">
          <button class="mode-btn" :class="{ active: storageMode === 'local' }" @click="switchStorageMode('local')">
            本地存储
          </button>
          <button class="mode-btn" :class="{ active: storageMode === 'cloud' }" :disabled="isSyncing" @click="switchStorageMode('cloud')">
            云端存储
          </button>
        </div>
        <div v-if="isDebug" class="cloud-state" :class="{ ready: cloudReady }">
          {{ cloudReady ? 'Supabase 已配置' : 'Supabase 未配置，需填写环境变量后才能开启云端存储' }}
        </div>
        <div class="storage-hint">{{ storageHint }}</div>
        <div v-if="visibleSyncStatus" class="sync-status">
          {{ visibleSyncStatus }}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">用户 ID</div>
      <div class="user-id-card glass-card">
        <div class="user-id-row" @click="copyUserId">
          <span class="user-id-label">当前 ID</span>
          <span class="user-id-value">{{ currentUserId || '未生成' }}</span>
          <span class="user-id-copy">复制</span>
        </div>
        <div class="user-id-hint">换设备时输入此 ID 可恢复云端数据。点击可复制。</div>
        <button v-if="!showBindInput" class="bind-btn" @click="showBindInput = true">绑定已有 ID</button>
        <div v-else class="bind-input-row">
          <input v-model="bindInputValue" class="bind-input" placeholder="输入旧用户 ID" />
          <button class="bind-confirm" @click="handleBindUserId">确定</button>
          <button class="bind-cancel" @click="showBindInput = false; bindInputValue = ''">取消</button>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">数据备份</div>
      <div class="action-card glass-card">
        <button class="action-btn" @click="exportData">
          <div class="action-left">
            <span class="action-icon export-icon">出</span>
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
            <span class="action-icon import-icon">入</span>
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

.profile-card {
  margin-bottom: 20px;
  padding: 15px 18px 16px;
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at 8% 0%, rgba(119, 145, 255, 0.2), transparent 32%),
    radial-gradient(circle at 100% 0%, rgba(40, 164, 99, 0.12), transparent 30%),
    var(--bg-card);
  box-shadow: var(--shadow-md);
  animation: fadeInUp 0.4s ease both;
}

.profile-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  border: 3px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  color: #fff;
  background:
    radial-gradient(circle at 32% 28%, #b8c4ff 0 12%, transparent 13%),
    radial-gradient(circle at 66% 38%, #ffffff 0 8%, transparent 9%),
    linear-gradient(135deg, #6879ff, #40b98f);
  box-shadow: 0 12px 24px rgba(87, 102, 194, 0.22);
}

.avatar span {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #5462da;
  background: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  font-weight: 900;
}

.profile-name {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 900;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.stat-item {
  min-width: 0;
  text-align: center;
}

.stat-value {
  display: block;
  color: var(--text-primary);
  font-size: 24px;
  line-height: 1.05;
  font-weight: 900;
}

.stat-label {
  display: block;
  margin-top: 3px;
  color: rgba(8, 10, 42, 0.58);
  font-size: 12px;
  font-weight: 800;
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

.storage-mode-card {
  padding: 18px 20px;
  border-radius: var(--radius-xl);
}

.mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  padding: 5px;
  border-radius: 21px;
  background: #eef2fb;
}

.mode-btn {
  min-height: 42px;
  border-radius: 17px;
  color: var(--text-secondary);
  font-weight: 800;
}

.mode-btn.active {
  color: #fff;
  background: linear-gradient(135deg, #7791ff, #4f5df6);
  box-shadow: 0 10px 20px rgba(93, 115, 255, 0.2);
}

.mode-btn:disabled {
  opacity: 0.65;
}

.cloud-state {
  margin-top: 12px;
  color: var(--danger);
  font-size: 12px;
  font-weight: 800;
}

.cloud-state.ready {
  color: var(--green);
}

.storage-hint,
.sync-status {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  color: var(--text-secondary);
  background: rgba(238, 242, 251, 0.72);
  font-size: 13px;
  font-weight: 600;
}

.sync-status {
  color: var(--accent);
  background: var(--accent-dim);
  font-weight: 800;
}

.action-card {
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.user-id-card {
  padding: 16px 18px;
  border-radius: var(--radius-xl);
}

.user-id-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 0;
}

.user-id-label {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-id-value {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.user-id-copy {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-id-hint {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
  margin-bottom: 12px;
}

.bind-btn {
  width: 100%;
  min-height: 40px;
  border-radius: 12px;
  color: var(--accent);
  background: var(--accent-dim);
  font-size: 14px;
  font-weight: 700;
}

.bind-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.bind-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border: 2px solid rgba(119, 145, 255, 0.3);
  border-radius: 12px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
}

.bind-input:focus {
  border-color: var(--accent);
}

.bind-confirm {
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #7791ff, #4f5df6);
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.bind-cancel {
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
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
  font-size: 16px;
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

@media (max-width: 360px) {
  .profile-view {
    padding-left: 18px;
    padding-right: 18px;
  }

  .profile-card {
    padding: 14px 16px 15px;
  }

  .avatar {
    width: 56px;
    height: 56px;
  }

  .profile-name {
    font-size: 21px;
  }
}
</style>
