import React, { useEffect } from 'react';

interface SuccessPopupProps {
  onClose: () => void;
  onSeePost: () => void;
}

const SuccessPopup: React.FC<SuccessPopupProps> = ({ onClose, onSeePost }) => {
  // Handle Escape key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-[480px] max-h-[90dvh] overflow-y-auto custom-scrollbar bg-white rounded-[32px] p-4 md:p-[20px] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-start text-left md:items-start md:text-left">
        {/* Success Icon: White checkmark in green circle - Updated mobile margin to 24px, laptop margin to 32px */}
        <div className="w-[48px] h-[48px] md:w-[64px] md:h-[64px] rounded-full bg-[#4CAF50] flex items-center justify-center mb-[24px] md:mb-[32px] ml-0 md:ml-0 shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        {/* Title Text Block - Updated mobile spacing to 24px, laptop spacing to 32px */}
        <div className="mb-[24px] md:mb-[32px] flex flex-col gap-2 items-start text-left md:items-start md:text-left">
          {/* Success text is green - Responsive size and font weight 500 */}
          <h2 className="text-[24px] md:text-[32px] font-medium text-[#4CAF50] leading-tight m-0">
            Success
          </h2>
          <h2 className="text-[24px] md:text-[32px] font-medium text-[#1A1A1A] leading-tight m-0">
            Your story is now live
          </h2>
          <p className="text-[18px] md:text-[20px] text-black/50 font-normal m-0 mt-2">
            People can now read and react to your confession.
          </p>
        </div>

        {/* Action Button: Left-aligned for all screen sizes */}
        <div className="w-full flex justify-start md:justify-start">
          <button 
            onClick={onSeePost}
            className="w-fit p-[16px] bg-[#1A1A1A] text-white rounded-[14px] font-bold text-[16px] shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all outline-none ml-0 md:ml-0 md:mx-0"
          >
            See your post
          </button>
        </div>

        {/* Small Close Icon Top Right for dismissing */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-black/5 rounded-full transition-colors text-black/40 hover:text-black outline-none"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SuccessPopup;