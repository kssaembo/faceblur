
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-100 py-4 px-6 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">쉽고 간단하게 얼수(얼굴수정)</h1>
            <p className="text-[15px] text-blue-600 uppercase font-bold tracking-widest">학생 사진 얼굴 쉽게 가리기</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
