# H5 Interactive Marketing Campaign & Native WebView Bridge

A mobile-first Vue 3 + TypeScript H5 application featuring a 100dvh vertical swipe experience, a 60fps multi-touch photo frame generator, and unified iOS/Android JSBridge integration.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Place your transparent PNG frames in `public/assets/frames/`, stickers in `public/assets/stickers/`, custom `.woff2` font in `public/assets/fonts/`, and background music in `public/assets/audio/bgm.mp3`.
3. Start the mobile dev server:
   ```bash
   npm run dev
   ```
4. Append `?debug=1` to any staging/production URL to launch the on-device `vConsole` inspector.

## Native JSBridge Contract

- **iOS:** `window.webkit.messageHandlers.NativeAppBridge.postMessage(jsonString)`
- **Android:** `window.NativeAppBridge.postMessage(jsonString)`
- **Actions:** `getUserInfo`, `saveImageToAlbum`, `shareImage`
