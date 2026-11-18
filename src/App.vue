<template>
  <main class="h5-container">
    <Preloader :progress="progress" :is-loaded="isLoaded" />
    <AudioToggle audio-url="/assets/audio/bgm.mp3" />

    <Swiper
      direction="vertical"
      :slides-per-view="1"
      :speed="600"
      class="full-swiper"
      @swiper="onSwiperInit"
      @slideChange="onSlideChange"
    >
      <SwiperSlide class="slide slide-intro">
        <h1>Welcome to the Campaign</h1>
        <p>Swipe up to create your custom poster</p>
        <span class="swipe-hint">↑ Swipe Up</span>
      </SwiperSlide>

      <SwiperSlide class="slide slide-story">
        <h2>Your Year in Review</h2>
        <p v-if="userNickname">Ready to shine, {{ userNickname }}?</p>
        <p v-else>Personalize your photo with campaign frames</p>
        <span class="swipe-hint">↑ Swipe Up</span>
      </SwiperSlide>

      <SwiperSlide class="slide slide-generator">
        <PhotoFrameGenerator
          :frames="campaignFrames"
          :stickers="campaignStickers"
          share-url="https://campaign.example.com/?ref=poster"
          @gesture-state="toggleSwiperLock"
        />
      </SwiperSlide>
    </Swiper>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import Preloader from './components/Preloader.vue';
import AudioToggle from './components/AudioToggle.vue';
import PhotoFrameGenerator from './components/PhotoFrameGenerator.vue';
import { usePreloader } from './composables/usePreloader';
import { useNativeBridge } from './composables/useNativeBridge';

const shareUrl = 'https://h5-campaign-app.motkwok.workers.dev';

const campaignFrames = [
  { id: 'f1', label: 'Classic', url: '/assets/frames/frame-classic.png' },
  { id: 'f2', label: 'Neon', url: '/assets/frames/frame-neon.png' },
  { id: 'f3', label: 'Polaroid', url: '/assets/frames/frame-polaroid.png' },
];

const campaignStickers = [
  { id: 's1', label: 'Star', url: '/assets/stickers/star.png' },
  { id: 's2', label: 'Badge', url: '/assets/stickers/badge.png' },
  { id: 's3', label: 'Sparkle', url: '/assets/stickers/sparkle.png' },
];

const criticalAssets = [
  ...campaignFrames.map((f) => f.url),
  ...campaignStickers.map((s) => s.url),
];

const { progress, isLoaded, startPreload } = usePreloader(criticalAssets);
const { isNativeEnv, getUserInfo } = useNativeBridge();
const swiperInstance = ref<SwiperInstance | null>(null);
const userNickname = ref('');

const onSwiperInit = (swiper: SwiperInstance) => {
  swiperInstance.value = swiper;
};

const toggleSwiperLock = (isInteracting: boolean) => {
  if (swiperInstance.value) {
    swiperInstance.value.allowTouchMove = !isInteracting;
  }
};

const onSlideChange = (swiper: SwiperInstance) => {
  console.log('Active Slide:', swiper.activeIndex);
};

onMounted(async () => {
  startPreload();
  if (isNativeEnv.value) {
    try {
      const user = await getUserInfo();
      userNickname.value = user.nickname;
    } catch (err) {
      console.error('Failed to fetch native user info', err);
    }
  }
});
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
html, body, .h5-container, .full-swiper {
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  touch-action: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #ffffff;
}
.slide-intro {
  background: linear-gradient(135deg, #1e1e2f, #3a1c71);
  gap: 12px;
}
.slide-story {
  background: linear-gradient(135deg, #3a1c71, #d76d77);
  gap: 12px;
}
.slide-generator {
  background: #121212;
}
.swipe-hint {
  position: absolute;
  bottom: calc(24px + env(safe-area-inset-bottom));
  font-size: 13px;
  opacity: 0.75;
}
</style>
