
export type EffectType = 'blur' | 'mosaic';

export interface BlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isAuto: boolean;
  effectType: EffectType;
  intensity: number; // 효과 강도 (블러 반경 또는 모자이크 크기)
}

export interface Point {
  x: number;
  y: number;
}

export interface ImageFileInfo {
  name: string;
  type: string;
  size: number;
}

export interface QueueItem {
  id: string;
  fileInfo: ImageFileInfo;
  image: HTMLImageElement;
  previewUrl: string;
  regions: BlurRegion[];
  isAiProcessed: boolean;
  isAiProcessing?: boolean;
  effectType: EffectType;
  intensity: number;
}
