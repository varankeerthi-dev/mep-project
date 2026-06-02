// Lightweight client-side image compression to WebP before upload.
// Targets: 1600px max dimension, 80% quality. Keeps aspect ratio.
// Returns: { blob, width, height, originalSize, compressedSize }

export type CompressionResult = {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  fileName: string;          // suggested filename after compression
};

export type CompressionOptions = {
  maxSize?: number;          // max width/height in px, default 1600
  quality?: number;          // 0..1, default 0.8
  mimeType?: string;         // output mime, default 'image/webp'
};

const DEFAULTS: Required<CompressionOptions> = {
  maxSize: 1600,
  quality: 0.8,
  mimeType: 'image/webp',
};

const loadImage = (file: File | Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to convert canvas to ${mimeType}`));
      },
      mimeType,
      quality
    );
  });

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const { maxSize, quality, mimeType } = { ...DEFAULTS, ...options };
  const originalSize = file.size;

  const img = await loadImage(file);
  const { width: srcW, height: srcH } = img;

  // Compute target dimensions
  let targetW = srcW;
  let targetH = srcH;
  if (Math.max(srcW, srcH) > maxSize) {
    if (srcW >= srcH) {
      targetW = maxSize;
      targetH = Math.round((srcH * maxSize) / srcW);
    } else {
      targetH = maxSize;
      targetW = Math.round((srcW * maxSize) / srcH);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await canvasToBlob(canvas, mimeType, quality);

  // Build a sensible filename
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  const fileName = `${baseName}.webp`;

  return {
    blob,
    width: targetW,
    height: targetH,
    originalSize,
    compressedSize: blob.size,
    mimeType,
    fileName,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function compressionRatio(original: number, compressed: number): number {
  if (original === 0) return 1;
  return compressed / original;
}
