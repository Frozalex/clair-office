/** Preserve PNG/JPEG aspect ratio when exporting a document. */
export function imageDimensions(data: Uint8Array): {
  width: number;
  height: number;
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length >= 24 && view.getUint32(0) === 0x89504e47)
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < data.length) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1],
        length = view.getUint16(offset + 2);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      if (length < 2) break;
      offset += length + 2;
    }
  }
  return { width: 480, height: 320 };
}
export function containedSize(
  width: number,
  height: number,
  maxWidth = 480,
  maxHeight = 640,
) {
  const ratio = Math.min(
    maxWidth / Math.max(1, width),
    maxHeight / Math.max(1, height),
    1,
  );
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
