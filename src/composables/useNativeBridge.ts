import { ref } from 'vue';

interface BridgeResponse<T = any> {
  code: number;
  data?: T;
  message?: string;
}

export function useNativeBridge() {
  const isNativeEnv = ref(
    Boolean((window as any).NativeAppBridge || (window as any).webkit?.messageHandlers?.NativeAppBridge)
  );

  const callNative = <T = any>(action: string, payload: Record<string, any> = {}): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!isNativeEnv.value) {
        console.warn(`[Bridge Mock] Action: ${action}`, payload);
        return reject(new Error('Not running inside custom native app'));
      }

      const callbackId = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      (window as any)[callbackId] = (rawResponse: string | BridgeResponse<T>) => {
        delete (window as any)[callbackId];
        const res: BridgeResponse<T> =
          typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;

        if (res.code === 0) {
          resolve(res.data as T);
        } else {
          reject(new Error(res.message || 'Native bridge error'));
        }
      };

      const message = JSON.stringify({ action, payload, callbackId });

      if ((window as any).webkit?.messageHandlers?.NativeAppBridge) {
        (window as any).webkit.messageHandlers.NativeAppBridge.postMessage(message);
      } else if ((window as any).NativeAppBridge?.postMessage) {
        (window as any).NativeAppBridge.postMessage(message);
      }
    });
  };

  const getUserInfo = () => callNative<{ userId: string; nickname: string; token: string }>('getUserInfo');
  const shareImage = (base64Image: string, title: string) =>
    callNative('shareImage', { image: base64Image, title });
  const saveImageToAlbum = (base64Image: string) =>
    callNative('saveImageToAlbum', { image: base64Image });

  return {
    isNativeEnv,
    getUserInfo,
    shareImage,
    saveImageToAlbum,
  };
}
