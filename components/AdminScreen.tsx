import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ADMIN_INTENT_KEY = 'untold_admin_intent';
const ADMIN_TTL_MS = 30 * 60 * 1000;
const ADMIN_UNLOCK_KEY = "untold_admin_unlocked_until";
const ADMIN_SESSION_KEY = "admin_key_session";

interface SeedItem {
  id: string;
  title: string;
  body: string;
}

interface SeederReceipt {
  type: 'info' | 'success' | 'error';
  message: string;
  ts: number;
}

// --- Date Helpers ---
const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return '...';
  return dateStr;
};

const AdminScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'moderation' | 'seeder'>('moderation');
  const [passcode, setPasscode] = useState('');
  const [confessions, setConfessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Dev Mode State
  const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem('is_dev_mode') === 'true');

  const toggleDevMode = useCallback(() => {
    const newVal = !isDevMode;
    setIsDevMode(newVal);
    localStorage.setItem('is_dev_mode', String(newVal));
  }, [isDevMode]);

  // Read fallback status from Home feed
  const fallbackStatus = useMemo(() => {
    try {
      const stored = localStorage.getItem('untold_feed_fallback_status_v1');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // --- Metrics Date Range Applied State ---
  const [metricsDateFrom, setMetricsDateFrom] = useState(() => 
    localStorage.getItem('metrics_date_from') || getTodayStr()
  );
  const [metricsDateTo, setMetricsDateTo] = useState(() => 
    localStorage.getItem('metrics_date_to') || getTodayStr()
  );
  const [minDate, setMinDate] = useState(getTodayStr());

  // --- Picker UI State ---
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(metricsDateFrom);
  const [draftTo, setDraftTo] = useState<string | null>(metricsDateTo);
  const [viewDate, setViewDate] = useState(new Date()); // Controls which months are shown in picker
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync draft with applied when opening
  useEffect(() => {
    if (isPickerOpen) {
      setDraftFrom(metricsDateFrom);
      setDraftTo(metricsDateTo);
      // Center view on "From" date if possible
      setViewDate(new Date(metricsDateFrom + 'T12:00:00'));
    }
  }, [isPickerOpen, metricsDateFrom, metricsDateTo]);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  // --- Seeder State ---
  const [rawSeedText, setRawSeedText] = useState('');
  const [seedItems, setSeedItems] = useState<SeedItem[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seederReceipt, setSeederReceipt] = useState<SeederReceipt | null>(null);

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState({ sessions: 0, views: 0, submits: 0 });

  const fetchDataOnly = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('confessions')
        .select('*')
        .is('reviewed_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setConfessions(data || []);
      
      // Filter ONLY events (metrics)
      const fromISO = new Date(metricsDateFrom + 'T00:00:00').toISOString();
      const toDateObj = new Date(metricsDateTo + 'T00:00:00');
      toDateObj.setDate(toDateObj.getDate() + 1);
      const toISO = toDateObj.toISOString();

      const { count: sessionCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'session_start')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);

      const { count: submitCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'submit_confession')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);

      const { count: viewCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'view_confession')
        .gte('created_at', fromISO)
        .lt('created_at', toISO);
      
      setMetrics({
        sessions: sessionCount || 0,
        views: viewCount || 0,
        submits: submitCount || 0
      });
    } catch (err: any) {
      setLastError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [metricsDateFrom, metricsDateTo]);

  // Initial minDate detection
  useEffect(() => {
    const fetchMinDate = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        if (data?.created_at && !error) {
          const d = new Date(data.created_at);
          setMinDate(d.toISOString().split('T')[0]);
        }
      } catch (e) {
        console.warn('Could not determine min event date');
      }
    };
    fetchMinDate();
  }, []);

  useEffect(() => {
    const checkUnlockStatus = () => {
      const storedUntil = localStorage.getItem(ADMIN_UNLOCK_KEY);
      if (storedUntil && parseInt(storedUntil, 10) > Date.now()) {
        setIsUnlocked(true);
        fetchDataOnly();
      }
    };
    checkUnlockStatus();
  }, [fetchDataOnly]);

  const handleApplyRange = () => {
    if (draftFrom && draftTo) {
      setMetricsDateFrom(draftFrom);
      setMetricsDateTo(draftTo);
      localStorage.setItem('metrics_date_from', draftFrom);
      localStorage.setItem('metrics_date_to', draftTo);
      setIsPickerOpen(false);
    }
  };

  const handleDayClick = (dateStr: string) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(dateStr);
      setDraftTo(null);
    } else {
      if (dateStr < draftFrom) {
        setDraftTo(draftFrom);
        setDraftFrom(dateStr);
      } else {
        setDraftTo(dateStr);
      }
    }
  };

  const renderCalendarMonth = (baseDate: Date) => {
    const month = baseDate.getMonth();
    const year = baseDate.getFullYear();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = getTodayStr();
    const days = [];
    
    // Header for Month
    const monthName = baseDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Fill blanks
    for (let i = 0; i < firstDay; i++) days.push(<div key={`blank-${i}`} />);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toLocaleDateString('en-CA');
      const isDisabled = dateStr < minDate || dateStr > today;
      const isSelected = dateStr === draftFrom || dateStr === draftTo;
      const isInRange = draftFrom && draftTo && dateStr > draftFrom && dateStr < draftTo;
      const isToday = dateStr === today;

      days.push(
        <button
          key={dateStr}
          disabled={isDisabled}
          onClick={() => handleDayClick(dateStr)}
          className={`w-8 h-8 md:w-10 md:h-10 text-[13px] font-bold rounded-lg flex items-center justify-center transition-all
            ${isDisabled ? 'opacity-10 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100'}
            ${isToday && !isSelected && !isInRange ? 'bg-[#E9E9FF]' : ''}
            ${isSelected ? 'bg-black text-white hover:bg-black/80' : ''}
            ${isInRange ? 'bg-black/5 text-black' : ''}
          `}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <h4 className="text-[14px] font-black uppercase text-center">{monthName}</h4>
        <div className="grid grid-cols-7 gap-1">
          {['S','M','T','W','T','F','S'].map(d => (
            <div key={d} className="text-[10px] font-black text-black/30 text-center py-2">{d}</div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  const handleUnlock = () => {
    const trimmed = passcode.trim();
    const secret = (process.env as any).ADMIN_PASSCODE;
    const hasInternalWhitespace = /\s/.test(trimmed);
    
    // Validate format first: min 8 characters and no internal spaces
    const passesFormat = trimmed.length >= 8 && !hasInternalWhitespace;
    
    // Strictly require and match the environment variable ADMIN_PASSCODE
    const isValid = passesFormat && secret && trimmed === secret;

    if (isValid) {
      const expiration = Date.now() + ADMIN_TTL_MS;
      localStorage.setItem(ADMIN_UNLOCK_KEY, expiration.toString());
      localStorage.setItem(ADMIN_INTENT_KEY, '1');
      sessionStorage.setItem(ADMIN_SESSION_KEY, trimmed); 
      setIsUnlocked(true);
      setLastError(null);
      fetchDataOnly();
    } else {
      setLastError("Incorrect passcode.");
    }
  };

  const handleAction = async (id: string, action: 'pass' | 'hide') => {
    const key = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!key) {
      setLastError('Admin session expired. Please unlock again.');
      setIsUnlocked(false);
      return false;
    }

    try {
      const rpcName = action === 'pass' ? 'admin_pass_confession' : 'admin_hide_confession';
      const { data, error } = await supabase.rpc(rpcName, { 
        p_id: id, 
        p_key: key 
      });
      
      if (error) throw error;
      
      setConfessions(prev => prev.filter(c => c.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return true;
    } catch (err: any) {
      setLastError(`Action failed: ${err.message}`);
      return false;
    }
  };

  const handleBulkAction = async (action: 'pass' | 'hide') => {
    const ids: string[] = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    setIsLoading(true);
    for (const id of ids) {
      await handleAction(id, action);
    }
    setIsLoading(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === confessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(confessions.map(c => c.id)));
    }
  };

  const handleActionAndAdvance = async (action: 'pass' | 'hide') => {
    if (reviewIndex === null || !confessions[reviewIndex]) return;
    const currentId = confessions[reviewIndex].id;
    const success = await handleAction(currentId, action);
    if (success) {
      if (reviewIndex >= confessions.length - 1) {
        setReviewIndex(null);
      }
    }
  };

  useEffect(() => {
    if (reviewIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') handleActionAndAdvance('pass');
      if (e.key.toLowerCase() === 'h') handleActionAndAdvance('hide');
      if (e.key === 'Escape') setReviewIndex(null);
      if (e.key === 'ArrowRight') setReviewIndex(prev => prev !== null && prev < confessions.length - 1 ? prev + 1 : prev);
      if (e.key === 'ArrowLeft') setReviewIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewIndex, confessions]);

  const handleParseSeed = () => {
    const raw = rawSeedText.trim();
    if (!raw) {
      setSeedItems([]);
      setSeederReceipt({ type: 'info', message: 'No input to parse.', ts: Date.now() });
      return;
    }

    const dashLineRegex = /\n\s*-{2,}\s*(\n|$)/;
    let blocks: string[] = [];

    if (dashLineRegex.test(raw)) {
      blocks = raw.split(/\n\s*-{2,}\s*(?:\n|$)/).map(b => b.trim()).filter(b => b.length > 0);
    } else {
      blocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0);
    }

    const parsed = blocks.map((block, i) => {
      const allLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      const contentLines = allLines.filter(line => !line.match(/^(title|body|confession)\s*\d*\s*:?$/i));

      if (contentLines.length === 0) return null;

      if (contentLines.length >= 2) {
        return {
          id: Math.random().toString(36).substring(2),
          title: contentLines[0],
          body: contentLines.slice(1).join('\n')
        };
      } else {
        return {
          id: Math.random().toString(36).substring(2),
          title: '', 
          body: contentLines[0]
        };
      }
    }).filter(Boolean) as SeedItem[];

    setSeedItems(parsed);
    setSeederReceipt({ 
      type: 'success', 
      message: parsed.length > 0 ? `Parsed ${parsed.length} items.` : "No items found in input.", 
      ts: Date.now() 
    });
  };

  const handleBulkSeeding = async () => {
    const key = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!key || seedItems.length === 0) return;

    setIsSeeding(true);
    try {
      const payload = seedItems.map(item => ({
        title: item.title.trim() || null,
        body: item.body.trim()
      }));

      const { error } = await supabase
        .from('confessions')
        .insert(payload);

      if (error) throw error;

      setSeederReceipt({ 
        type: 'success', 
        message: `Successfully seeded ${seedItems.length} entries.`, 
        ts: Date.now() 
      });
      
      setSeedItems([]);
      setRawSeedText('');
    } catch (err: any) {
      console.error('[Bulk Seed Error]', err);
      setSeederReceipt({ type: 'error', message: err.message, ts: Date.now() });
    } finally {
      setIsSeeding(false);
    }
  };

  const DevModeBanner = (
    <div 
      onClick={toggleDevMode}
      className="mb-10 w-full bg-black text-white p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer border-2 border-[#00FF00]/10 hover:border-[#00FF00]/40 transition-all group shadow-2xl"
    >
      <div className="text-center md:text-left">
        <h3 className="text-2xl font-black uppercase tracking-tight mb-1">Dev mode is OFF</h3>
        <p className="text-white/50 text-sm font-medium">Enable Dev mode to unlock Seeder & developer tools.</p>
      </div>
      <button className="bg-[#00FF00] text-black px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest group-hover:scale-105 transition-transform active:scale-95 shadow-lg">
        Enable Dev mode
      </button>
    </div>
  );

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#848484]">
        <div className="p-8 bg-white rounded-[32px] shadow-2xl w-96 animate-in fade-in zoom-in-95 duration-300">
          <h2 className="text-2xl font-black mb-6 text-black tracking-tight uppercase">Admin Access</h2>
          <input 
            type="password" 
            value={passcode} 
            onChange={(e) => setPasscode(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="Passcode"
            className="w-full p-4 border-2 border-black/10 rounded-2xl mb-4 outline-none focus:border-black transition-colors font-mono"
          />
          <button 
            onClick={handleUnlock}
            className="w-full bg-black text-white p-4 rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-[0.98]"
          >
            Unlock Dashboard
          </button>
          {lastError && <p className="text-red-500 mt-4 text-xs font-bold text-center uppercase tracking-widest">{lastError}</p>}
        </div>
      </div>
    );
  }

  const nextMonthDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);

  return (
    <div className="w-full h-full bg-white flex flex-col p-6 overflow-y-auto custom-scrollbar text-black z-[100]">
      <div className="max-w-[900px] mx-auto w-full">
        <div className="flex items-center justify-between mb-8 border-b-4 border-black pb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl font-black tracking-tighter">ADMIN</h1>
            <span className="text-xs font-bold text-black/30 uppercase tracking-widest">v2.0 Beta</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/70">Dev Mode</span>
              <button 
                onClick={toggleDevMode}
                className={`w-10 h-5 rounded-full relative transition-colors ${isDevMode ? 'bg-green-600' : 'bg-black/30'}`}
                aria-label="Toggle Dev Mode"
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isDevMode ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <button 
              onClick={() => { localStorage.removeItem(ADMIN_INTENT_KEY); navigate('/'); }} 
              className="px-6 py-2 bg-black text-white text-[12px] font-bold rounded-xl hover:bg-black/80 transition-all active:scale-95"
            >
              Exit System
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-10 p-1.5 bg-gray-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('moderation')} 
            className={`px-8 py-3 rounded-xl text-[14px] font-bold transition-all ${activeTab === 'moderation' ? 'bg-black text-white shadow-lg' : 'text-black/40 hover:text-black/60'}`}
          >
            Moderation Queue
          </button>
          <button 
            onClick={() => setActiveTab('seeder')} 
            className={`px-8 py-3 rounded-xl text-[14px] font-bold transition-all ${activeTab === 'seeder' ? 'bg-black text-white shadow-lg' : 'text-black/40 hover:text-black/60'}`}
          >
            Database Seeder
          </button>
        </div>

        {activeTab === 'moderation' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isDevMode && DevModeBanner}
            
            <div className="flex flex-col gap-2 mb-2 relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Date range
              </label>
              
              <div 
                className="flex items-center bg-gray-100 rounded-xl px-6 py-3 border-2 border-transparent hover:bg-gray-200 transition-all w-fit cursor-pointer select-none shadow-sm"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
              >
                <span className="text-[14px] font-black tracking-tight">
                  {metricsDateFrom} → {metricsDateTo}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-4 opacity-30"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>

              {isPickerOpen && (
                <div 
                  ref={pickerRef}
                  className="absolute top-full left-0 mt-4 bg-white rounded-[32px] shadow-[0px_32px_80px_rgba(0,0,0,0.25)] border border-black/5 p-8 z-[300] w-[90vw] max-w-[700px] animate-in slide-in-from-top-4 duration-300"
                >
                  <div className="flex flex-col md:flex-row gap-12 mb-8">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-6">
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                        {renderCalendarMonth(viewDate)}
                        <div className="w-8 h-8" /> {/* Spacer */}
                      </div>
                    </div>
                    <div className="hidden md:block w-px bg-black/5" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-6">
                        <div className="w-8 h-8" /> {/* Spacer */}
                        {renderCalendarMonth(nextMonthDate)}
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-black/5 pt-8">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-4 mb-1">
                        <span className="text-[14px] font-black uppercase text-black/30">Start: <span className="text-black">{formatDateLabel(draftFrom || '')}</span></span>
                        <span className="text-[14px] font-black uppercase text-black/30">End: <span className="text-black">{formatDateLabel(draftTo || '')}</span></span>
                      </div>
                      <p className="text-[12px] font-medium" style={{ color: '#4B4B4B' }}>
                        Data from {minDate} · Today: {getTodayStr()}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setIsPickerOpen(false)}
                        className="px-6 py-3 rounded-xl text-[12px] font-bold text-black/40 hover:text-black transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        disabled={!draftFrom || !draftTo}
                        onClick={handleApplyRange}
                        className="px-8 py-3 bg-black text-white rounded-xl text-[12px] font-bold shadow-lg hover:bg-black/80 transition-all active:scale-95 disabled:opacity-20"
                      >
                        OK, Apply Range
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-[32px] border border-black/5 relative group">
                <div className="flex items-center gap-1.5 mb-1 group/tooltip relative">
                  <p className="text-[12px] font-bold text-black/40 uppercase tracking-widest">App Opens</p>
                  <span className="text-[10px] text-black/30 cursor-help">ⓘ</span>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block bg-black text-white text-[13px] px-3 py-2 rounded-lg whitespace-nowrap z-[110] shadow-xl pointer-events-none font-normal tracking-normal">
                    Sessions from {metricsDateFrom} to {metricsDateTo}.
                  </div>
                </div>
                <p className="text-4xl font-black">{metrics.sessions}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-[32px] border border-black/5 relative group">
                <div className="flex items-center gap-1.5 mb-1 group/tooltip relative">
                  <p className="text-[12px] font-bold text-black/40 uppercase tracking-widest">Confession Views</p>
                  <span className="text-[10px] text-black/30 cursor-help">ⓘ</span>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block bg-black text-white text-[13px] px-3 py-2 rounded-lg whitespace-nowrap z-[110] shadow-xl pointer-events-none font-normal tracking-normal">
                    Views from {metricsDateFrom} to {metricsDateTo}.
                  </div>
                </div>
                <p className="text-4xl font-black">{metrics.views}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-[32px] border border-black/5 relative group">
                <div className="flex items-center gap-1.5 mb-1 group/tooltip relative">
                  <p className="text-[12px] font-bold text-black/40 uppercase tracking-widest">Confession Submits</p>
                  <span className="text-[10px] text-black/30 cursor-help">ⓘ</span>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block bg-black text-white text-[13px] px-3 py-2 rounded-lg whitespace-nowrap z-[110] shadow-xl pointer-events-none font-normal tracking-normal">
                    Submissions from {metricsDateFrom} to {metricsDateTo}.
                  </div>
                </div>
                <p className="text-4xl font-black">{metrics.submits}</p>
              </div>
            </div>

            {fallbackStatus?.active && (
              <div className="bg-red-600 text-white p-6 rounded-[32px] border border-white/10 shadow-lg flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-[14px] font-black uppercase tracking-tight">⚠️ FEED ĐANG CHẠY FALLBACK DO BATCH LỖI</h3>
                <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest">Lỗi gần nhất: {fallbackStatus.lastError || 'none'}</p>
              </div>
            )}

            <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md py-4 z-20 border-b border-black/5">
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedIds.size === confessions.length && confessions.length > 0 ? 'bg-black border-black' : 'border-black/20'}`}>
                    {selectedIds.size === confessions.length && confessions.length > 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                  {selectedIds.size === confessions.length && confessions.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <button onClick={() => handleBulkAction('pass')} className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-colors">Approve Selected</button>
                    <button onClick={() => handleBulkAction('hide')} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors">Hide Selected</button>
                  </div>
                )}
              </div>
              <div className="text-xs font-bold text-black/20 uppercase tracking-widest">
                Queue: {confessions.length} pending
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pb-20">
              {confessions.length === 0 && !isLoading && (
                <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[40px]">
                  <p className="text-black/30 font-bold uppercase tracking-widest">All caught up!</p>
                </div>
              )}
              {confessions.map((c, idx) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <div 
                    key={c.id} 
                    className={`group border-2 transition-all p-5 rounded-[28px] flex items-center gap-6 cursor-pointer ${isSelected ? 'border-black bg-black/[0.02]' : 'border-black/5 hover:border-black/20 bg-white'}`}
                    onClick={() => setReviewIndex(idx)}
                  >
                    <div className="shrink-0" onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-black border-black' : 'border-black/10 group-hover:border-black/30'}`}>
                        {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-black text-black text-[17px] truncate leading-tight">{c.title || "(Untitled Confession)"}</h4>
                        <span className="text-[10px] font-bold text-black/20 uppercase bg-black/5 px-2 py-0.5 rounded">ID: {c.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-[14px] text-black/40 line-clamp-1 leading-relaxed">{c.body || c.content}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      <button onClick={(e) => { e.stopPropagation(); handleAction(c.id, 'pass'); }} className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                      <button onClick={(e) => { e.stopPropagation(); handleAction(c.id, 'hide'); }} className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {!isDevMode ? (
              DevModeBanner
            ) : (
              <>
                <div className="bg-gray-50 p-8 rounded-[40px] border border-black/5">
                  <textarea 
                    value={rawSeedText}
                    onChange={(e) => setRawSeedText(e.target.value)}
                    placeholder="Title 1&#10;Body 1...&#10;--&#10;Title 2&#10;Body 2..."
                    className="w-full h-64 p-6 border-2 border-black/10 rounded-3xl font-mono text-[14px] focus:border-black outline-none mb-6 resize-none custom-scrollbar bg-white shadow-inner"
                  />
                  <div className="flex items-center gap-4">
                    <button onClick={handleParseSeed} className="bg-black text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-black/80 transition-all active:scale-95 shadow-lg">Parse Preview ({seedItems.length})</button>
                  </div>
                  {seederReceipt && (
                    <div className={`mt-6 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest ${seederReceipt.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {seederReceipt.message}
                    </div>
                  )}
                </div>

                {seedItems.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-4 sticky top-0 bg-white/80 backdrop-blur-md py-4 z-10 border-b border-black/5">
                      <h3 className="text-lg font-black uppercase tracking-widest text-black/40">Parsing Result ({seedItems.length})</h3>
                      <button onClick={handleBulkSeeding} disabled={isSeeding} className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-green-700 transition-all active:scale-95 shadow-lg disabled:opacity-50">
                        {isSeeding ? 'Seeding...' : `Commit ${seedItems.length} Entries`}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {seedItems.map((item, i) => (
                        <div key={item.id} className="bg-white border-2 border-black/5 rounded-[28px] p-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                             <span className="text-[10px] font-black bg-black text-white px-2 py-1 rounded">ITEM {i+1}</span>
                             {item.title && <h4 className="font-black text-lg">{item.title}</h4>}
                          </div>
                          <p className="text-[15px] text-black/80 whitespace-pre-wrap leading-relaxed">{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {reviewIndex !== null && confessions[reviewIndex] && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={(e) => e.target === e.currentTarget && setReviewIndex(null)}>
          <div className="w-full max-w-[850px] bg-white rounded-[48px] shadow-[0px_40px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-400">
            <div className="flex items-center justify-between px-10 py-8 border-b border-black/5 shrink-0 bg-white">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mb-1">Moderation Review</span>
                <span className="text-[18px] font-black tracking-tight">Record {reviewIndex + 1} of {confessions.length}</span>
              </div>
              <button onClick={() => setReviewIndex(null)} className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-black/5 text-black/40 hover:text-black transition-all"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white">
               <div className="max-w-[650px] mx-auto">
                 <h2 className="text-4xl font-black mb-8 leading-tight tracking-tight" style={{ color: ["#3902FF", "#8800FF", "#E43630", "#FA700D"][reviewIndex % 4] }}>{confessions[reviewIndex].title || "Untitled Confession"}</h2>
                 <p className="text-[22px] text-black/80 leading-relaxed whitespace-pre-wrap font-medium">{confessions[reviewIndex].body || confessions[reviewIndex].content}</p>
               </div>
            </div>
            <div className="px-10 py-10 bg-gray-50 border-t border-black/5 flex items-center gap-6 shrink-0">
              <button onClick={() => handleActionAndAdvance('pass')} className="flex-1 py-6 bg-green-600 text-white rounded-[24px] font-black text-lg hover:bg-green-700 transition-all shadow-xl shadow-green-600/20">APPROVE (P)</button>
              <button onClick={() => handleActionAndAdvance('hide')} className="flex-1 py-6 bg-red-600 text-white rounded-[24px] font-black text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-600/20">HIDE (H)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminScreen;
