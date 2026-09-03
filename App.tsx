import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BlurRegion, EffectType, ImageFileInfo, QueueItem } from './types';
import Editor from './components/Editor';
import Header from './components/Header';
import Footer from './components/Footer';
import LoadingOverlay from './components/LoadingOverlay';
import BatchQueueBar from './components/BatchQueueBar';
import BatchZipModal from './components/BatchZipModal';

declare const faceapi: any;

const App: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEffect, setCurrentEffect] = useState<EffectType>('blur');
  const [currentIntensity, setCurrentIntensity] = useState<number>(25);
  
  const [isBatchZipModalOpen, setIsBatchZipModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // 최신 큐 및 활성 인덱스를 추적하는 Ref (비동기 루프 및 동시성 제어용)
  const queueRef = useRef<QueueItem[]>(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const currentIndexRef = useRef<number>(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const isDetectingRef = useRef(false);
  const isWorkerRunningRef = useRef(false);

  // 토스트 메시지 출력
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  // 모델 로드
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
      } catch (error) {
        console.error("Failed to load models.", error);
        alert("모델 로드 실패. 인터넷 연결을 확인해주세요.");
      }
    };
    loadModels();
  }, []);

  // 단일 이미지에 대한 얼굴 감지 로직 (WebGL 동시 호출 충돌 방지 락 적용)
  const detectFacesForImage = useCallback(async (
    img: HTMLImageElement,
    effect: EffectType,
    intensity: number
  ): Promise<BlurRegion[]> => {
    if (!isModelLoaded) return [];

    // 이전 감지가 실행 중이라면 순차 대기
    while (isDetectingRef.current) {
      await new Promise((r) => setTimeout(r, 60));
    }

    isDetectingRef.current = true;
    try {
      const detections = await faceapi.detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 })
      );

      return detections.map((det: any, index: number) => ({
        id: `auto-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        x: det.box.x,
        y: det.box.y,
        width: det.box.width,
        height: det.box.height,
        isAuto: true,
        effectType: effect,
        intensity: intensity,
      }));
    } catch (error) {
      console.error("Face detection failed:", error);
      return [];
    } finally {
      isDetectingRef.current = false;
    }
  }, [isModelLoaded]);

  // 백그라운드에서 미처리된 사진들을 순차적으로 감지하는 안정적인 워커
  const runQueueWorker = useCallback(async () => {
    if (isWorkerRunningRef.current || !isModelLoaded) return;
    isWorkerRunningRef.current = true;

    try {
      while (true) {
        const currentList = queueRef.current;
        if (currentList.length === 0) break;

        // 1순위: 현재 사용자가 보고 있는 활성 인덱스의 사진이 아직 미처리라면 최우선 처리
        const activeIdx = currentIndexRef.current;
        let targetItem: QueueItem | undefined;

        if (currentList[activeIdx] && !currentList[activeIdx].isAiProcessed) {
          targetItem = currentList[activeIdx];
        } else {
          // 2순위: 아직 AI 처리가 되지 않은 첫 번째 사진 선택
          targetItem = currentList.find((item) => !item.isAiProcessed);
        }

        if (!targetItem) {
          // 모든 사진 처리 완료!
          break;
        }

        const targetId = targetItem.id;
        const targetImg = targetItem.image;
        const targetEffect = targetItem.effectType;
        const targetIntensity = targetItem.intensity;

        // 탐색 중 UI 표시 (isAiProcessing: true)
        setQueue((prev) =>
          prev.map((item) => (item.id === targetId ? { ...item, isAiProcessing: true } : item))
        );

        // AI 얼굴 탐색 수행
        const detected = await detectFacesForImage(targetImg, targetEffect, targetIntensity);

        // 탐색 완료 UI 및 가림 영역 반영 (isAiProcessed: true, isAiProcessing: false)
        setQueue((prev) =>
          prev.map((item) =>
            item.id === targetId
              ? {
                  ...item,
                  regions: detected,
                  isAiProcessed: true,
                  isAiProcessing: false,
                }
              : item
          )
        );

        // 브라우저 렌더링 프레임 확보 및 UI 버벅임 방지
        await new Promise((r) => setTimeout(r, 60));
      }
    } catch (err) {
      console.error("Queue worker error:", err);
    } finally {
      isWorkerRunningRef.current = false;
    }
  }, [isModelLoaded, detectFacesForImage]);

  // 큐에 미처리 항목이 있고 모델이 로드되어 있으면 워커 가동
  useEffect(() => {
    if (!isModelLoaded || queue.length === 0) return;
    const hasUnprocessed = queue.some((item) => !item.isAiProcessed);
    if (hasUnprocessed && !isWorkerRunningRef.current) {
      runQueueWorker();
    }
  }, [queue, isModelLoaded, runQueueWorker]);

  // 파일 목록(FileList 또는 File[])을 QueueItem 목록으로 변환하여 추가
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const isFirstLoad = queue.length === 0;
    if (isFirstLoad) {
      setIsProcessing(true);
    }

    const newItems: QueueItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const previewUrl = URL.createObjectURL(file);
      
      const img = await new Promise<HTMLImageElement>((resolve) => {
        const imageElement = new Image();
        imageElement.onload = () => resolve(imageElement);
        imageElement.src = previewUrl;
      });

      const fileInfo: ImageFileInfo = {
        name: file.name,
        type: file.type,
        size: file.size,
      };

      const newItem: QueueItem = {
        id: `queue-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        fileInfo,
        image: img,
        previewUrl,
        regions: [],
        isAiProcessed: false,
        isAiProcessing: false,
        effectType: currentEffect,
        intensity: currentIntensity,
      };

      newItems.push(newItem);
    }

    // 첫 번째 로드인 경우 첫 사진 즉시 처리
    if (isFirstLoad && newItems.length > 0) {
      setCurrentIndex(0);
      newItems[0].isAiProcessing = true;
      const detected = await detectFacesForImage(newItems[0].image, currentEffect, currentIntensity);
      newItems[0].regions = detected;
      newItems[0].isAiProcessed = true;
      newItems[0].isAiProcessing = false;
      setIsProcessing(false);
    }

    // 큐에 추가 (나머지 항목들은 useEffect의 워커가 순차적으로 처리)
    setQueue((prevQueue) => [...prevQueue, ...newItems]);
  }, [queue.length, currentEffect, currentIntensity, detectFacesForImage]);

  // 1. Ctrl + V 클립보드 이미지 붙여넣기 이벤트 리스너
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      const pastedFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blobFile = item.getAsFile();
          if (blobFile) {
            const timeStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
            const fileName = `클립보드_캡처_${timeStr}_${i + 1}.png`;
            const customFile = new File([blobFile], fileName, { type: blobFile.type || 'image/png' });
            pastedFiles.push(customFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        showToast(`📋 클립보드 사진 ${pastedFiles.length}장이 추가되었습니다!`);
        processFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [processFiles, showToast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleAddMoreFiles = () => {
    addMoreInputRef.current?.click();
  };

  // 현재 활성화된 아이템
  const currentItem = queue[currentIndex] || null;

  // 가림 효과 변경
  const handleEffectChange = (effect: EffectType) => {
    setCurrentEffect(effect);
    if (!currentItem) return;
    setQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) {
        copy[currentIndex] = {
          ...copy[currentIndex],
          effectType: effect,
          regions: copy[currentIndex].regions.map((r) => ({ ...r, effectType: effect })),
        };
      }
      return copy;
    });
  };

  // 강도 변경
  const handleIntensityChange = (intensity: number) => {
    setCurrentIntensity(intensity);
    if (!currentItem) return;
    setQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) {
        copy[currentIndex] = {
          ...copy[currentIndex],
          intensity,
          regions: copy[currentIndex].regions.map((r) => ({ ...r, intensity })),
        };
      }
      return copy;
    });
  };

  const addManualRegion = (region: BlurRegion) => {
    if (!currentItem) return;
    setQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) {
        copy[currentIndex] = {
          ...copy[currentIndex],
          regions: [...copy[currentIndex].regions, region],
        };
      }
      return copy;
    });
  };

  const removeRegion = (id: string) => {
    if (!currentItem) return;
    setQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) {
        copy[currentIndex] = {
          ...copy[currentIndex],
          regions: copy[currentIndex].regions.filter((r) => r.id !== id),
        };
      }
      return copy;
    });
  };

  const updateRegion = (updatedRegion: BlurRegion) => {
    if (!currentItem) return;
    setQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) {
        copy[currentIndex] = {
          ...copy[currentIndex],
          regions: copy[currentIndex].regions.map((r) =>
            r.id === updatedRegion.id ? updatedRegion : r
          ),
        };
      }
      return copy;
    });
  };

  // 특정 사진 삭제
  const handleRemoveQueueItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue((prev) => {
      const idxToRemove = prev.findIndex((item) => item.id === id);
      if (idxToRemove === -1) return prev;
      
      const newQueue = prev.filter((item) => item.id !== id);
      if (newQueue.length === 0) {
        setCurrentIndex(0);
        return [];
      }
      if (currentIndex >= newQueue.length) {
        setCurrentIndex(newQueue.length - 1);
      } else if (idxToRemove < currentIndex) {
        setCurrentIndex(currentIndex - 1);
      }
      return newQueue;
    });
  };

  // 전체 초기화
  const resetAll = () => {
    queue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setQueue([]);
    setCurrentIndex(0);
    setCurrentIntensity(25);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (addMoreInputRef.current) addMoreInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfdfd]">
      <Header />

      {/* 상단 알림 토스트 (클립보드 붙여넣기 등 알림) */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[400] bg-gray-900/90 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 숨겨진 사진 추가용 input */}
      <input
        type="file"
        ref={addMoreInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*"
        multiple
      />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {queue.length === 0 || !currentItem ? (
          <div className="max-w-2xl mx-auto mt-8 flex flex-col gap-8">
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processFiles(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed rounded-3xl p-14 bg-white transition-all cursor-pointer group text-center shadow-sm ${
                isDraggingOver
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-blue-200 hover:border-blue-500 hover:bg-blue-50/30'
              }`}
            >
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">학생 사진 선택하기</h2>
              <p className="text-blue-600 font-bold text-sm mb-3">여러 장 동시 선택 및 일괄 처리 지원</p>
              <p className="text-gray-500 text-sm leading-relaxed mb-5">
                사진을 이곳에 끌어다 놓거나 클릭하여 선택하세요.<br />
                <span className="text-gray-400">AI가 자동으로 얼굴을 찾아 가림 처리합니다.</span>
              </p>

              {/* Ctrl + V 배지 안내 */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-gray-700 text-xs font-semibold border border-slate-200/80">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>클립보드 이미지 바로 붙여넣기 가능:</span>
                <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded shadow-xs font-mono font-bold text-gray-800">Ctrl + V</kbd>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
                multiple
              />
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                사용 전 꼭 확인해주세요!
              </h3>
              <p className="text-sm text-gray-600 mb-4 font-medium">AI 모델이 얼굴을 최대한 찾아내지만, 다음과 같은 경우 인식이 어려울 수 있습니다.</p>
              <ul className="space-y-3 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>얼굴이 너무 작게 찍혔을 때 (멀리 있는 인물)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>마스크, 선글라스, 모자 등으로 얼굴의 상당 부분이 가려졌을 때</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>조명이 너무 어둡거나 측면을 보고 있을 때</span>
                </li>
              </ul>
              <p className="mt-6 text-sm text-gray-600 leading-relaxed pt-4 border-t border-gray-200">
                자동 인식이 되지 않은 얼굴은 <span className="font-bold text-blue-600">마우스 드래그</span>를 통해 수동으로 블러를 추가해 주세요. 소중한 아이들의 프라이버시를 위해 최종 결과물을 반드시 한 번 더 확인하시길 권장합니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            {/* 상단 액션 바 */}
            <div className="w-full flex justify-between items-center max-w-7xl">
              <button 
                onClick={resetAll}
                className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                처음으로 (전체 취소)
              </button>

              <div className="flex items-center gap-3">
                {queue.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsBatchZipModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-100 flex items-center gap-2 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span>ZIP 일괄 다운로드 ({queue.length}장)</span>
                  </button>
                )}
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {currentItem.regions.length}개의 얼굴 가림
                </span>
              </div>
            </div>

            {/* 여러 장 업로드 시 표시되는 썸네일 네비게이션 바 */}
            {queue.length > 1 && (
              <BatchQueueBar
                queue={queue}
                currentIndex={currentIndex}
                onSelectIndex={setCurrentIndex}
                onRemoveItem={handleRemoveQueueItem}
                onAddMoreFiles={handleAddMoreFiles}
              />
            )}

            {/* 에디터 컴포넌트 */}
            <Editor 
              key={currentItem.id} // key를 지정하여 이미지 변경 시 에디터 상태 깔끔히 갱신
              image={currentItem.image} 
              fileInfo={currentItem.fileInfo}
              regions={currentItem.regions} 
              onAddRegion={addManualRegion} 
              onRemoveRegion={removeRegion} 
              onUpdateRegion={updateRegion}
              currentEffect={currentEffect}
              setCurrentEffect={handleEffectChange}
              currentIntensity={currentIntensity}
              setCurrentIntensity={handleIntensityChange}
              totalQueueCount={queue.length}
              onOpenBatchZipModal={() => setIsBatchZipModalOpen(true)}
              isAiProcessing={currentItem.isAiProcessing}
            />
          </div>
        )}
      </main>

      <Footer />

      {/* 일괄 압축 다운로드 모달 */}
      <BatchZipModal
        queue={queue}
        isOpen={isBatchZipModalOpen}
        onClose={() => setIsBatchZipModalOpen(false)}
      />

      {isProcessing && <LoadingOverlay message="사진을 읽고 AI가 얼굴을 찾는 중입니다..." />}
      {!isModelLoaded && <LoadingOverlay message="보안 엔진을 가동 중입니다..." />}
    </div>
  );
};

export default App;
