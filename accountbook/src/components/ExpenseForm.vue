<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useExpenseStore } from '../stores/expense.js'
import AmountKeypad from './AmountKeypad.vue'
import { getAllCategories, addCustomCategory } from '../data/categories.js'
import { getLocalDateString } from '../utils/calendar.js'

const router = useRouter()
const route = useRoute()
const store = useExpenseStore()

const isEdit = computed(() => !!route.params.id)
const editId = computed(() => isEdit.value ? Number(route.params.id) : null)

const categories = ref(getAllCategories())
const selectedCategory = ref('')
const amount = ref('')
const expectedAmount = ref('')
const paymentMethod = ref(localStorage.getItem('lastPaymentMethod') || 'credit')
const entryMode = ref('expense')
const savingReason = ref('coupon')
const savingStep = ref('expected')
const showSheet = ref(false)
const showAddCategory = ref(false)
const newCategoryName = ref('')
const formError = ref('')
const isSubmitting = ref(false)

const savingReasons = [
  { key: 'coupon', name: '用了优惠券' },
  { key: 'skip', name: '不买了' },
  { key: 'walk', name: '走路/替代' },
  { key: 'discount', name: '折扣/低价' }
]

if (isEdit.value) {
  const expense = store.expenses.find(e => e.id === editId.value)
  if (expense) {
    selectedCategory.value = expense.category
    amount.value = String(expense.amount)
    expectedAmount.value = expense.expectedAmount ? String(expense.expectedAmount) : ''
    paymentMethod.value = expense.paymentMethod
    entryMode.value = expense.savingAmount ? 'saving' : 'expense'
    savingReason.value = expense.savingReason || 'coupon'
    savingStep.value = expense.savingAmount ? 'actual' : 'expected'
    showSheet.value = true
  }
}

function selectCategory(cat) {
  selectedCategory.value = cat
  savingStep.value = 'expected'
  formError.value = ''
  showSheet.value = true
}

function setEntryMode(mode) {
  entryMode.value = mode
  savingStep.value = 'expected'
  formError.value = ''
}

function setPaymentMethod(method) {
  paymentMethod.value = method
  localStorage.setItem('lastPaymentMethod', method)
}

function closeSheet() {
  showSheet.value = false
  formError.value = ''
  if (!isEdit.value) {
    selectedCategory.value = ''
    amount.value = ''
    expectedAmount.value = ''
    paymentMethod.value = localStorage.getItem('lastPaymentMethod') || 'credit'
    entryMode.value = 'expense'
    savingReason.value = 'coupon'
    savingStep.value = 'expected'
  }
}

function openAddCategory() {
  newCategoryName.value = ''
  showAddCategory.value = true
}

function confirmAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  addCustomCategory(name)
  categories.value = getAllCategories()
  showAddCategory.value = false
  newCategoryName.value = ''
}

function nextSavingStep() {
  const expected = parseFloat(expectedAmount.value)
  if (Number.isNaN(expected) || expected <= 0) {
    formError.value = '请先输入大于 0 的应花金额'
    return
  }
  formError.value = ''
  savingStep.value = 'actual'
}

async function save() {
  if (isSubmitting.value) return
  const num = parseFloat(amount.value)
  const expected = parseFloat(expectedAmount.value)
  const isSaving = entryMode.value === 'saving'
  formError.value = ''
  if (!selectedCategory.value || Number.isNaN(num) || num < 0) {
    formError.value = '请先选择类型并输入金额'
    return
  }
  if (!isSaving && num <= 0) {
    formError.value = '支出金额需要大于 0'
    return
  }
  if (isSaving && Number.isNaN(expected)) {
    formError.value = '请先输入应花金额'
    return
  }
  if (isSaving && expected <= num) {
    formError.value = `实际花了 ¥${num.toFixed(2)}，没有低于应花 ¥${expected.toFixed(2)}，不能记录为省钱支出`
    return
  }
  isSubmitting.value = true
  localStorage.setItem('lastPaymentMethod', paymentMethod.value)

  const today = getLocalDateString()
  const data = {
    category: selectedCategory.value,
    amount: num,
    paymentMethod: paymentMethod.value,
    date: isEdit.value ? store.expenses.find(e => e.id === editId.value)?.date || today : today,
    expectedAmount: isSaving ? expected : null,
    savingAmount: isSaving ? Number((expected - num).toFixed(2)) : 0,
    savingReason: isSaving ? savingReason.value : '',
    note: ''
  }

  try {
    if (isEdit.value) {
      await store.updateExpense(editId.value, data)
    } else {
      await store.addExpense(data)
    }
    router.back()
  } catch (error) {
    console.error('Save expense failed:', error)
    formError.value = '保存失败，请稍后再试'
    isSubmitting.value = false
  }
}

async function remove() {
  if (isSubmitting.value) return
  if (confirm('确定删除这条记录吗？')) {
    isSubmitting.value = true
    try {
      await store.deleteExpense(editId.value)
      router.back()
    } catch (error) {
      console.error('Delete expense failed:', error)
      formError.value = '删除失败，请稍后再试'
      isSubmitting.value = false
    }
  }
}
</script>

