<template>
  <div class="frame-generator">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden-input"
      @change="handleFileUpload"
    />

    <div class="canvas-stage">
      <canvas
        ref="canvasRef"
        width="750"
        height="1100"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      ></canvas>
      <p class="gesture-hint">Drag • Pinch to zoom • Twist to rotate</p>
    </div>

    <div class="frame-selector">
      <button
        v-for="frame in frames"
        :key="frame.id"
        :class="['frame-thumb', { active: selectedFrameId === frame.id }]"
        @click="selectFrame(frame.id)"
      >
        <img :src="frame.thumbUrl || frame.url" :alt="frame.label" />
        <span>{{ frame.label }}</span>
      </button>
    </div>

    <EditorToolbar
      :stickers="stickers"
      @add-sticker="addStickerOverlay"
      @add-text="addTextOverlay"
      @trigger-upload="triggerUpload"
      @reset="resetTransform"
      @export="exportAndShare"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import QRCode from 'qrcode';
import EditorToolbar from './EditorToolbar.vue';
import { useNativeBridge } from '../composables/useNativeBridge';
import { loadNormalizedImage } from '../utils/imageLoader';
import { loadCanvasFont } from '../utils/fontLoader';
import { useAnalytics } from '../composables/useAnalytics';


export interface FrameTemplate {
  id: string;
  label: string;
  url: string;
  thumbUrl?: string;
}

interface CanvasOverlay {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  imgElement?: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

const props = defineProps<{
  frames: FrameTemplate[];
  stickers: Array<{ id: string; label: string; url: string }>;
  shareUrl: string;
}>();

const emit = defineEmits<{
  (e: 'gesture-state', isInteracting: boolean): void;
}>();

const { isNativeEnv, shareImage, saveImageToAlbum } = useNativeBridge();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const hasPhoto = ref(false);
const userImage = ref<HTMLImageElement | null>(null);
const frameImage = ref<HTMLImageElement | null>(null);

const selectedFrameId = ref(props.frames[0]?.id || '');
const frameCache = new Map<string, HTMLImageElement>();

const overlays = ref<CanvasOverlay[]>([]);
const activeOverlayId = ref<string | null>(null);

const transform = reactive({
  centerX: 375,
  centerY: 550,
  scale: 1,
  baseScale: 1,
  rotation: 0,
});

let isDragging = false;
let initialPinchDistance = 0;
let initialScale = 1;
let initialAngle = 0;
let initialRotation = 0;
let lastTouch = { x: 0, y: 0 };

const triggerUpload = () => fileInput.value?.click();

const loadFrameAsset = (frame: FrameTemplate): Promise<HTMLImageElement> => {
  if (frameCache.has(frame.id)) {
    return Promise.resolve(frameCache.get(frame.id)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      frameCache.set(frame.id, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = frame.url;
  });
};


// 2. Track frame template switches
const selectFrame = async (frameId: string) => {
  const target = props.frames.find((f) => f.id === frameId);
  if (!target) return;

  selectedFrameId.value = frameId;
  try {
    frameImage.value = await loadFrameAsset(target);
  } catch (err) {
    console.warn('Frame image failed to load:', target.url);
  }
  renderCanvas();
  track('frame_selected', { frameId });
};

const { track } = useAnalytics('/api/analytics/track');

// 1. Track successful EXIF-normalized photo uploads
const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    userImage.value = await loadNormalizedImage(file);
    hasPhoto.value = true;
    resetTransform();
    track('photo_uploaded', {
      fileSizeKb: Math.round(file.size / 1024),
    });
  } catch (err) {
    console.error('Failed to process uploaded photo', err);
  } finally {
    (event.target as HTMLInputElement).value = '';
  }
};

const resetTransform = () => {
  const canvas = canvasRef.value;
  const img = userImage.value;
  if (!canvas) return;

  if (img) {
    transform.baseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
    transform.scale = 1;
    transform.rotation = 0;
    transform.centerX = canvas.width / 2;
    transform.centerY = canvas.height / 2;
  }
  overlays.value = [];
  activeOverlayId.value = null;
  renderCanvas();
};

const addTextOverlay = (text: string) => {
  if (!text.trim()) return;
  const id = `txt_${Date.now()}`;
  overlays.value.push({
    id,
    type: 'text',
    content: text,
    x: 375,
    y: 880,
    scale: 1,
    rotation: 0,
  });
  activeOverlayId.value = id;
  renderCanvas();
  track('text_added', { length: text.trim().length });
};

