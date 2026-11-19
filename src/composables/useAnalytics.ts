import { useNativeBridge } from './useNativeBridge';

interface TrackEventPayload {
  event: string;
  props?: Record<string, any>;
}

export function useAnalytics(endpointUrl = '/api/analytics/track') {
  const { isNativeEnv } = useNativeBridge();

  const track = (event: string, props: Record<string, any> = {}) => {
    const payload: TrackEventPayload = {
      event,
      props: {
        ...props,
        timestamp: Date.now(),
        isNativeWebView: isNativeEnv.value,
        userAgent: navigator.userAgent,
        url: window.location.pathname,
      },
    };

    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${event}`, payload.props);
      return;
    }

    // Use sendBeacon so events survive WebView backgrounding or share sheet launches
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpointUrl, blob);
    } else {
      fetch(endpointUrl, {
        method: 'POST',
        body: blob,
        keepalive: true,
      }).catch(() => {});
    }
  };

  return { track };
}
