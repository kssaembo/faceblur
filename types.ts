
export type EffectType = 'blur' | 'mosaic';

export interface BlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isAuto: boolean;
  effectType: EffectType;
}

export interface Point {
  x: number;
  y: number;
}
