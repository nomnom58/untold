import React from 'react';
import { CURRENT_TOPIC } from '../constants';

interface TopicCardProps {
  onNext: () => void;
}

const TopicCard: React.FC<TopicCardProps> = ({ onNext }) => {
  return (
    <div className="relative w-[550px] max-w-full bg-[#1A1A1A] rounded-none p-4 md:p-5 shadow-[0px_20px_60px_rgba(0,0,0,0.3)] overflow-hidden mx-auto flex flex-col justify-end h-[calc(100dvh-220px)] md:h-[70dvh] confession-card">
      {/* Decorative Ribbon Overlay */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br from-[#4A90E2] to-[#FF6B9D] opacity-20 blur-3xl rotate-45 transform" />
      </div>

      <div className="relative z-10">
        {/* Main Topic Header - Updated to 20px, margin-bottom tightened to 16px */}
        <div className="inline-block bg-[#FF5722] text-white text-[20px] font-medium py-[5px] px-[8px] rounded-none mb-4 uppercase tracking-tight">
          TOPIC WEEKLY: LOVE
        </div>
        
        {/* Subtopic intentionally hidden for MVP; may be re-enabled later. */}
        {/* 
        <h1 className="text-[48px] leading-[1.1] font-medium text-white mb-2">
          {CURRENT_TOPIC.headline}
        </h1> 
        */}
        
        {/* Inspiration Guidance Block - Tightened spacing between title and suggestions to 16px */}
        <div className="space-y-4">
          <h2 className="text-[32px] md:text-[40px] leading-[1.1] font-normal text-white">
            Need inspiration?<br />
            You could write about…
          </h2>

          <div className="text-[20px] leading-[26px] md:text-[24px] md:leading-[32px] font-normal text-white/70 max-w-[450px]">
            <p>
              Something you’ve never said out loud<br />
              A truth you’re still hiding from someone<br />
              A moment you replay in your head more than you admit or a decision you regret — or one you’re still unsure about
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicCard;