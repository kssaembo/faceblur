
import React, { useState } from 'react';

const Footer: React.FC = () => {
  const [modalContent, setModalContent] = useState<'terms' | 'privacy' | null>(null);

  const policies = {
    terms: {
      title: "이용약관",
      content: `1. 목적: 본 서비스는 아동 및 학생의 프라이버시 보호를 위해 얼굴 블러/모자이크 처리를 지원하는 도구이며, 교육적 및 개인적 목적으로만 제공됩니다.

2. 책임의 한계: AI 기술의 특성상 얼굴 감지는 100% 완벽하지 않을 수 있습니다. 인식되지 않은 얼굴에 대한 최종 확인 및 추가 편집의 책임은 전적으로 사용자에게 있으며, 본 서비스는 편집 누락으로 인해 발생한 문제에 대해 책임을 지지 않습니다.

3. 데이터 소유권 및 권한: 사용자가 업로드한 원본 이미지와 처리된 결과물에 대한 모든 권리는 사용자에게 귀속됩니다. 본 서비스는 사용자의 데이터를 복제, 저장, 또는 제3자에게 제공할 권한을 갖지 않습니다.

4. 사용 환경: 본 서비스는 클라이언트 측 실행(Client-side processing) 방식을 채택하여, 모든 처리는 사용자의 기기 내 로컬 환경에서 수행됩니다.`
    },
    privacy: {
      title: "개인정보 보호정책",
      content: `1. 무저장 원칙: 본 서비스는 'No-Server' 원칙을 고수합니다. 업로드된 이미지는 서버로 전송되지 않으며, 브라우저 종료 시 메모리에서 즉시 소멸됩니다.

2. 로컬 AI 처리: 얼굴 인식 AI 모델은 사용자의 브라우저에 임시 로드되어 실행됩니다. 모든 분석 프로세스는 사용자 기기 내부에서 완료되므로 이미지 데이터가 외부 네트워크로 유출될 가능성을 원천 차단합니다.

3. 수집 정보 제로: 본 서비스는 개인을 식별할 수 있는 정보(이름, 이메일, IP 등)를 수집하지 않으며, 분석을 위한 쿠키 또한 사용하지 않습니다.

4. 기술적 안전성: 최신 웹 표준 API를 사용하여 외부 공격으로부터 사용자 데이터를 보호하며, 별도의 로그 기록조차 남기지 않는 완전한 익명 서비스를 지향합니다.`
    }
  };

  return (
    <footer className="bg-white border-t border-gray-100 py-8 mt-auto">
      <div className="container mx-auto px-6 text-center">
        <p className="text-gray-500 text-sm mb-4">
          모든 데이터는 서버에 저장되지 않으며 브라우저에서 로컬 형태로 처리됩니다.
        </p>
        <div className="flex justify-center gap-6 mb-4 text-xs font-semibold text-gray-400">
          <button onClick={() => setModalContent('terms')} className="hover:text-blue-600">이용약관</button>
          <button onClick={() => setModalContent('privacy')} className="hover:text-blue-600">개인정보 보호정책</button>
        </div>
        <p className="text-gray-400 text-[11px]">
          ⓒ 2025. Kwon's class. All rights reserved.
        </p>
      </div>

      {modalContent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">{policies[modalContent].title}</h3>
            <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mb-6 max-h-[60vh] overflow-y-auto">
              {policies[modalContent].content}
            </div>
            <button 
              onClick={() => setModalContent(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
