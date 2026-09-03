import React, { useRef } from 'react';
import { QueueItem } from '../types';

interface BatchQueueBarProps {
  queue: QueueItem[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  onRemoveItem: (id: string, e: React.MouseEvent) => void;
  onAddMoreFiles: () => void;
}

const BatchQueueBar: React.FC<BatchQueueBarProps> = ({
  queue,
  currentIndex,
  onSelectIndex,
  onRemoveItem,
  onAddMoreFiles
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      onSelectIndex(currentIndex + 1);
    }
  };

  return (
    <div className="w-full max-w-7xl bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            업로드된 사진 목록
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
            {currentIndex + 1} / {queue.length}장
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
            <kbd className="font-mono bg-white border border-gray-200 px-1 py-0.5 rounded text-[10px] text-gray-600">Ctrl+V</kbd>
            로 이미지 즉시 추가 가능
          </span>

          <button
            type="button"
            onClick={onAddMoreFiles}
            className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 border border-blue-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            사진 추가
          </button>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        {/* 이전 버튼 */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
            currentIndex === 0
              ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-100 shadow-xs'
          }`}
          title="이전 사진"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 썸네일 스크롤 리스트 */}
        <div
          ref={scrollContainerRef}
          className="flex-grow flex items-center gap-3 overflow-x-auto py-1 px-1 scrollbar-thin scrollbar-thumb-gray-200"
        >
          {queue.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={item.id}
                onClick={() => onSelectIndex(idx)}
                className={`group relative shrink-0 w-24 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                  isActive
                    ? 'border-blue-600 ring-2 ring-blue-200 shadow-md scale-[1.02]'
                    : 'border-gray-200 hover:border-gray-400 opacity-80 hover:opacity-100'
                }`}
              >
                <img
                  src={item.previewUrl}
                  alt={`사진 ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* 순서 뱃지 */}
                <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-black/60 text-white'
                }`}>
                  {idx + 1}
                </span>

                {/* 가림 영역 수 뱃지 */}
                <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[9px] font-medium bg-black/70 text-white backdrop-blur-xs">
                  {item.isAiProcessing ? (
                    <span className="text-yellow-300 animate-pulse">탐색중</span>
                  ) : (
                    `${item.regions.length}명`
                  )}
                </span>

                {/* 삭제 버튼 */}
                {queue.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => onRemoveItem(item.id, e)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="이 사진 제거"
                  >
                    <span className="text-xs font-bold leading-none">✕</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 다음 버튼 */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === queue.length - 1}
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
            currentIndex === queue.length - 1
              ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-100 shadow-xs'
          }`}
          title="다음 사진"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BatchQueueBar;
