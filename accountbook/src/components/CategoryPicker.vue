<script setup>
import { getAllCategories } from '../data/categories.js'

defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue'])

const categories = getAllCategories()
</script>

<template>
  <div class="category-picker">
    <button
      v-for="cat in categories"
      :key="cat.key"
      class="cat-btn"
      :class="{ active: modelValue === cat.key }"
      @click="emit('update:modelValue', cat.key)"
    >
      <span class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</span>
      <span class="cat-name">{{ cat.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.category-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 16px;
}

.cat-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 12px 4px 10px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 2px solid transparent;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.cat-btn.active {
  border-color: var(--accent);
  background: var(--accent-dim);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.cat-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border-radius: 12px;
}

.cat-name {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.cat-btn.active .cat-name {
  color: var(--accent);
  font-weight: 600;
}
</style>