<template>
  <div class="expense-form">
    <div class="form-header">
      <button class="back-btn" aria-label="返回" @click="router.back()">
        <svg width="30" height="30" viewBox="0 0 20 20" fill="none">
          <path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h2>{{ isEdit ? '编辑记录' : '记一笔' }}</h2>
      <button v-if="isEdit" class="delete-btn" :disabled="isSubmitting" @click="remove">删除</button>
      <span v-else class="header-spacer"></span>
    </div>

    <div class="type-toggle glass-card">
      <button class="type-btn" :class="{ active: entryMode === 'expense' }" @click="setEntryMode('expense')">支出</button>
      <button class="type-btn" :class="{ active: entryMode === 'saving' }" @click="setEntryMode('saving')">省钱</button>
    </div>

    <div class="category-grid">
      <button v-for="cat in categories" :key="cat.key" class="cat-item glass-card" :class="{ selected: selectedCategory === cat.key }" @click="selectCategory(cat.key)">
        <span class="cat-icon" :style="{ background: cat.bg, color: cat.color }">
          <span v-if="cat.iconType === 'telecom'" class="telecom-glyph" aria-hidden="true">
            <span v-for="n in 9" :key="n"></span>
          </span>
          <template v-else>{{ cat.icon }}</template>
        </span>
        <span class="cat-name">{{ cat.name }}</span>
      </button>
      <button class="cat-item add-cat" @click="openAddCategory">
        <span class="cat-icon">＋</span>
        <span class="cat-name">添加</span>
      </button>
    </div>

    <transition name="sheet">
      <div v-if="showAddCategory" class="sheet-overlay" @click.self="showAddCategory = false">
        <div class="sheet add-cat-sheet">
          <div class="sheet-header">
            <span class="sheet-title">新增类型</span>
            <button class="sheet-close" aria-label="关闭" @click="showAddCategory = false">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <input v-model="newCategoryName" class="cat-input" type="text" placeholder="输入类型名称" maxlength="6" @keyup.enter="confirmAddCategory" />
          <button class="save-btn" @click="confirmAddCategory">确定添加</button>
        </div>
      </div>
    </transition>

    <transition name="sheet">
      <div v-if="showSheet" class="sheet-overlay" @click.self="closeSheet">
        <div class="sheet">
          <div class="sheet-header">
            <span class="sheet-title">{{ entryMode === 'saving' ? '记录省钱支出' : '选择支付方式' }}</span>
            <button class="sheet-close" aria-label="关闭" @click="closeSheet">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div v-if="entryMode === 'expense' || savingStep === 'actual'" class="payment-row">
            <button class="payment-btn" :class="{ active: paymentMethod === 'credit' }" @click="setPaymentMethod('credit')">信用卡</button>
            <button class="payment-btn" :class="{ active: paymentMethod === 'cash' }" @click="setPaymentMethod('cash')">现金</button>
          </div>

          <div v-if="entryMode === 'saving'" class="saving-panel">
            <div class="step-row">
              <span class="step-pill" :class="{ active: savingStep === 'expected' }">1 应花多少</span>
              <span class="step-line"></span>
              <span class="step-pill" :class="{ active: savingStep === 'actual' }">2 实际花了</span>
            </div>
            <div v-if="savingStep === 'actual'" class="saving-preview">应花 ¥{{ Number(expectedAmount || 0).toFixed(2) }}</div>
            <div v-if="savingStep === 'expected'" class="reason-row">
              <button v-for="reason in savingReasons" :key="reason.key" class="reason-btn" :class="{ active: savingReason === reason.key }" @click="savingReason = reason.key">
                {{ reason.name }}
              </button>
            </div>
          </div>

          <div v-if="entryMode === 'saving'" class="actual-label">{{ savingStep === 'expected' ? '应花多少' : '实际花了' }}</div>
          <p v-if="formError" class="form-error">{{ formError }}</p>

          <AmountKeypad v-if="entryMode === 'saving' && savingStep === 'expected'" v-model="expectedAmount" />
          <AmountKeypad v-else v-model="amount" />

          <div class="sheet-footer">
            <button v-if="entryMode === 'saving' && savingStep === 'expected'" class="save-btn" @click="nextSavingStep">下一步：实际花了</button>
            <button v-else class="save-btn" :disabled="isSubmitting" @click="save">{{ isSubmitting ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.expense-form {
  min-height: 100%;
  padding-bottom: 24px;
  background:
    radial-gradient(circle at 8% 10%, rgba(159, 183, 255, 0.42), transparent 29%),
    radial-gradient(circle at 100% 5%, rgba(255, 219, 142, 0.42), transparent 28%),
    radial-gradient(circle at 45% 45%, rgba(187, 207, 255, 0.34), transparent 30%),
    linear-gradient(180deg, #f9fbff 0%, #f5f7ff 45%, #ffffff 100%);
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 23px 22px 15px;
}

.form-header h2 {
  color: var(--text-primary);
  font-size: 25px;
  font-weight: 800;
}

.back-btn,
.header-spacer {
  width: 48px;
  height: 48px;
}

.back-btn {
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--shadow-sm);
}

.delete-btn {
  color: var(--danger);
  font-size: 14px;
  font-weight: 800;
  padding: 8px 12px;
  border-radius: 14px;
  background: var(--danger-light);
}

.delete-btn:disabled,
.save-btn:disabled {
  cursor: default;
  opacity: 0.72;
  transform: none;
}

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  height: 56px;
  margin: 19px 22px 29px;
  padding: 5px;
  border-radius: 27px;
}

.type-btn {
  border-radius: 22px;
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 800;
}

.type-btn.active {
  color: #fff;
  background: linear-gradient(135deg, #747cf0, #676deb);
  box-shadow: 0 10px 20px rgba(93, 115, 255, 0.22);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 0 22px;
}

.cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  min-width: 0;
  min-height: 96px;
  padding: 12px 4px 10px;
  border-radius: 20px;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.cat-item.selected {
  border-color: rgba(93, 115, 255, 0.5);
  box-shadow: 0 0 0 2px var(--accent), var(--shadow-md);
}

.cat-item:active {
  transform: scale(0.95);
}

.cat-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  font-size: 23px;
}

.telecom-glyph {
  width: 28px;
  height: 38px;
  display: grid;
  grid-template-columns: repeat(3, 5px);
  grid-auto-rows: 5px;
  gap: 4px;
  justify-content: center;
  align-content: center;
  border-radius: 4px;
  background: #5141bf;
  box-shadow: 0 -4px 0 rgba(255, 255, 255, 0.16) inset;
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

.cat-name {
  max-width: 100%;
  color: #666e8e;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-item.selected .cat-name {
  color: var(--accent);
}

.cat-item.add-cat {
  border: 1px dashed rgba(137, 151, 196, 0.45);
  background: rgba(255, 255, 255, 0.38);
  box-shadow: none;
}

.cat-item.add-cat .cat-icon {
  color: #9aa5c2;
  background: linear-gradient(135deg, #eef2fa, #f8faff);
}

.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 24, 58, 0.28);
}

.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 0 16px calc(30px + env(safe-area-inset-bottom, 0px));
  border-radius: 30px 30px 0 0;
  background: #f8faff;
  box-shadow: 0 -18px 46px rgba(44, 61, 118, 0.18);
}