// 3. Track sticker & custom text additions
const addStickerOverlay = (stickerUrl: string) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const id = `stk_${Date.now()}`;
    overlays.value.push({
      id,
      type: 'sticker',
      content: stickerUrl,
      imgElement: img,
      x: 375,
      y: 550,
      scale: 1,
      rotation: 0,
    });
    activeOverlayId.value = id;
    renderCanvas();
  };
  img.src = stickerUrl;
  track('sticker_added', { stickerUrl });
};

const getDistance = (t1: Touch, t2: Touch) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
const getAngle = (t1: Touch, t2: Touch) => Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

const getCanvasCoords = (touch: Touch) => {
  const rect = canvasRef.value!.getBoundingClientRect();
  const ratio = canvasRef.value!.width / rect.width;
  return {
    x: (touch.clientX - rect.left) * ratio,
    y: (touch.clientY - rect.top) * ratio,
  };
};

const getOverlayBounds = (item: CanvasOverlay) => {
  if (item.type === 'sticker' && item.imgElement) {
    const w = 180;
    const h = (item.imgElement.height / item.imgElement.width) * w;
    return { w, h };
  }
  return { w: Math.max(item.content.length * 26, 120), h: 60 };
};

const onTouchStart = (e: TouchEvent) => {
  if (!hasPhoto.value && overlays.value.length === 0) return;
  emit('gesture-state', true);

  if (e.touches.length === 1) {
    const pt = getCanvasCoords(e.touches[0]);

    if (activeOverlayId.value) {
      const activeItem = overlays.value.find((o) => o.id === activeOverlayId.value);
      if (activeItem) {
        const { w, h } = getOverlayBounds(activeItem);
        const localX = (w / 2) * activeItem.scale;
        const localY = (-h / 2) * activeItem.scale;
        const handleX = activeItem.x + localX * Math.cos(activeItem.rotation) - localY * Math.sin(activeItem.rotation);
        const handleY = activeItem.y + localX * Math.sin(activeItem.rotation) + localY * Math.cos(activeItem.rotation);

        if (Math.hypot(pt.x - handleX, pt.y - handleY) < 40) {
          overlays.value = overlays.value.filter((o) => o.id !== activeItem.id);
          activeOverlayId.value = null;
          renderCanvas();
          return;
        }
      }
    }

    let hitId: string | null = null;
    for (let i = overlays.value.length - 1; i >= 0; i--) {
      const item = overlays.value[i];
      const { w, h } = getOverlayBounds(item);
      const radius = (Math.max(w, h) * item.scale) / 2 + 20;
      if (Math.hypot(pt.x - item.x, pt.y - item.y) <= radius) {
        hitId = item.id;
        overlays.value.splice(i, 1);
        overlays.value.push(item);
        break;
      }
    }

    activeOverlayId.value = hitId;
    isDragging = true;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    renderCanvas();
  } else if (e.touches.length === 2) {
    isDragging = false;
    initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
    initialAngle = getAngle(e.touches[0], e.touches[1]);

    const activeItem = overlays.value.find((o) => o.id === activeOverlayId.value);
    if (activeItem) {
      initialScale = activeItem.scale;
      initialRotation = activeItem.rotation;
    } else {
      initialScale = transform.scale;
      initialRotation = transform.rotation;
    }
  }
};

const onTouchMove = (e: TouchEvent) => {
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  const ratio = canvasRef.value.width / rect.width;
  const activeItem = overlays.value.find((o) => o.id === activeOverlayId.value);

  if (e.touches.length === 1 && isDragging) {
    const dx = (e.touches[0].clientX - lastTouch.x) * ratio;
    const dy = (e.touches[0].clientY - lastTouch.y) * ratio;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    if (activeItem) {
      activeItem.x += dx;
      activeItem.y += dy;
    } else if (userImage.value) {
      transform.centerX += dx;
      transform.centerY += dy;
    }
    renderCanvas();
  } else if (e.touches.length === 2 && initialPinchDistance > 0) {
    const pinchRatio = getDistance(e.touches[0], e.touches[1]) / initialPinchDistance;
    const angleDelta = getAngle(e.touches[0], e.touches[1]) - initialAngle;

    if (activeItem) {
      activeItem.scale = Math.min(Math.max(initialScale * pinchRatio, 0.4), 3.5);
      activeItem.rotation = initialRotation + angleDelta;
    } else if (userImage.value) {
      transform.scale = Math.min(Math.max(initialScale * pinchRatio, 0.4), 4);
      transform.rotation = initialRotation + angleDelta;
    }
    renderCanvas();
  }
};

