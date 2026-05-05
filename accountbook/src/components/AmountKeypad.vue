<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const keys = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫']
]

function handleKey(key) {
  let val = props.modelValue

  if (key === '⌫') {
    emit('update:modelValue', val.slice(0, -1))
    return
  }

  if (key === '.') {
    if (val.includes('.')) return
    if (val === '') {
      emit('update:modelValue', '0.')
      return
    }
  }

  if (val.includes('.')) {
    const decimals = val.split('.')[1]
    if (decimals && decimals.length >= 2) return
  }

  if (val === '0' && key !== '.' && !val.includes('.')) {
    val = ''
  }

  emit('update:modelValue', val + key)
}
</script>

<template>
  <div class="keypad">
    <div class="amount-display">
      <span class="currency">¥</span>
      <span class="amount" :class="{ empty: !modelValue }">{{ modelValue || '0.00' }}</span>
    </div>
    <div class="keys-grid">
      <template v-for="(row, ri) in keys" :key="ri">
        <button v-for="key in row" :key="key" class="key-btn" :class="{ backspace: key === '⌫' }" @click="handleKey(key)">
          {{ key }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.keypad {
  padding: 0 16px;
}

.amount-display {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 5px;
  padding: 20px 8px 16px;
}

.currency {
  color: var(--text-muted);
  font-size: 22px;
  font-weight: 700;
}

.amount {
  min-width: 90px;
  color: var(--text-primary);
  font-size: 42px;
  font-weight: 800;
  text-align: right;
}

.amount.empty {
  color: var(--text-muted);
  opacity: 0.46;
}

.keys-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.key-btn {
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--shadow-sm);
  font-size: 21px;
  font-weight: 800;
  transition: transform 0.12s ease, background 0.12s ease;
}

.key-btn:active {
  transform: scale(0.95);
  background: #eef2fb;
}

.key-btn.backspace {
  color: var(--text-muted);
}
</style>
