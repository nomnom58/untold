import React, { useEffect } from 'react';
import Button from './Button';

interface NoticePopupProps {
  isOpen: boolean;
  title: string;
  body: string;
  ctaText: string;
  onClose: () => void;
  onCta: () => void;
}

const NoticePopup: React.FC<NoticePopupProps> = ({
  isOpen,
  title,
  body,
  ctaText,
  onClose,
  onCta
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full max-w-[480px] bg-white rounded-[32px] p-5 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Close button at top-right */}
        <div className="flex justify-end mb-2">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40 hover:text-black outline-none"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content: Title and Body */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[24px] md:text-[32px] font-medium text-black leading-tight m-0">
            {title}
          </h2>
          <p className="text-[20px] font-normal leading-[26px] text-[#373737] m-0">
            {body}
          </p>
        </div>

        {/* Footer: CTA Button with responsive spacing */}
        <div className="mt-10 md:mt-16">
          <Button onClick={onCta}>
            {ctaText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoticePopup;