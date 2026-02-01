
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { BlurRegion, Point, EffectType } from '../types';

interface EditorProps {
  image: HTMLImageElement;
  regions: BlurRegion[];
  onAddRegion: (region: BlurRegion) => void;
  onRemoveRegion: (id: string) => void;
  onUpdateRegion: (region: BlurRegion) => void;
  currentEffect: EffectType;
  setCurrentEffect: (effect: EffectType) => void;
  currentIntensity: number;
  setCurrentIntensity: (intensity: number) => void;
}

const Editor: React.FC<EditorProps> = ({ 
  image, 
  regions, 
  onAddRegion, 
  onRemoveRegion, 
  onUpdateRegion,
  currentEffect, 
  setCurrentEffect,
  currentIntensity,
  setCurrentIntensity
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // 성능 최적화를 위한 오프스크린 캔버스 캐시
  const blurLayerRef = useRef<HTMLCanvasElement | null>(null);
  const mosaicLayerRef = useRef<HTMLCanvasElement | null>(null);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<Partial<BlurRegion> | null>(null);

  // 로컬 상태 추가 (성능 최적화용)
  const [localIntensity, setLocalIntensity] = useState(currentIntensity);
  const [localDragPos, setLocalDragPos] = useState<Point | null>(null);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // 부모로부터 온 강도 값이 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLocalIntensity(currentIntensity);
  }, [currentIntensity]);

  // 슬라이더 디바운싱: 로컬 값이 변경되고 200ms 후 부모 상태 업데이트
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localIntensity !== currentIntensity) {
        setCurrentIntensity(localIntensity);
      }
    }, 200);
    return () => clearTimeout(handler);
  }, [localIntensity, currentIntensity, setCurrentIntensity]);

  // 효과 레이어 미리 렌더링 (강도 변경 시에만 업데이트됨)
  useEffect(() => {
    if (!image) return;

    // 블러 레이어 생성
    const bCanvas = document.createElement('canvas');
    bCanvas.width = image.naturalWidth;
    bCanvas.height = image.naturalHeight;
    const bCtx = bCanvas.getContext('2d')!;
    bCtx.filter = `blur(${currentIntensity}px)`;
    bCtx.drawImage(image, 0, 0);
    blurLayerRef.current = bCanvas;

    // 모자이크 레이어 생성
    const mCanvas = document.createElement('canvas');
    mCanvas.width = image.naturalWidth;
    mCanvas.height = image.naturalHeight;
    const mCtx = mCanvas.getContext('2d')!;
    const size = Math.max(2, currentIntensity);
    const w = Math.ceil(image.naturalWidth / size);
    const h = Math.ceil(image.naturalHeight / size);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.drawImage(image, 0, 0, w, h);
    mCtx.imageSmoothingEnabled = false;
    mCtx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, image.naturalWidth, image.naturalHeight);
    mosaicLayerRef.current = mCanvas;

    renderCanvas();
  }, [image, currentIntensity]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    
    // 1. 원본 이미지 그리기
    ctx.drawImage(image, 0, 0);

    // 2. 가림 영역 그리기
    regions.forEach(region => {
      const { x, y, width, height, effectType } = region;
      const layer = effectType === 'mosaic' ? mosaicLayerRef.current : blurLayerRef.current;
      
      if (layer) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
    });
  }, [image, regions]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getCanvasCoords = (e: React.MouseEvent | MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = image.naturalWidth / rect.width;
    const scaleY = image.naturalHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const point = getCanvasCoords(e);
    const target = e.target as HTMLElement;
    const regionId = target.closest('[data-region-id]')?.getAttribute('data-region-id');
    
    if (regionId && !isAddingMode) {
      if (target.closest('.delete-btn')) return;
      const region = regions.find(r => r.id === regionId);
      if (region) {
        setIsDragging(true);
        setDraggingId(regionId);
        setDragOffset({
          x: point.x - region.x,
          y: point.y - region.y
        });
        setLocalDragPos({ x: region.x, y: region.y });
        return;
      }
    }

    if (!isAddingMode) return;
    setStartPoint(point);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const current = getCanvasCoords(e);

    if (isDragging && draggingId) {
      // 드래그 중에는 부모 상태(regions)를 업데이트하지 않고 로컬 위치만 변경 (딜레이 제거)
      setLocalDragPos({
        x: current.x - dragOffset.x,
        y: current.y - dragOffset.y
      });
      return;
    }

    if (!isDrawing || !startPoint) return;
    const x = Math.min(startPoint.x, current.x);
    const y = Math.min(startPoint.y, current.y);
    const width = Math.abs(current.x - startPoint.x);
    const height = Math.abs(current.y - startPoint.y);
    setCurrentRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isDragging && draggingId && localDragPos) {
      const region = regions.find(r => r.id === draggingId);
      if (region) {
        // 마우스를 뗄 때만 부모 상태 업데이트 (지연 렌더링 적용)
        onUpdateRegion({
          ...region,
          x: localDragPos.x,
          y: localDragPos.y
        });
      }
    }
    
    setIsDragging(false);
    setDraggingId(null);
    setLocalDragPos(null);

    if (isDrawing && currentRect && currentRect.width! > 5 && currentRect.height! > 5) {
      onAddRegion({
        id: `manual-${Date.now()}`,
        x: currentRect.x!,
        y: currentRect.y!,
        width: currentRect.width!,
        height: currentRect.height!,
        isAuto: false,
        effectType: currentEffect,
        intensity: currentIntensity
      });
      setIsAddingMode(false);
    }
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);
  };

  const handleDownload = () => {
    if (!isConfirmed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `student-privacy-blur-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsSaveModalOpen(false);
    setIsConfirmed(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl items-start pb-12">
      <div className="flex-grow relative bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <canvas ref={canvasRef} className="max-h-[75vh] w-auto mx-auto block" />

        <div 
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`absolute inset-0 ${isAddingMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-default'} overflow-hidden`}
        >
          {regions.map((region) => {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            const overlayRect = overlayRef.current?.getBoundingClientRect();
            if (!canvasRect || !overlayRect) return null;
            
            const scaleX = canvasRect.width / image.naturalWidth;
            const scaleY = canvasRect.height / image.naturalHeight;
            const offsetX = canvasRect.left - overlayRect.left;
            const offsetY = canvasRect.top - overlayRect.top;

            // 드래그 중인 영역은 로컬 좌표를 사용, 나머지는 원래 좌표 사용
            const isThisBeingDragged = draggingId === region.id && localDragPos;
            const displayX = isThisBeingDragged ? localDragPos!.x : region.x;
            const displayY = isThisBeingDragged ? localDragPos!.y : region.y;

            return (
              <div 
                key={region.id}
                data-region-id={region.id}
                className={`absolute border-2 border-dashed ${region.effectType === 'mosaic' ? 'border-orange-400' : 'border-blue-400'} bg-white/5 group ${isAddingMode ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
                style={{
                  left: displayX * scaleX + offsetX,
                  top: displayY * scaleY + offsetY,
                  width: region.width * scaleX,
                  height: region.height * scaleY,
                  borderRadius: '50%',
                  zIndex: isThisBeingDragged ? 50 : 10
                }}
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRegion(region.id);
                  }}
                  className="delete-btn absolute -top-3 -right-3 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 active:scale-90"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {currentRect && (
            (() => {
              const canvasRect = canvasRef.current?.getBoundingClientRect();
              const overlayRect = overlayRef.current?.getBoundingClientRect();
              if (!canvasRect || !overlayRect) return null;
              
              const scaleX = canvasRect.width / image.naturalWidth;
              const scaleY = canvasRect.height / image.naturalHeight;
              const offsetX = canvasRect.left - overlayRect.left;
              const offsetY = canvasRect.top - overlayRect.top;

              return (
                <div 
                  className="absolute border-2 border-dashed border-white bg-blue-500/20"
                  style={{
                    left: currentRect.x! * scaleX + offsetX,
                    top: currentRect.y! * scaleY + offsetY,
                    width: currentRect.width! * scaleX,
                    height: currentRect.height! * scaleY,
                    borderRadius: '50%'
                  }}
                />
              );
            })()
          )}
          
          {isAddingMode && !isDrawing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-sm font-bold rounded-full backdrop-blur-md">
              이미지 위를 드래그하여 원을 그리세요
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-72 flex flex-col gap-6 sticky top-24">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">가리기 방식</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button 
                onClick={() => setCurrentEffect('blur')}
                className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border-2 ${currentEffect === 'blur' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
              >
                블러 (흐림)
              </button>
              <button 
                onClick={() => setCurrentEffect('mosaic')}
                className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border-2 ${currentEffect === 'mosaic' ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}
              >
                모자이크
              </button>
            </div>

            {/* 강도 조절 슬라이더 (로컬 상태 사용) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500">효과 강도</span>
                <span className="text-xs font-bold text-blue-600">{localIntensity}</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="80" 
                step="1"
                value={localIntensity}
                onChange={(e) => setLocalIntensity(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button 
              onClick={() => setIsAddingMode(!isAddingMode)}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all border-2 ${isAddingMode ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
            >
              {isAddingMode ? (
                <>취소하기</>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  모자이크 추가
                </>
              )}
            </button>
            <p className="mt-3 text-[11px] text-gray-400 text-center leading-relaxed">
              * 추가된 영역은 마우스로 잡고<br/>원하는 위치로 옮길 수 있습니다.
            </p>
          </div>
        </div>

        <button 
          onClick={() => setIsSaveModalOpen(true)}
          className="w-full flex items-center justify-center gap-3 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 group"
        >
          <svg className="w-6 h-6 group-hover:bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          저장하기 (PNG)
        </button>
      </div>

      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-6 text-orange-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-bold">사용 전 주의사항</h3>
            </div>
            
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 mb-8">
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                본 서비스는 편집 보조 도구로, AI가 모든 얼굴을 100% 인식하지 못할 수 있습니다.
              </p>
              <p className="text-gray-700 text-sm leading-relaxed mb-4 font-semibold">
                인식되지 않은 얼굴에 대한 최종 확인 및 편집 책임은 사용자에게 있으며, 누락으로 인한 문제 발생 시 서비스는 책임을 지지 않습니다.
              </p>
              <p className="text-gray-800 text-sm leading-relaxed font-bold underline decoration-orange-300">
                다운로드 전 반드시 결과를 검토해 주세요.
              </p>
            </div>

            <label className="flex items-center gap-3 mb-8 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-800 font-bold group-hover:text-blue-600 transition-colors">
                확인했습니다(다운로드)
              </span>
            </label>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsSaveModalOpen(false);
                  setIsConfirmed(false);
                }}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleDownload}
                disabled={!isConfirmed}
                className={`flex-1 py-4 font-bold rounded-2xl transition-all shadow-lg ${isConfirmed ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
              >
                다운로드 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
