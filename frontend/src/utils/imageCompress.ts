// Shrink large photos/screenshots in the browser before uploading, so attachments go up fast on
// slow branch / mobile connections (e.g. ~70 KB/s measured on a hotspot). Only JPEG, PNG and
// WebP images are touched; PDFs, documents, voice notes and GIFs are uploaded unchanged.
// The decision logic (planImageResize) is unit-tested in imageCompress.test.ts.

export const MAX_DIMENSION = 1920;           // longest side after resizing, in pixels
export const COMPRESS_OVER_BYTES = 1024 * 1024; // only bother above 1 MB…
export const RESIZE_OVER_DIMENSION = 2560;   // …or when the image is huge in pixels
export const QUALITY = 0.82;

const COMPRESSIBLE = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface ResizePlan {
  compress: boolean;
  width: number;
  height: number;
  /** Always JPEG: the server's ALLOWED_MIME_TYPES accepts JPEG but not WebP. Transparent areas
   *  (e.g. in PNG screenshots) are filled white. */
  outType: 'image/jpeg';
}

export function planImageResize(input: { type: string; size: number; width: number; height: number }): ResizePlan {
  const type = (input.type || '').toLowerCase();
  const outType: ResizePlan['outType'] = 'image/jpeg';
  const longest = Math.max(input.width, input.height);
  const eligible =
    COMPRESSIBLE.includes(type) &&
    input.width > 0 && input.height > 0 &&
    (input.size > COMPRESS_OVER_BYTES || longest > RESIZE_OVER_DIMENSION);
  if (!eligible) return { compress: false, width: input.width, height: input.height, outType };
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  return {
    compress: true,
    width: Math.max(1, Math.round(input.width * scale)),
    height: Math.max(1, Math.round(input.height * scale)),
    outType,
  };
}

export function renamedForType(name: string, _outType: ResizePlan['outType']): string {
  const ext = '.jpg';
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}${ext}`;
}

/**
 * Returns a smaller copy of a large image, or the original file when it isn't an image, is
 * already small, or anything goes wrong (never blocks an upload).
 */
export async function shrinkImageForUpload(file: File): Promise<File> {
  try {
    if (!COMPRESSIBLE.includes((file.type || '').toLowerCase())) return file;
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
    const bitmap = await createImageBitmap(file);
    const plan = planImageResize({ type: file.type, size: file.size, width: bitmap.width, height: bitmap.height });
    if (!plan.compress) { bitmap.close?.(); return file; }

    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.fillStyle = '#ffffff'; // JPEG has no transparency
    ctx.fillRect(0, 0, plan.width, plan.height);
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file; // only use it if it actually got smaller
    return new File([blob], renamedForType(file.name, 'image/jpeg'), { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
