export async function loadNormalizedImage(file: File, maxDimension = 1600): Promise<HTMLImageElement> {
  const orientation = await getExifOrientation(file);
  const rawImg = await fileToImage(file);

  const isRotated = orientation >= 5 && orientation <= 8;
  let width = isRotated ? rawImg.height : rawImg.width;
  let height = isRotated ? rawImg.width : rawImg.height;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d')!;

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, width, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, width, height); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, height); break;
    default: break;
  }

  const drawW = isRotated ? height : width;
  const drawH = isRotated ? width : height;
  ctx.drawImage(rawImg, 0, 0, drawW, drawH);

  return new Promise((resolve) => {
    const normalized = new Image();
    normalized.onload = () => resolve(normalized);
    normalized.src = offscreen.toDataURL('image/jpeg', 0.92);
  });
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const slice = file.slice(0, 65536);
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) return resolve(1);

      let offset = 2;
      while (offset < view.byteLength) {
        if (offset + 4 > view.byteLength) break;
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          if (view.getUint32(offset + 2, false) !== 0x45786966) return resolve(1);
          const little = view.getUint16(offset + 8, false) === 0x4949;
          const ifdOffset = view.getUint32(offset + 12, little);
          const tags = view.getUint16(offset + 8 + ifdOffset, little);

          for (let i = 0; i < tags; i++) {
            const entryOffset = offset + 10 + ifdOffset + i * 12;
            if (entryOffset + 10 <= view.byteLength && view.getUint16(entryOffset, little) === 0x0112) {
              return resolve(view.getUint16(entryOffset + 8, little));
            }
          }
        } else if ((marker & 0xff00) !== 0xff00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(slice);
  });
}
