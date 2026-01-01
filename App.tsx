
import React, { useState, useEffect, useRef } from 'react';
import { BlurRegion, EffectType } from './types';
import Editor from './components/Editor';
import Header from './components/Header';
import Footer from './components/Footer';
import LoadingOverlay from './components/LoadingOverlay';

declare const faceapi: any;

const App: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [regions, setRegions] = useState<BlurRegion[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEffect, setCurrentEffect] = useState<EffectType>('blur');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        detectFaces(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const detectFaces = async (img: HTMLImageElement) => {
    if (!isModelLoaded) return;
    setIsProcessing(true);

    try {
      const detections = await faceapi.detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 })
      );

      const newRegions: BlurRegion[] = detections.map((det: any, index: number) => ({
        id: `auto-${Date.now()}-${index}`,
        x: det.box.x,
        y: det.box.y,
        width: det.box.width,
        height: det.box.height,
        isAuto: true,
        effectType: currentEffect,
      }));

      setRegions(newRegions);
    } catch (error) {
      console.error("Face detection failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEffectChange = (effect: EffectType) => {
    setCurrentEffect(effect);
    setRegions(prev => prev.map(region => ({
      ...region,
      effectType: effect
    })));
  };

  const addManualRegion = (region: BlurRegion) => {
    setRegions(prev => [...prev, region]);
  };

  const removeRegion = (id: string) => {
    setRegions(prev => prev.filter(r => r.id !== id));
  };

  const updateRegion = (updatedRegion: BlurRegion) => {
    setRegions(prev => prev.map(r => r.id === updatedRegion.id ? updatedRegion : r));
  };

  const reset = () => {
    setImage(null);
    setRegions([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfdfd]">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {!image ? (
          <div className="max-w-2xl mx-auto mt-8 flex flex-col gap-8">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 rounded-3xl p-16 bg-white hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group text-center shadow-sm"
            >
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-inner">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">학생 사진 선택하기</h2>
              <p className="text-gray-500 leading-relaxed">사진을 이곳에 끌어다 놓거나 클릭하세요.<br/><span className="text-blue-500 font-semibold">AI가 자동으로 얼굴을 찾아드립니다.</span></p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            {/* 안내 메시지 추가 */}
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
          <div className="flex flex-col items-center space-y-6">
            <div className="w-full flex justify-between items-center max-w-6xl">
              <button 
                onClick={reset}
                className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                다른 사진 고르기
              </button>
              <div className="flex gap-4">
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {regions.length}개의 얼굴 가림
                </span>
              </div>
            </div>

            <Editor 
              image={image} 
              regions={regions} 
              onAddRegion={addManualRegion} 
              onRemoveRegion={removeRegion}
              onUpdateRegion={updateRegion}
              currentEffect={currentEffect}
              setCurrentEffect={handleEffectChange}
            />
          </div>
        )}
      </main>

      <Footer />
      {isProcessing && <LoadingOverlay message="AI가 얼굴을 찾고 있습니다..." />}
      {!isModelLoaded && <LoadingOverlay message="보안 엔진을 가동 중입니다..." />}
    </div>
  );
};

export default App;
