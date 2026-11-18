<template>
  <div class="editor-toolbar">
    <div class="sticker-tray">
      <button
        v-for="sticker in stickers"
        :key="sticker.id"
        class="sticker-item"
        @click="$emit('add-sticker', sticker.url)"
      >
        <img :src="sticker.url" :alt="sticker.label" />
      </button>
    </div>

    <div class="action-row">
      <button class="tool-btn" @click="$emit('trigger-upload')">
        📷 Photo
      </button>
      <button class="tool-btn" @click="openTextModal">
        ✏️ Add Text
      </button>
      <button class="tool-btn" @click="$emit('reset')">
        ↺ Reset
      </button>
      <button class="export-btn" @click="$emit('export')">
        Save & Share
      </button>
    </div>

    <div v-if="showTextModal" class="text-modal-backdrop" @click.self="closeTextModal">
      <div class="text-modal-card">
        <input
          ref="textInputRef"
          v-model="draftText"
          type="text"
          maxlength="24"
          placeholder="Enter your message..."
          @keyup.enter="confirmText"
        />
        <div class="modal-actions">
          <button class="btn-cancel" @click="closeTextModal">Cancel</button>
          <button class="btn-confirm" @click="confirmText">Add</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

defineProps<{
  stickers: Array<{ id: string; label: string; url: string }>;
}>();

const emit = defineEmits<{
  (e: 'add-sticker', url: string): void;
  (e: 'add-text', text: string): void;
  (e: 'trigger-upload'): void;
  (e: 'reset'): void;
  (e: 'export'): void;
}>();

const showTextModal = ref(false);
const draftText = ref('');
const textInputRef = ref<HTMLInputElement | null>(null);

const openTextModal = async () => {
  draftText.value = '';
  showTextModal.value = true;
  await nextTick();
  textInputRef.value?.focus();
};

const closeTextModal = () => {
  showTextModal.value = false;
};

const confirmText = () => {
  if (draftText.value.trim()) {
    emit('add-text', draftText.value.trim());
  }
  closeTextModal();
};
</script>

<style scoped>
.editor-toolbar {
  width: 100%;
  background: rgba(24, 24, 28, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sticker-tray {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.sticker-tray::-webkit-scrollbar {
  display: none;
}
.sticker-item {
  flex: 0 0 54px;
  height: 54px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sticker-item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.action-row {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}
.tool-btn {
  flex: 1;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}
.export-btn {
  flex: 1.4;
  padding: 10px 12px;
  background: linear-gradient(90deg, #ff6a00, #ee0979);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}
.text-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.text-modal-card {
  width: 100%;
  max-width: 320px;
  background: #1e1e24;
  padding: 16px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.text-modal-card input {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: #121216;
  color: #ffffff;
  font-size: 16px;
}
.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.btn-cancel, .btn-confirm {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
}
.btn-cancel { background: rgba(255, 255, 255, 0.1); color: #ccc; }
.btn-confirm { background: #ee0979; color: #fff; font-weight: 600; }
</style>
