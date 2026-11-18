import { createApp } from 'vue';
import App from './App.vue';

async function bootstrap() {
  const isDebugQuery = new URLSearchParams(window.location.search).get('debug') === '1';

  if (import.meta.env.DEV || isDebugQuery) {
    const { default: VConsole } = await import('vconsole');
    new VConsole({
      theme: 'dark',
      onReady: () => {
        console.log('[vConsole] Mobile WebView debugger initialized');
      },
    });
  }

  createApp(App).mount('#app');
}

bootstrap();
