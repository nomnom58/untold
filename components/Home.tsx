// Restored Home.tsx to last known-good focus/open-reader behavior (do not modify without explicit approval).
/*
AI STUDIO DEV NOTE:
- Supabase ENV is managed in lib/supabase.ts with development fallbacks.
- Home uses the centralized supabase client for data fetching.
*/

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopicCard from './TopicCard';
import ConfessionCard from './ConfessionCard';
import FullReadingModal from './FullReadingModal';
import { Confession } from '../types';
import { useSwipeStage } from '../hooks/useSwipeStage';
import { TRANSITION_MS } from '../swipeConfig';
import { supabase, trackEvent as logEvent } from '../lib/supabase';

const ONBOARDING_KEY = 'untold_onboarding_done';
const POSTED_KEY = 'untold_has_posted';
const MY_POSTS_IDS_KEY = 'untold_my_post_ids_v1';
const GLOBAL_DB_KEY = 'untold_mock_db_v1';
const SEEN_IDS_KEY = 'seen_confession_ids';
const SEEN_IDS_V2_KEY = 'seen_confession_ids_v2';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ANON_ID_KEY = 'untold_anon_id';
const SESSION_ID_KEY = 'untold_session_id';

type TabType = 'your_post' | 'home';
type CardKind = 'onboarding1' | 'onboarding2' | 'topic' | 'confession' | 'empty' | 'end';

interface CardInfo {
  kind: CardKind;
  confession?: Confession;
}

function getCardType(
  index: number,
  activeTab: TabType,
  confessions: Confession[],
  myConfessions: Confession[],
  pinnedConfession: Confession | null
): CardInfo | null {
  if (activeTab === 'home') {
    if (index === 0) return { kind: 'onboarding1' };
    if (index === 1) return { kind: 'onboarding2' };
    if (index === 2) return { kind: 'topic' };
    
    let offset = 0;
    if (pinnedConfession) {
      if (index === 3) return { kind: 'confession', confession: pinnedConfession };
      offset = 1;
    }

    const listIndex = index - 3 - offset;
    if (listIndex >= 0 && listIndex < confessions.length) {
      const item = confessions[listIndex];
      // Skip if it's the pinned one to avoid duplicates in the visual flow
      if (pinnedConfession && item.id === pinnedConfession.id) {
         // Recursively get next or return null if end
         return getCardType(index + 1, activeTab, confessions, myConfessions, pinnedConfession);
      }
      return { kind: 'confession', confession: item };
    }
    
    // Adjust end card index
    const confessionsCount = pinnedConfession 
      ? confessions.filter(c => c.id !== pinnedConfession.id).length 
      : confessions.length;
    if (index === 3 + (pinnedConfession ? 1 : 0) + confessionsCount) return { kind: 'end' };
  } else {
    if (myConfessions.length === 0) {
      return index === 0 ? { kind: 'empty' } : null;
    }
    if (index < myConfessions.length) {
      return { kind: 'confession', confession: myConfessions[index] };
    }
    if (index === myConfessions.length) return { kind: 'end' };
  }
  return null;
}