.add-cat-sheet {
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

.sheet-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 4px 14px;
  background: #f8faff;
}

.sheet-title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 800;
}

.sheet-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text-muted);
  background: #eef2fb;
}

.cat-input {
  width: 100%;
  margin: 8px 0 16px;
  padding: 15px 16px;
  border: 1px solid rgba(137, 151, 196, 0.2);
  border-radius: 18px;
  color: var(--text-primary);
  background: #fff;
  font-size: 16px;
}

.cat-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-dim);
}

.payment-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 4px 12px;
}

.payment-btn,
.reason-btn {
  padding: 12px;
  border-radius: 17px;
  color: var(--text-secondary);
  background: #fff;
  box-shadow: var(--shadow-sm);
  font-size: 14px;
  font-weight: 800;
}

.payment-btn.active {
  color: var(--accent);
  background: var(--accent-dim);
  box-shadow: inset 0 0 0 1px rgba(93, 115, 255, 0.24);
}

.saving-panel {
  margin: 2px 4px 10px;
  padding: 14px;
  border-radius: 22px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-pill {
  padding: 7px 10px;
  border-radius: 999px;
  color: var(--text-muted);
  background: #eef2fb;
  font-size: 12px;
  font-weight: 800;
}

.step-pill.active {
  color: var(--accent);
  background: var(--accent-dim);
}

.step-line {
  flex: 1;
  height: 1px;
  background: rgba(137, 151, 196, 0.18);
}

.saving-preview,
.actual-label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;
}

.saving-preview {
  margin-top: 10px;
}

.actual-label {
  padding: 0 20px;
  margin: 4px 0 0;
}

.form-error {
  margin: 8px 20px 0;
  padding: 10px 12px;
  border-radius: 14px;
  color: var(--danger);
  background: var(--danger-light);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.35;
}

.reason-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 9px;
  margin-top: 12px;
}

.reason-btn {
  box-shadow: none;
  background: #f4f6fc;
}

.reason-btn.active {
  color: var(--green);
  background: var(--green-light);
  box-shadow: inset 0 0 0 1px rgba(40, 164, 99, 0.24);
}

.sheet-footer {
  padding: 14px 4px 0;
}

.save-btn {
  width: 100%;
  padding: 15px;
  border-radius: 19px;
  color: #fff;
  background: linear-gradient(135deg, #7791ff, #4f5df6);
  box-shadow: var(--shadow-float);
  font-size: 16px;
  font-weight: 800;
}

.save-btn:active {
  transform: scale(0.98);
}

.save-btn:disabled:active {
  transform: none;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

@media (max-width: 360px) {
  .category-grid {
    gap: 10px;
    padding: 0 18px;
  }

  .cat-item {
    min-height: 90px;
  }

  .cat-name {
    font-size: 12px;
  }
}
</style>
