import { ref } from 'vue';

export function usePreloader(assetUrls: string[]) {
  const progress = ref(0);
  const isLoaded = ref(false);

  const startPreload = (): Promise<void> => {
    return new Promise((resolve) => {
      if (assetUrls.length === 0) {
        progress.value = 100;
        isLoaded.value = true;
        return resolve();
      }

      let loadedCount = 0;

      const onAssetSettled = () => {
        loadedCount++;
        progress.value = Math.round((loadedCount / assetUrls.length) * 100);
        if (loadedCount >= assetUrls.length) {
          setTimeout(() => {
            isLoaded.value = true;
            resolve();
          }, 250);
        }
      };

      assetUrls.forEach((url) => {
        const img = new Image();
        img.onload = onAssetSettled;
        img.onerror = onAssetSettled;
        img.src = url;
      });
    });
  };

  return { progress, isLoaded, startPreload };
}