const Home: React.FC<{ onIndexChange?: (index: number) => void }> = ({ onIndexChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const state = location.state as any;
    return state?.activeTab || 'home';
  });
  
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [myConfessions, setMyConfessions] = useState<Confession[]>([]);
  const [hasPosted, setHasPosted] = useState(() => localStorage.getItem(POSTED_KEY) === '1');
  const [isFetching, setIsFetching] = useState(false);
  const isFetchingRef = useRef(false);
  const [hasNoMore, setHasNoMore] = useState(false);
  const [selectedConfession, setSelectedConfession] = useState<Confession | null>(null);
  
  // session-only exclusion to prevent RPC returning duplicates of things already in buffer or served this session
  // tracks what we've already marked seen this specific component instance to avoid redundant saveToSeenV2 calls
  const servedIdsRef = useRef<Set<string>>(new Set());
  const alreadyMarkedViewedRef = useRef<Set<string>>(new Set());

  // Debug states (DEV ONLY)
  const [lastSeenIds, setLastSeenIds] = useState<string[]>([]);
  const [lastRpcReturnedId, setLastRpcReturnedId] = useState<string | null>(null);
  const [lastRpcSource, setLastRpcSource] = useState<string | null>(null);
  const [returnedWasAlreadySeen, setReturnedWasAlreadySeen] = useState<boolean>(false);
  const [lastMarkedSeenId, setLastMarkedSeenId] = useState<string | null>(null);
  const [markSeenReason, setMarkSeenReason] = useState<string | null>(null);
  const [batchFallbackCount, setBatchFallbackCount] = useState(0);
  const [lastBatchErrorMsg, setLastBatchErrorMsg] = useState<string | null>(null);
  
  // States for focused/pinned post behavior
  const [pinnedConfession, setPinnedConfession] = useState<Confession | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // METRICS: Ref to track already logged confessions in this session
  const loggedConfessions = useRef<Set<string>>(new Set());
  const hasLoggedReadDepth = useRef(false);

  const totalCards = useMemo(() => {
    if (activeTab === 'home') {
      const confessionsCount = pinnedConfession 
        ? confessions.filter(c => c.id !== pinnedConfession.id).length 
        : confessions.length;
      return 3 + (pinnedConfession ? 1 : 0) + confessionsCount + 1;
    }
    return myConfessions.length > 0 ? myConfessions.length + 1 : 1;
  }, [activeTab, confessions.length, myConfessions.length, pinnedConfession]);

  const initialIndex = useMemo(() => {
    const state = location.state as any;
    if (state?.activeTab === 'your_post') return 0;
    return localStorage.getItem(ONBOARDING_KEY) === '1' ? 2 : 0;
  }, []);

  const swipe = useSwipeStage({ 
    totalCards, 
    initialIndex
  });

  // METRICS: Log page_view once on mount
  useEffect(() => {
    logEvent('page_view', { screen: "home", tab: activeTab });
  }, []);

  // METRICS: Log view_confession when a unique confession card is viewed
  useEffect(() => {
    const cardInfo = getCardType(swipe.currentIndex, activeTab, confessions, myConfessions, pinnedConfession);
    if (cardInfo?.kind === 'confession' && cardInfo.confession) {
      const cid = cardInfo.confession.id;
      if (!loggedConfessions.current.has(cid)) {
        loggedConfessions.current.add(cid);
        logEvent('view_confession', { confession_id: cid, screen: "home", tab: activeTab });
      }
    }
  }, [swipe.currentIndex, activeTab, confessions, myConfessions, pinnedConfession]);

  // METRICS: Log read_depth on session end (unload or unmount)
  useEffect(() => {
    const sendReadDepth = () => {
      if (hasLoggedReadDepth.current) return;
      const count = loggedConfessions.current.size;
      if (count === 0) return;
      hasLoggedReadDepth.current = true;
      const anon_id = localStorage.getItem(ANON_ID_KEY);
      const session_id = localStorage.getItem(SESSION_ID_KEY);
      const meta = { anon_id, session_id, count };
      logEvent('session_end', meta, { useFetch: true });
    };
    window.addEventListener('beforeunload', sendReadDepth);
    return () => {
      sendReadDepth();
      window.removeEventListener('beforeunload', sendReadDepth);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      const handleWheel = (e: WheelEvent) => {
        swipe.onWheelCapture(e as unknown as React.WheelEvent);
      };
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Clamping Effect: Ensure currentIndex is always within valid bounds [0, totalCards - 1]
  useEffect(() => {
    const maxIndex = Math.max(0, totalCards - 1);
    if (swipe.currentIndex > maxIndex) {
      swipe.setCurrentIndex(maxIndex);
    } else if (swipe.currentIndex < 0) {
      swipe.setCurrentIndex(0);
    }
  }, [totalCards, activeTab, swipe.currentIndex]);

  const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || id.length > 20;

  const getPrunedSeenIds = () => {
    let raw: { id: string, seenAt: number }[] = [];
    try {
      const stored = localStorage.getItem(SEEN_IDS_V2_KEY);
      if (stored) {
        raw = JSON.parse(stored);
      } else {
        const v1 = JSON.parse(localStorage.getItem(SEEN_IDS_KEY) || '[]');
        raw = v1.map((id: string) => ({ id, seenAt: Date.now() }));
      }
    } catch (e) { raw = []; }
    const now = Date.now();
    const valid: { id: string, seenAt: number }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      if ((now - x.seenAt) < THIRTY_DAYS_MS) valid.push(x);
    }
    valid.sort((a, b) => b.seenAt - a.seenAt);
    if (valid.length > 2000) valid.length = 2000;
    localStorage.setItem(SEEN_IDS_V2_KEY, JSON.stringify(valid));
    const ids = new Array<string>(valid.length);
    for (let i = 0; i < valid.length; i++) ids[i] = valid[i].id;
    return ids;
  };

  const saveToSeenV2 = (id: string, reason: string = 'unknown') => {
    // DEV ONLY TRACKING
    if (localStorage.getItem('is_dev_mode') === 'true') {
      setLastMarkedSeenId(id);
      setMarkSeenReason(reason);
    }

    try {
      let raw: { id: string, seenAt: number }[] = JSON.parse(localStorage.getItem(SEEN_IDS_V2_KEY) || '[]');
      if (!raw.some(x => x.id === id)) {
        raw.push({ id, seenAt: Date.now() });
        const final = raw.slice(-2000);
        localStorage.setItem(SEEN_IDS_V2_KEY, JSON.stringify(final));
      }
    } catch (e) {}
  };

  const fetchNextConfession = async (count: number = 9) => {
    if (isFetchingRef.current || activeTab !== 'home' || hasNoMore) return;
    isFetchingRef.current = true;
    setIsFetching(true);
    try {
      const historicalSeenIds = getPrunedSeenIds();
      const seenSet = new Set<string>();
      for (let i = 0; i < confessions.length; i++) {
        const id = confessions[i].id;
        if (isUUID(id)) seenSet.add(id);
      }
      for (let i = 0; i < historicalSeenIds.length; i++) {
        const id = historicalSeenIds[i];
        if (isUUID(id)) seenSet.add(id);
      }
      servedIdsRef.current.forEach((id) => {
        if (isUUID(id)) seenSet.add(id);
      });
      const allSeenIds = Array.from(seenSet);
      
      // DEV ONLY Tracking
      setLastSeenIds(allSeenIds);

      let dataToProcess: any[] = [];
      
      // Step 1: Try Batch RPC
      const { data: batchData, error: batchError } = await supabase.rpc('get_confession_batch_v2', { seen_ids: allSeenIds });
      
      if (!batchError && Array.isArray(batchData) && batchData.length > 0) {
        dataToProcess = batchData;
        // Reset fallback stats on successful batch
        setBatchFallbackCount(0);
        setLastBatchErrorMsg(null);
        localStorage.removeItem('untold_feed_fallback_status_v1');
      } else {
        // Update fallback stats for admin/dev panel
        let errorMsg = "Non-array result";
        if (batchError) errorMsg = batchError.message;
        else if (!batchData || (Array.isArray(batchData) && batchData.length === 0)) errorMsg = "Empty Array";
        
        const nextCount = batchFallbackCount + 1;
        setBatchFallbackCount(nextCount);
        setLastBatchErrorMsg(errorMsg);

        // PERSIST FALLBACK STATUS
        localStorage.setItem('untold_feed_fallback_status_v1', JSON.stringify({
          active: true,
          count: nextCount,
          lastError: errorMsg,
          ts: new Date().toISOString()
        }));

        // Step 2: Fallback to single Next RPC if batch call returns empty or errors
        const { data: nextData, error: nextError } = await supabase.rpc('get_confession_next_v2', { seen_ids: allSeenIds });
        if (!nextError && Array.isArray(nextData) && nextData.length > 0) {
          dataToProcess = nextData;
        } else if (!nextError && nextData && !Array.isArray(nextData)) {
          // Handle cases where RPC returns object instead of array
          dataToProcess = [nextData];
        } else if (!nextError) {
          // Final exhaustion
          setHasNoMore(true);
          return;
        }
      }
      
      if (dataToProcess.length > 0) {
        const newBatch: Confession[] = dataToProcess.map((result: any) => {
          // SESSION-ONLY tracking so subsequent RPC calls don't repeat this item
          servedIdsRef.current.add(result.id);

          // DEV Tracking for the batch/item head
          if (result === dataToProcess[0]) {
            setLastRpcReturnedId(result.id);
            setReturnedWasAlreadySeen(allSeenIds.includes(result.id));
            setLastRpcSource(result.source || 'unknown');
          }
          
          return {
            id: result.id,
            title: result.title || undefined,
            content: result.body || result.content,
            createdAt: result.created_at || new Date().toISOString(),
            readerCount: result.reader_count || 1,
            reactionCount: result.reaction_count || 0,
            reactions: result.reactions || {}
          };
        });

        setConfessions(prev => {
          // SAFEGUARD: Deduplicate to prevent identical cards if same IDs are returned
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNewItems = newBatch.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueNewItems];
        });
      }
    } catch (err) {
      // Catch network/transient errors without marking hasNoMore = true
      console.warn('Fetch exception encountered:', err);
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  };

  // NEW: Effect to mark seen at VIEW-TIME
  useEffect(() => {
    const info = getCardType(swipe.currentIndex, activeTab, confessions, myConfessions, pinnedConfession);
    let timeoutIdRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    if (info?.kind === 'confession' && info.confession) {
      const id = info.confession.id;
      if (isUUID(id) && !alreadyMarkedViewedRef.current.has(id)) {
        timeoutIdRef.current = setTimeout(() => {
          saveToSeenV2(id, 'view');
          alreadyMarkedViewedRef.current.add(id);
        }, 300);
      }
    }

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, [swipe.currentIndex, activeTab, confessions, myConfessions, pinnedConfession]);

  useEffect(() => {
    if (activeTab === 'home') {
      const confessionsStartAt = 3;
      const currentIndexInList = swipe.currentIndex - confessionsStartAt;
      if (confessions.length === 0 && !isFetchingRef.current && !hasNoMore) {
        fetchNextConfession(9);
      } else if (currentIndexInList >= confessions.length - 3 && !isFetchingRef.current && !hasNoMore && confessions.length > 0) {
        fetchNextConfession(9);
      }
    }
  }, [swipe.currentIndex, confessions.length, activeTab, hasNoMore]);

  // DEV-ONLY: Reset feed function for debugging
  const handleDevReset = useCallback(() => {
    localStorage.removeItem(SEEN_IDS_KEY);
    localStorage.removeItem(SEEN_IDS_V2_KEY);
    localStorage.removeItem('untold_feed_fallback_status_v1');
    setConfessions([]);
    setHasNoMore(false);
    setPinnedConfession(null);
    setLastSeenIds([]);
    setLastRpcReturnedId(null);
    setLastRpcSource(null);
    setReturnedWasAlreadySeen(false);
    setLastMarkedSeenId(null);
    setMarkSeenReason(null);
    setBatchFallbackCount(0);
    setLastBatchErrorMsg(null);
    servedIdsRef.current.clear();
    alreadyMarkedViewedRef.current.clear();
    isFetchingRef.current = false;
    const startIdx = localStorage.getItem(ONBOARDING_KEY) === '1' ? 2 : 0;
    swipe.setCurrentIndex(startIdx);
    console.info('DEV: Home feed reset completed.');
  }, [swipe]);

  // LOCKED FOCUS HANDLER: Guardrail against modal popups in focus flow
  const handleFocusToHomePost = useCallback((focusId: string) => {
    const EXPECT_NO_MODAL_IN_FOCUS_FLOW = true; // Guardrail constant
    console.log("HOME Diagnostic: handleFocusToHomePost locking focus flow", { focusId });

    // Fix: Removed unexpected space in 'targetInMy' variable declaration
    const targetInMy = myConfessions.find(c => c.id === focusId);
    const targetInFeed = confessions.find(c => c.id === focusId);

    if (targetInMy || targetInFeed) {
      // 1. Force Home Tab
      setActiveTab('home');

      // 2. Strict Modal Suppression (Guardrail)
      if (selectedConfession) {
        console.error('[GUARD] focus flow must not open modal');
      }
      setSelectedConfession(null); 

      // 3. Pin and Set Index
      if (targetInMy) {
        setPinnedConfession(targetInMy);
        swipe.setCurrentIndex(3); // Pinned card is at index 3
      } else if (targetInFeed) {
        setPinnedConfession(null);
        swipe.setCurrentIndex(3 + confessions.indexOf(targetInFeed));
      }

      // 4. Highlight
      setHighlightId(focusId);
      setTimeout(() => setHighlightId(null), 2000);

      // 5. Scroll Into View (Redundant for swiper but satisfies Spec)
      requestAnimationFrame(() => {
        const el = document.getElementById(`confession-${focusId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // 6. Consume focusId
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [myConfessions, confessions, selectedConfession, swipe, navigate, location.pathname]);

  // UPDATED FOCUS LOGIC: Swaps to Home and pins card instead of opening modal
  useEffect(() => {
    const state = location.state as any;
    if (state?.resetToTopic) {
      setActiveTab('home');
      setPinnedConfession(null);
      setHasNoMore(false); // Reset terminal state to allow fresh fetch attempts
      const startIdx = localStorage.getItem(ONBOARDING_KEY) === '1' ? 2 : 0;
      swipe.setCurrentIndex(startIdx);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.focusId) {
      handleFocusToHomePost(state.focusId);
    }
  }, [location.state, confessions, myConfessions, handleFocusToHomePost]);

  useEffect(() => {
    onIndexChange?.(swipe.currentIndex);
    if (swipe.currentIndex >= 2 && localStorage.getItem(ONBOARDING_KEY) !== '1') {
      localStorage.setItem(ONBOARDING_KEY, '1');
    }
  }, [swipe.currentIndex, onIndexChange]);

  useEffect(() => {
    const loadMyPosts = () => {
      try {
        const myIds: string[] = JSON.parse(localStorage.getItem(MY_POSTS_IDS_KEY) || '[]');
        const savedDb: Confession[] = JSON.parse(localStorage.getItem(GLOBAL_DB_KEY) || '[]');
        const myPosts = savedDb.filter(post => myIds.includes(post.id));
        setMyConfessions(myPosts);
        setHasPosted(localStorage.getItem(POSTED_KEY) === '1');
      } catch (e) {
        setMyConfessions([]);
      }
    };
    loadMyPosts();
    window.addEventListener('storage', loadMyPosts);
    return () => window.removeEventListener('storage', loadMyPosts);
  }, []);

  const renderStageCard = (index: number, yOffset: number, zIndex: number) => {
    let cardInfo = getCardType(index, activeTab, confessions, myConfessions, pinnedConfession);
    
    // Safety Fix: If the active index is out of bounds (race condition), fallback to the nearest valid card (usually 'end')
    if (!cardInfo && index === swipe.currentIndex) {
      const safeIndex = Math.max(0, Math.min(index, totalCards - 1));
      cardInfo = getCardType(safeIndex, activeTab, confessions, myConfessions, pinnedConfession);
    }

    if (!cardInfo) return null;

    let id = `${activeTab}-${cardInfo.kind}-${index}`;
    if (cardInfo.confession) id = cardInfo.confession.id;

    let content = null;
    switch (cardInfo.kind) {
      case 'onboarding1':
        content = (
          <div className="relative w-[550px] max-w-full bg-[#1A1A1A] h-[calc(100dvh-220px)] md:h-[70dvh] confession-card overflow-hidden flex flex-col justify-end p-[20px] mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-0" />
            <img src="/logo2.png" width={208} height={32} className="relative z-10 mb-[20px]" style={{ width: '208px', maxWidth: '100%', height: 'auto' }} />
            <h1 className="relative z-10 text-[32px] md:text-[48px] font-medium text-white leading-tight mb-0">A safe space to share what you’ve never said out loud</h1>
          </div>
        );
        break;
      case 'onboarding2':
        content = (
          <div className="relative w-[550px] max-w-full bg-[#1A1A1A] h-[calc(100dvh-220px)] md:h-[70dvh] confession-card overflow-hidden flex flex-col justify-end p-[20px] mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-0" />
            <div className="relative z-10 space-y-2 mb-0">
              {["One new topic every week", "Share 100% anonymously", "Your post disappears after 7 days"].map((text, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#4CAF50] flex items-center justify-center shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <span className="text-[20px] md:text-[24px] text-white leading-tight">{text}</span>
                </div>
              ))}
              <h1 className="text-[32px] md:text-[48px] font-medium text-white leading-tight">How Untold keeps you anonymous</h1>
            </div>
          </div>
        );
        break;
      case 'topic':
        content = <TopicCard onNext={() => swipe.go('next', 'arrow')} />;
        break;
      case 'confession':
        const isHighlighted = cardInfo.confession?.id === highlightId;
        content = cardInfo.confession ? (
          <div 
            id={`confession-${cardInfo.confession.id}`}
            className={`transition-all duration-700 w-full h-full flex items-center justify-center ${isHighlighted ? 'ring-4 ring-white/50 ring-offset-8 ring-offset-transparent rounded-2xl z-[50]' : ''}`}
          >
            <ConfessionCard 
              confession={cardInfo.confession} 
              onExpandedScrollLockChange={swipe.setInnerScrollLock} 
              onEdgeDragDelta={swipe.handleEdgeDragDelta} 
              onEdgeDragEnd={swipe.handleEdgeDragEnd} 
            />
          </div>
        ) : null;
        break;
      case 'end':
        content = (
          <div className="relative w-[550px] max-w-full bg-[#E43630] h-[calc(100dvh-220px)] md:h-[70dvh] rounded-none p-4 md:p-5 shadow-2xl flex flex-col justify-end mx-auto border-none confession-card">
            <h1 className="text-[32px] md:text-[48px] font-medium text-white leading-tight">
              {isFetching ? "Loading..." : hasNoMore ? "You’ve reached the end for now." : "Looking for more..."}
            </h1>
          </div>
        );
        break;
      case 'empty':
        content = (
          <div className="bg-white rounded-none p-4 md:p-5 text-center w-[550px] max-w-full shadow-2xl flex flex-col items-center justify-center mx-auto h-[calc(100dvh-220px)] md:h-[70dvh] confession-card">
             <h3 className="text-2xl font-bold text-black mb-4">You haven’t shared a story yet.</h3>
             <button onClick={() => navigate('/write')} className="bg-black text-white px-8 py-3 rounded-full font-bold shadow-xl write-confession-btn">Share your story</button>
          </div>
        );
        break;
    }

    return (
      <div 
        key={id}
        className={`absolute inset-0 flex items-center justify-center pointer-events-none px-2 md:px-0 ${swipe.isTransitioning ? 'transition-transform' : ''}`}
        style={{ 
          transform: `translateY(${yOffset}px)`,
          transitionDuration: swipe.isTransitioning ? `${TRANSITION_MS}ms` : '0ms',
          zIndex: zIndex,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div className="pointer-events-auto h-full flex items-center justify-center w-full">
          {content}
        </div>
      </div>
    );
  };

  const viewportHeight = window.innerHeight;

  // DEV ONLY logic for calculating debug fields
  const currentCardId = useMemo(() => {
    const info = getCardType(swipe.currentIndex, activeTab, confessions, myConfessions, pinnedConfession);
    return info?.kind === 'confession' ? info.confession?.id || null : null;
  }, [swipe.currentIndex, activeTab, confessions, myConfessions, pinnedConfession]);

  const currentInLastSeen = useMemo(() => {
    return currentCardId ? lastSeenIds.includes(currentCardId) : false;
  }, [currentCardId, lastSeenIds]);

  const copyDebugInfo = useCallback(() => {
    const text = `
FEED STATE
buffer: ${confessions.length}
noMore: ${hasNoMore}
fetching: ${isFetching}

RPC DEBUG
lastSeenCount: ${lastSeenIds.length}
lastRpcId: ${lastRpcReturnedId || 'none'}
source: ${lastRpcSource || 'none'}
returnedWasAlreadySeen: ${returnedWasAlreadySeen}

FALLBACK STATS
batchFallbackCount: ${batchFallbackCount}
lastBatchError: ${lastBatchErrorMsg || 'none'}

MARK SEEN TRACKING
lastMarkedSeenId: ${lastMarkedSeenId || 'none'}
markSeenReason: ${markSeenReason || 'none'}

CURRENT CARD
cardId: ${currentCardId || 'none'}
currentInLastSeen: ${currentInLastSeen}
`.trim();
    navigator.clipboard.writeText(text).then(() => {
      console.info('Debug info copied to clipboard');
    });
  }, [confessions.length, hasNoMore, isFetching, lastSeenIds, lastRpcReturnedId, lastRpcSource, returnedWasAlreadySeen, lastMarkedSeenId, markSeenReason, currentCardId, currentInLastSeen, batchFallbackCount, lastBatchErrorMsg]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative flex items-center justify-center overflow-hidden" 
      onTouchStart={swipe.onTouchStart} 
      onTouchMove={swipe.onTouchMove} 
      onTouchEnd={swipe.onTouchEnd}
    >
      {localStorage.getItem('is_dev_mode') === 'true' && (
        <>
          <div className="fixed bottom-14 left-4 z-[99999] bg-black/80 text-white/90 p-4 rounded-xl text-[10px] font-mono border border-white/10 flex flex-col gap-1 shadow-2xl min-w-[200px]">
            <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
              <span className="font-bold text-white">DEBUG STATE</span>
              <button onClick={copyDebugInfo} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded hover:bg-white/20 transition-all pointer-events-auto text-white/70">Copy</button>
            </div>
            <pre className="whitespace-pre-wrap break-all">
              {`buffer: ${confessions.length}\nnoMore: ${hasNoMore}\nfetching: ${isFetching}\n\nseenCount: ${lastSeenIds.length}\nlastRpcId: ${lastRpcReturnedId?.slice(0, 8) || 'none'}\nsource: ${lastRpcSource || 'none'}\nwasAlreadySeen: ${returnedWasAlreadySeen}\n\nfallback: ${batchFallbackCount > 0}\nfallbackCount: ${batchFallbackCount}\nlastBatchErrorMsg: ${lastBatchErrorMsg || 'none'}\n\nlastMarkedSeen: ${lastMarkedSeenId?.slice(0, 8) || 'none'}\nmarkReason: ${markSeenReason || 'none'}\n\ncardId: ${currentCardId?.slice(0, 8) || 'none'}\ncardInSeen: ${currentInLastSeen}`}
            </pre>
          </div>
          <button 
            onClick={handleDevReset}
            className="fixed bottom-4 left-4 z-[99999] bg-black/40 text-white/70 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black/60 hover:text-white transition-all pointer-events-auto border border-white/10"
          >
            DEV: Reset feed
          </button>
        </>
      )}

      <div className="absolute inset-0 z-10 overflow-hidden">
        {renderStageCard(swipe.currentIndex, swipe.dragY, 30)}
        {(swipe.dragY < 0 || (swipe.isTransitioning && swipe.dragY !== 0)) && swipe.currentIndex < totalCards - 1 && renderStageCard(swipe.currentIndex + 1, swipe.dragY + viewportHeight, 35)}
        {(swipe.dragY > 0 || (swipe.isTransitioning && swipe.dragY !== 0)) && swipe.currentIndex > 0 && renderStageCard(swipe.currentIndex - 1, swipe.dragY - viewportHeight, 35)}
      </div>

      <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
        <div className="relative w-[550px] shrink-0 h-[calc(100dvh-220px)] md:h-[70dvh] confession-card pointer-events-none">
          <div className="hidden md:flex flex-col gap-2 z-40 absolute right-full mr-6 top-1/2 -translate-y-1/2 pointer-events-auto">
            <button onClick={() => swipe.go('prev', 'arrow')} disabled={swipe.currentIndex === 0 || swipe.isTransitioning} className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg transition-all ${swipe.currentIndex === 0 ? 'opacity-30' : 'hover:scale-105 active:scale-95'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
            <button onClick={() => swipe.go('next', 'arrow')} disabled={swipe.currentIndex === totalCards - 1 || swipe.isTransitioning} className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg transition-all ${swipe.currentIndex === totalCards - 1 ? 'opacity-30' : 'hover:scale-105 active:scale-95'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
          {hasPosted && (
            <div className="absolute top-[calc(100%+24px)] left-0 z-[60] flex items-center p-1 bg-black/10 backdrop-blur-md rounded-full border border-white/10 pointer-events-auto" style={{ borderRadius: '14px' }}>
              <button onClick={() => { setActiveTab('your_post'); swipe.setCurrentIndex(0); }} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'your_post' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`} style={{ paddingLeft: '1rem', paddingRight: '1rem', borderRadius: '14px' }}>Your post</button>
              <button onClick={() => { setActiveTab('home'); swipe.setCurrentIndex(0); setPinnedConfession(null); }} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'home' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`} style={{ paddingLeft: '1rem', paddingRight: '1rem', borderRadius: '14px' }}>Home</button>
            </div>
          )}
        </div>
      </div>
      
      <div className="md:hidden absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-[45]" />

      {selectedConfession && (
        <FullReadingModal 
          confession={selectedConfession} 
          onClose={() => setSelectedConfession(null)} 
        />
      )}
    </div>
  );
};

export default Home;
