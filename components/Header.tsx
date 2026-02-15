import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    // Navigate home with a state flag to trigger index reset
    navigate('/', { 
      state: { 
        resetToTopic: true,
        activeTab: 'home'
      } 
    });
  };

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          /* Task: Hide bottom overlay on mobile */
          /* Targeted hide for the gradient overlay in Home.tsx */
          .bg-gradient-to-t.from-black.to-transparent {
            display: none !important;
          }
        }
      `}</style>
      <header className="fixed top-0 left-0 right-0 h-20 z-[200] bg-transparent pointer-events-auto">
        <div className="max-w-[550px] mx-auto h-full flex items-center justify-between px-4 md:px-0">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={handleLogoClick}
            role="button"
            aria-label="Go to Home"
          >
            <div className="w-auto h-8 flex items-center justify-center">
              <img src="/logo2.png" width={184} height={32} alt="Untold" className="app-logo" />
            </div>
          </div>

          <button 
            onClick={() => navigate('/write')}
            className="bg-white text-black p-2 rounded-xl font-medium text-[16px] flex items-center gap-1 transition-colors hover:bg-gray-100 outline-none write-confession-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Write confession
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;