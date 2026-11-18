import { ref, onUnmounted } from 'vue';
import { Howl } from 'howler';

export function useAudio(audioUrl: string) {
  const isPlaying = ref(false);
  const isMuted = ref(false);

  const sound = new Howl({
    src: [audioUrl],
    loop: true,
    volume: 0.6,
    html5: false,
    onplay: () => {
      isPlaying.value = true;
    },
    onpause: () => {
      isPlaying.value = false;
    },
  });

  const unlockAndPlay = () => {
    if (!isPlaying.value && !isMuted.value) {
      sound.play();
    }
    window.removeEventListener('touchstart', unlockAndPlay);
    window.removeEventListener('click', unlockAndPlay);
  };

  window.addEventListener('touchstart', unlockAndPlay, { once: true });
  window.addEventListener('click', unlockAndPlay, { once: true });

  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    if (isMuted.value) {
      sound.pause();
    } else {
      sound.play();
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      sound.pause();
    } else if (!isMuted.value) {
      sound.play();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  onUnmounted(() => {
    window.removeEventListener('touchstart', unlockAndPlay);
    window.removeEventListener('click', unlockAndPlay);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    sound.unload();
  });

  return { isPlaying, isMuted, toggleMute };
}
