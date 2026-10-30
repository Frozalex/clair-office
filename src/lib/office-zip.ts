import JSZip from "jszip";
/** Inspect the central directory before any expansion; ZIP64/encryption are not accepted. */
export function validateOfficeZip(buffer: ArrayBuffer) {
  const data = new DataView(buffer);
  let end = -1;
  for (
    let i = buffer.byteLength - 22;
    i >= Math.max(0, buffer.byteLength - 65557);
    i--
  )
    if (data.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Archive Office invalide.");
  const count = data.getUint16(end + 10, true),
    offset = data.getUint32(end + 16, true);
  if (count > 15000 || count === 65535 || offset === 0xffffffff)
    throw new Error("Archive trop complexe pour cet éditeur.");
  let cursor = offset,
    expanded = 0;
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > buffer.byteLength ||
      data.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error("Archive Office endommagée.");
    if (data.getUint16(cursor + 8, true) & 1)
      throw new Error("Les fichiers chiffrés ne sont pas pris en charge.");
    expanded += data.getUint32(cursor + 24, true);
    if (expanded > 150_000_000)
      throw new Error("Archive trop volumineuse après décompression.");
    cursor +=
      46 +
      data.getUint16(cursor + 28, true) +
      data.getUint16(cursor + 30, true) +
      data.getUint16(cursor + 32, true);
  }
}
export async function readOfficeZip(buffer: ArrayBuffer) {
  validateOfficeZip(buffer);
  return JSZip.loadAsync(new Uint8Array(buffer));
}
