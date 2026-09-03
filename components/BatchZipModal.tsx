import React, { useState } from 'react';
import { QueueItem } from '../types';
import { createBatchZip, BatchProgress, formatBytes } from '../utils/imageProcessor';

interface BatchZipModalProps {
  queue: QueueItem[];
  isOpen: boolean;
  onClose: () => void;
}

const BatchZipModal: React.FC<BatchZipModalProps> = ({ queue, isOpen, onClose }) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'original' | 'jpeg' | 'png'>('original');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalOriginalBytes = queue.reduce((sum, item) => sum + (item.fileInfo.size || 0), 0);
  const totalFaces = queue.reduce((sum, item) => sum + item.regions.length, 0);
  const pendingCount = queue.filter((item) => !item.isAiProcessed).length;

  const handleStartDownload = async () => {
    if (!isConfirmed || isProcessing) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setProgress({
      current: 0,
      total: queue.length,
      message: '일괄 처리를 준비 중입니다...',
      percent: 0,
    });

    try {
      const zipBlob = await createBatchZip(queue, (p) => setProgress(p), selectedFormat);

      // 브라우저 다운로드 트리거
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      link.download = `얼수_학생사진_일괄블러_${dateStr}.zip`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);

      setIsCompleted(true);
    } catch (err: any) {
      console.error('ZIP 생성 오류:', err);
      setErrorMsg(err.message || 'ZIP 생성 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setIsConfirmed(false);
    setIsCompleted(false);
    setProgress(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-5 text-blue-600">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">전체 사진 일괄 다운로드 (ZIP)</h3>
            <p className="text-xs text-gray-500 font-medium">총 {queue.length}장의 사진을 압축 파일로 한번에 저장합니다</p>
          </div>
        </div>

        {/* 요약 박스 */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2.5 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-400 font-medium mb-0.5">총 사진 수</div>
              <div className="text-sm font-bold text-gray-800">{queue.length}장</div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-400 font-medium mb-0.5">총 가림 얼굴</div>
              <div className="text-sm font-bold text-blue-600">{totalFaces}명</div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-400 font-medium mb-0.5">예상 원본 용량</div>
              <div className="text-sm font-bold text-gray-800">{formatBytes(totalOriginalBytes)}</div>
            </div>
          </div>

          {/* 포맷 선택 */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200/60">
            <span className="text-xs text-gray-600 font-medium">저장 포맷</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedFormat('original')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedFormat === 'original'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300/70'
                }`}
              >
                각 사진 원본유지
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedFormat('jpeg')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedFormat === 'jpeg'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300/70'
                }`}
              >
                전체 JPG
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setSelectedFormat('png')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedFormat === 'png'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300/70'
                }`}
              >
                전체 PNG
              </button>
            </div>
          </div>
        </div>

        {/* 아직 백그라운드 탐색 중인 사진이 있는 경우 안내 */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 text-xs font-bold animate-pulse mt-0.5">
              ⏳
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 mb-0.5">
                AI 얼굴 탐색 진행 중 ({queue.length - pendingCount}/{queue.length} 완료)
              </div>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                현재 <span className="font-bold">{pendingCount}장</span>의 사진에서 AI가 얼굴을 순차적으로 탐색 중입니다. 탐색이 완료되면 얼굴 가림 영역이 완전히 적용됩니다.
              </div>
            </div>
          </div>
        )}

        {/* 주의사항 */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 text-orange-700 font-bold text-sm mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            일괄 다운로드 전 확인사항
          </div>
          <p className="text-gray-700 text-xs leading-relaxed mb-2">
            AI가 모든 사진의 얼굴을 100% 탐색하지 못할 수 있습니다. 각 사진 썸네일을 클릭하여 <span className="font-bold text-gray-900">누락된 학생 얼굴이 없는지 최종 검토</span> 후 다운로드하시길 권장합니다.
          </p>
        </div>

        {/* 진행률 바 (처리 중일 때) */}
        {isProcessing && progress && (
          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 mb-5">
            <div className="flex justify-between items-center text-xs font-bold text-blue-800 mb-2">
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-blue-200/60 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* 완료 상태 안내 */}
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
              ✓
            </div>
            <div>
              <div className="text-sm font-bold text-green-900">압축 다운로드가 완료되었습니다!</div>
              <div className="text-xs text-green-700">다운로드 폴더에서 ZIP 파일을 확인하세요.</div>
            </div>
          </div>
        )}

        {/* 에러 상태 안내 */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        {!isCompleted && !isProcessing && (
          <label className="flex items-center gap-3 mb-6 cursor-pointer group">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-gray-800 font-bold text-sm group-hover:text-blue-600 transition-colors">
              모든 사진의 가림 상태를 확인했습니다 (일괄 다운로드)
            </span>
          </label>
        )}

        {/* 버튼 영역 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all text-sm disabled:opacity-50"
          >
            {isCompleted ? '닫기' : '취소'}
          </button>
          {!isCompleted && (
            <button
              type="button"
              onClick={handleStartDownload}
              disabled={!isConfirmed || isProcessing}
              className={`flex-1 py-3.5 font-bold rounded-2xl transition-all text-sm shadow-md flex items-center justify-center gap-2 ${
                isConfirmed && !isProcessing
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  압축 파일 생성 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  ZIP 다운로드 실행
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchZipModal;
