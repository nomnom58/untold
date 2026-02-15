import React from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = React.useState(1);

  if (step === 1) {
    return (
      <div className="relative w-[550px] max-w-full bg-[#1A1A1A] rounded-none shadow-[0px_20px_60px_rgba(0,0,0,0.4)] overflow-hidden shrink-0 mx-auto h-[calc(100dvh-220px)] md:h-[70dvh] confession-card">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
        <div className="relative h-full flex flex-col justify-end p-[20px] z-10">
          <img src="/logo2.png?v=onb1" width={208} height={32} className="relative z-10 mb-[20px]" style={{ width: '208px', maxWidth: '100%', height: 'auto' }} />
          <h1 className="text-[32px] md:text-[48px] font-medium text-white leading-tight mb-0">A safe space to share what you’ve never said out loud</h1>
          <button 
            onClick={() => setStep(2)}
            className="w-full mt-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-[550px] max-w-full bg-[#1A1A1A] rounded-none shadow-[0px_20px_60px_rgba(0,0,0,0.4)] overflow-hidden shrink-0 mx-auto h-[calc(100dvh-220px)] md:h-[70dvh] confession-card">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>
      <div className="relative h-full flex flex-col justify-end p-[20px] z-10">
        <div className="space-y-2 mb-0">
          {[
            "One new topic every week",
            "Share 100% anonymously",
            "Your post disappears after 3 days"
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#4CAF50] flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <span className="text-[20px] md:text-[24px] text-[#FFFFFF] font-normal leading-tight" style={{ fontWeight: 400 }}>{text}</span>
            </div>
          ))}
          <h1 className="text-[32px] md:text-[48px] font-medium text-white leading-tight mb-0">How Untold keeps you anonymous</h1>
        </div>
        <button 
          onClick={onComplete}
          className="w-full mt-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default Onboarding;