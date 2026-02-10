import React, { useEffect } from 'react';
import { Confession } from '../types';

interface FullReadingModalProps {
  confession: Confession;
  onClose: () => void;
}

const FullReadingModal: React.FC<FullReadingModalProps> = ({ confession, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-[700px] h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-black/5 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex-1">
             <span className="text-[12px] font-bold text-black/40 uppercase tracking-widest">Full Story</span>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-black/40 hover:text-black"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12">
          {confession.title && (
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-8 leading-tight">
              {confession.title}
            </h2>
          )}
          <p className="text-lg md:text-xl leading-[1.8] text-black/80 whitespace-pre-wrap font-normal">
            {confession.content}
          </p>
          
          <div className="mt-12 pt-8 border-t border-black/5">
             <p className="text-black/40 text-sm italic">
               Shared anonymously on {new Date(confession.createdAt).toLocaleDateString()}
             </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-black/[0.02] border-t border-black/5 flex justify-center">
          <button 
            onClick={onClose}
            className="px-10 py-3.5 bg-black text-white rounded-full font-bold text-base shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            Close Story
          </button>
        </div>
      </div>
    </div>
  );
};

export default FullReadingModal;