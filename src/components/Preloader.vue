<template>
  <Transition name="fade">
    <div v-if="!isLoaded" class="preloader-overlay">
      <div class="loader-content">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <p class="progress-text">Loading Experience... {{ progress }}%</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  progress: number;
  isLoaded: boolean;
}>();
</script>

<style scoped>
.preloader-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #121212;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}
.loader-content {
  width: 70%;
  max-width: 280px;
  text-align: center;
}
.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 12px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6a00, #ee0979);
  transition: width 0.2s ease-out;
}
.progress-text {
  font-size: 13px;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.8);
}
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-leave-to {
  opacity: 0;
}
</style>
