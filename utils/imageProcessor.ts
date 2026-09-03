import JSZip from 'jszip';
import { BlurRegion, EffectType, ImageFileInfo, QueueItem } from '../types';

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * 블러 처리된 레이어 생성
 */
export const createBlurLayer = (image: HTMLImageElement, intensity: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = `blur(${intensity}px)`;
  ctx.drawImage(image, 0, 0);
  return canvas;
};

/**
 * 모자이크 처리된 레이어 생성
 */
export const createMosaicLayer = (image: HTMLImageElement, intensity: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  const size = Math.max(2, intensity);
  const w = Math.ceil(image.naturalWidth / size);
  const h = Math.ceil(image.naturalHeight / size);
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(image, 0, 0, w, h);
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, image.naturalWidth, image.naturalHeight);
  return canvas;
};

/**
 * 원본 이미지와 가림 영역들을 타원 클리핑 마스크로 합성하여 오프스크린 캔버스로 반환
 */
export const renderRegionsToCanvas = (
  image: HTMLImageElement,
  regions: BlurRegion[]
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // 1. 원본 이미지 그리기
  ctx.drawImage(image, 0, 0);

  // 2. 강도별/효과타입별 레이어 캐시
  const layerCache = new Map<string, HTMLCanvasElement>();

  const getLayer = (effectType: EffectType, intensity: number): HTMLCanvasElement => {
    const key = `${effectType}-${intensity}`;
    if (!layerCache.has(key)) {
      if (effectType === 'mosaic') {
        layerCache.set(key, createMosaicLayer(image, intensity));
      } else {
        layerCache.set(key, createBlurLayer(image, intensity));
      }
    }
    return layerCache.get(key)!;
  };

  // 3. 영역별 타원 클리핑 및 렌더링
  regions.forEach((region) => {
    const { x, y, width, height, effectType, intensity } = region;
    const layer = getLayer(effectType, intensity);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  });

  return canvas;
};

/**
 * 캔버스를 원본 포맷 및 원본 용량과 유사하게 최적화된 Blob으로 내보내기
 */
export const exportOptimizedBlob = async (
  canvas: HTMLCanvasElement,
  mimeType: string,
  targetSize?: number
): Promise<Blob | null> => {
  if (mimeType === 'image/png') {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  // JPEG 또는 WebP의 경우:
  const q = 0.92;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, q));

  // 원본 크기보다 15% 이상 커진 경우 시각적 무손실 범위(0.85 ~ 0.92) 내에서 원본 용량과 유사하게 미세 조정
  if (blob && targetSize && targetSize > 0 && blob.size > targetSize * 1.15) {
    const ratio = targetSize / blob.size;
    const adjustedQuality = Math.max(0.85, Math.min(0.92, q * Math.sqrt(ratio)));
    const refinedBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, adjustedQuality));
    if (refinedBlob) {
      blob = refinedBlob;
    }
  }

  return blob;
};

/**
 * 단일 아이템을 최적화된 Blob으로 변환
 */
export const processQueueItemToBlob = async (
  item: QueueItem,
  formatOverride?: 'original' | 'jpeg' | 'png'
): Promise<{ blob: Blob; fileName: string; ext: string }> => {
  const isPng = item.fileInfo.type === 'image/png' || /\.png$/i.test(item.fileInfo.name);
  const isWebp = item.fileInfo.type === 'image/webp' || /\.webp$/i.test(item.fileInfo.name);
  
  let targetFormat = formatOverride || 'original';
  if (targetFormat === 'original') {
    targetFormat = isPng ? 'png' : isWebp ? 'jpeg' : 'jpeg'; // 기본 JPEG (안정적 압축)
  }

  const mimeType = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
  const ext = targetFormat === 'png' ? 'png' : 'jpg';

  const canvas = renderRegionsToCanvas(item.image, item.regions);
  const blob = await exportOptimizedBlob(canvas, mimeType, item.fileInfo.size);

  if (!blob) {
    throw new Error(`Failed to generate blob for ${item.fileInfo.name}`);
  }

  const baseName = item.fileInfo.name.replace(/\.[^/.]+$/, '');
  const fileName = `${baseName}_blur.${ext}`;

  return { blob, fileName, ext };
};

export interface BatchProgress {
  current: number;
  total: number;
  message: string;
  percent: number;
}

/**
 * 큐의 모든 이미지를 처리하여 ZIP 압축 파일 Blob으로 생성
 */
export const createBatchZip = async (
  items: QueueItem[],
  onProgress?: (progress: BatchProgress) => void,
  formatOverride?: 'original' | 'jpeg' | 'png'
): Promise<Blob> => {
  const zip = new JSZip();
  const total = items.length;

  for (let i = 0; i < total; i++) {
    const item = items[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        message: `사진 ${i + 1}/${total} 처리 중 (${item.fileInfo.name})...`,
        percent: Math.round(((i) / total) * 80)
      });
    }

    const { blob, fileName } = await processQueueItemToBlob(item, formatOverride);
    
    // 파일명 중복 방지
    let finalFileName = fileName;
    let counter = 1;
    while (zip.file(finalFileName)) {
      const extMatch = fileName.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1] : '';
      const base = fileName.replace(/\.[^.]+$/, '');
      finalFileName = `${base}_(${counter}).${ext}`;
      counter++;
    }

    zip.file(finalFileName, blob);
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      message: 'ZIP 압축 파일 생성 중...',
      percent: 85
    });
  }

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      if (onProgress) {
        onProgress({
          current: total,
          total,
          message: `ZIP 압축 진행 중 (${metadata.percent.toFixed(0)}%)...`,
          percent: 85 + Math.round((metadata.percent / 100) * 15)
        });
      }
    }
  );

  return zipBlob;
};
