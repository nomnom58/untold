
import React, { useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import WriteScreen from './components/WriteScreen';
import YourPosts from './components/YourPosts';
import AdminScreen from './components/AdminScreen';
import { supabase, trackEvent } from './lib/supabase';

const ANON_ID_KEY = 'untold_anon_id';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // SESSION METRICS: In-memory only
  const sessionIdRef = useRef<string>(crypto.randomUUID?.() || Math.random().toString(36).substring(2));
  const hasLoggedEndRef = useRef<boolean>(false);

  // Identify if we are on the admin path to isolate rendering
  const isAdminPath = location.pathname === '/2-hon-dai-tim-tai' || location.pathname === '/admin';

  // ANONYMOUS TRACKING LOGIC
  useEffect(() => {
    // 1. Retrieve or generate Persistent Anon ID (for unique user metrics)
    let anonId = localStorage.getItem(ANON_ID_KEY);
    if (!anonId) {
      anonId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
      localStorage.setItem(ANON_ID_KEY, anonId);
    }

    const sessionId = sessionIdRef.current;

    // 2. Log Session Start
    const logSessionStart = async () => {
      trackEvent('session_start', { anon_id: anonId, session_id: sessionId, screen: "home" });
    };
    logSessionStart();

    // 3. Log Session End Utility (Once only)
    const logSessionEnd = () => {
      if (hasLoggedEndRef.current) return;
      hasLoggedEndRef.current = true;
      const meta = { anon_id: anonId, session_id: sessionId };
      trackEvent('session_end', meta, { useFetch: true });
    };

    // 4. Lifecycle Listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        logSessionEnd();
      }
    };

    window.addEventListener('beforeunload', logSessionEnd);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      logSessionEnd(); // Cleanup on unmount
      window.removeEventListener('beforeunload', logSessionEnd);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isAdminPath) {
    return (
      <Routes>
        <Route path="/2-hon-dai-tim-tai" element={<AdminScreen />} />
        <Route path="/admin" element={<Navigate to="/2-hon-dai-tim-tai" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div 
      className="w-full h-[100dvh] max-h-[100dvh] fixed inset-0 touch-none overflow-hidden flex flex-col"
      style={{ backgroundImage: 'url(/bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      <Header />
      
      <main className="relative flex-1 h-0 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/write" element={<WriteScreen onPost={() => {}} />} />
          <Route path="/your-posts" element={<YourPosts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
