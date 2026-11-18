export async function loadCanvasFont(fontFamily: string, fontUrl: string): Promise<void> {
  const isLoaded = Array.from(document.fonts).some(
    (f) => f.family === fontFamily && f.status === 'loaded'
  );
  if (isLoaded) return;

  try {
    const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, {
      style: 'normal',
      weight: '700',
    });

    const loadedFace = await fontFace.load();
    document.fonts.add(loadedFace);
    await document.fonts.ready;
  } catch (err) {
    console.warn(`[FontLoader] Could not load custom font ${fontFamily}, falling back to system font.`);
  }
}
