<template>
  <button
    class="audio-toggle"
    :class="{ spinning: isPlaying && !isMuted }"
    aria-label="Toggle Background Music"
    @click.stop="toggleMute"
  >
    <span v-if="!isMuted">🎵</span>
    <span v-else class="muted-icon">🔇</span>
  </button>
</template>

<script setup lang="ts">
import { useAudio } from '../composables/useAudio';

const props = defineProps<{
  audioUrl: string;
}>();

const { isPlaying, isMuted, toggleMute } = useAudio(props.audioUrl);
</script>

<style scoped>
.audio-toggle {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  right: 16px;
  z-index: 500;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #ffffff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.spinning {
  animation: spin 4s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