const onTouchEnd = (e: TouchEvent) => {
  if (e.touches.length === 0) {
    isDragging = false;
    initialPinchDistance = 0;
    emit('gesture-state', false);
  } else if (e.touches.length === 1) {
    isDragging = true;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
};

const renderCanvas = (showHandles = true) => {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (userImage.value) {
    const img = userImage.value;
    const s = transform.baseScale * transform.scale;
    ctx.save();
    ctx.translate(transform.centerX, transform.centerY);
    ctx.rotate(transform.rotation);
    ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1e1e26';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tap "Photo" below to upload', canvas.width / 2, canvas.height / 2);
  }

  if (frameImage.value) {
    ctx.drawImage(frameImage.value, 0, 0, canvas.width, canvas.height);
  }

  for (const item of overlays.value) {
    const { w, h } = getOverlayBounds(item);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    ctx.scale(item.scale, item.scale);

    if (item.type === 'sticker' && item.imgElement) {
      ctx.drawImage(item.imgElement, -w / 2, -h / 2, w, h);
    } else if (item.type === 'text') {
      ctx.font = 'bold 44px "CampaignDisplay", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(item.content, 0, 0);
      ctx.fillText(item.content, 0, 0);
    }

    if (showHandles && item.id === activeOverlayId.value) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 / item.scale;
      ctx.setLineDash([8 / item.scale, 6 / item.scale]);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([]);

      const btnRadius = 18 / item.scale;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(w / 2, -h / 2, btnRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 / item.scale;
      const offset = 7 / item.scale;
      ctx.beginPath();
      ctx.moveTo(w / 2 - offset, -h / 2 - offset);
      ctx.lineTo(w / 2 + offset, -h / 2 + offset);
      ctx.moveTo(w / 2 + offset, -h / 2 - offset);
      ctx.lineTo(w / 2 - offset, -h / 2 + offset);
      ctx.stroke();
    }

    ctx.restore();
  }
};

const generateQrBadge = async (campaignUrl: string, size = 110): Promise<HTMLCanvasElement> => {
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, campaignUrl, {
    width: size,
    margin: 1,
    color: {
      dark: '#121212',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
  return qrCanvas;
};

// 4. Track final Save & Share conversion
const exportAndShare = async () => {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  track('poster_exported', {
    frameId: selectedFrameId.value,
    overlayCount: overlays.value.length,
    hasUserPhoto: hasPhoto.value,
  });

  renderCanvas(false);

  try {
    const qrSize = 110;
    const padding = 32;
    const qrCanvas = await generateQrBadge(props.shareUrl, qrSize);

    const x = canvas.width - qrSize - padding;
    const y = canvas.height - qrSize - padding;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x - 8, y - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();
    ctx.drawImage(qrCanvas, x, y, qrSize, qrSize);
    ctx.restore();
  } catch (err) {
    console.warn('QR code generation skipped:', err);
  }

  const base64Data = canvas.toDataURL('image/jpeg', 0.9);
  renderCanvas(true);

  if (isNativeEnv.value) {
    await saveImageToAlbum(base64Data);
    await shareImage(base64Data, 'Check out my campaign poster!');
  } else {
    const link = document.createElement('a');
    link.download = 'campaign-poster.jpg';
    link.href = base64Data;
    link.click();
  }
};

onMounted(async () => {
  await loadCanvasFont('CampaignDisplay', '/assets/fonts/CampaignDisplay-Bold.woff2');
  if (props.frames.length > 0) {
    await selectFrame(props.frames[0].id);
  } else {
    renderCanvas();
  }
});
</script>

<style scoped>
.frame-generator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding-top: calc(16px + env(safe-area-inset-top));
}
.hidden-input {
  display: none;
}
.canvas-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
}
.canvas-stage canvas {
  max-height: 56dvh;
  width: auto;
  aspect-ratio: 750 / 1100;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  touch-action: none;
}
.gesture-hint {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}
.frame-selector {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  width: 100%;
  padding: 8px 16px;
  justify-content: center;
  scrollbar-width: none;
}
.frame-selector::-webkit-scrollbar {
  display: none;
}
.frame-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 6px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 11px;
  transition: all 0.2s ease;
}
.frame-thumb.active {
  border-color: #ee0979;
  background: rgba(238, 9, 121, 0.15);
  color: #ffffff;
}
.frame-thumb img {
  width: 36px;
  height: 52px;
  object-fit: cover;
  border-radius: 4px;
  background: #222;
}
</style>
