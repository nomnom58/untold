
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Confession, REACTION_LABELS, REACTION_EMOJI, ReactionType } from '../types';
import ReactionPicker from './ReactionPicker';
import { useReactionUnlock } from '../hooks/useReactionUnlock';
import { EDGE_WHEEL_END_MS } from '../swipeConfig';

interface ConfessionCardProps {
  confession: Confession;
  showScallop?: boolean;
  onExpandedScrollLockChange?: (locked: boolean) => void;
  onEdgeDragDelta?: (deltaY: number) => void;
  onEdgeDragEnd?: () => void;
}

const ConfessionCard: React.FC<ConfessionCardProps> = React.memo(({ 
  confession, 
  showScallop = true,
  onExpandedScrollLockChange,
  onEdgeDragDelta,
  onEdgeDragEnd
}) => {
  const navigate = useNavigate();
  const { isLocked, userReaction, react, clearReaction } = useReactionUnlock(confession.id);
  
  // UI States
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [showLockedPopover, setShowLockedPopover] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Layout Measurements
  const [hasOverflow, setHasOverflow] = useState(false);
  const [lineHeight, setLineHeight] = useState(27.2);
  
  // Refs for logic
  const interactionRef = useRef<HTMLDivElement>(null);
  const shareContainerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const lastTouchYRef = useRef<number | null>(null);
  const wheelEndTimer = useRef<number | null>(null);

  // Touch/Long Press Refs
  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isLongPressActive = useRef(false);
  
  // Constants
  const CLAMP_LINES = 8;
  const LONG_PRESS_DURATION = 500;

  // SAFETY FIX: Ensure content is a string before calling trimEnd
  const rawContent = useMemo(() => {
    const text = confession.content || '';
    return typeof text === 'string' ? text.trimEnd() : String(text).trimEnd();
  }, [confession.content]);

  const previewContent = useMemo(() => rawContent.replace(/\n\s*\n+/g, '\n'), [rawContent]);

  // Sync scroll lock with parent
  useEffect(() => {
    onExpandedScrollLockChange?.(isExpanded);
  }, [isExpanded, onExpandedScrollLockChange]);

  // Reset local states on ID change
  useEffect(() => {
    if (scrollableRef.current) scrollableRef.current.scrollTop = 0;
    setIsExpanded(false);
    setShowPicker(false);
    setShowSharePopover(false);
    setShowLockedPopover(false);
  }, [confession.id]);

  // Handle click outside share popover
  useEffect(() => {
    const handleShareClickOutside = (e: MouseEvent) => {
      if (showSharePopover && shareContainerRef.current && !shareContainerRef.current.contains(e.target as Node)) {
        setShowSharePopover(false);
      }
    };
    if (showSharePopover) {
      document.addEventListener('mousedown', handleShareClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleShareClickOutside);
  }, [showSharePopover]);

  // Overflow detection
  useEffect(() => {
    const measure = () => {
      if (textRef.current) {
        const style = window.getComputedStyle(textRef.current);
        const lhRaw = style.lineHeight;
        const fsRaw = style.fontSize;
        let lh = parseFloat(lhRaw);
        if (lhRaw === 'normal' || isNaN(lh)) lh = parseFloat(fsRaw) * 1.6;
        setLineHeight(lh);
        const limit = lh * CLAMP_LINES;
        setHasOverflow(textRef.current.scrollHeight > limit + 1);
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, [confession.content, confession.title, CLAMP_LINES]);

  const previewMaxHeight = useMemo(() => Math.floor(lineHeight * CLAMP_LINES), [lineHeight, CLAMP_LINES]);

  /**
   * NATIVE WHEEL HANDLING
   */
  useEffect(() => {
    const el = scrollableRef.current;
    if (!el || !isExpanded) return;

    const handleNativeWheel = (e: WheelEvent) => {
      const isAtTop = el.scrollTop <= 0;
      const isAtBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

      const goingUpAtTop = isAtTop && e.deltaY < 0;
      const goingDownAtBottom = isAtBottom && e.deltaY > 0;

      if (goingUpAtTop || goingDownAtBottom) {
        e.preventDefault();
        onEdgeDragDelta?.(e.deltaY);

        if (wheelEndTimer.current) window.clearTimeout(wheelEndTimer.current);
        wheelEndTimer.current = window.setTimeout(() => {
          onEdgeDragEnd?.();
          wheelEndTimer.current = null;
        }, EDGE_WHEEL_END_MS);
      } else {
        e.stopPropagation();
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.addEventListener('wheel', handleNativeWheel);
  }, [isExpanded, onEdgeDragDelta, onEdgeDragEnd]);

  /**
   * TOUCH GESTURE HANDLING (SCROLLING/SWIPING)
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isExpanded) return;
    lastTouchYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isExpanded || lastTouchYRef.current === null) return;
    const el = scrollableRef.current;
    if (!el) return;

    const currentY = e.touches[0].clientY;
    const incrementalDeltaY = lastTouchYRef.current - currentY;
    
    const isAtTop = el.scrollTop <= 0;
    const isAtBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    const pullingDownAtTop = isAtTop && incrementalDeltaY < 0;
    const pullingUpAtBottom = isAtBottom && incrementalDeltaY > 0;

    if (pullingDownAtTop || pullingUpAtBottom) {
      onEdgeDragDelta?.(incrementalDeltaY);
      if (e.cancelable) e.preventDefault();
    } else {
      e.stopPropagation();
    }

    lastTouchYRef.current = currentY;
  };

  const handleTouchEnd = () => {
    if (!isExpanded) return;
    lastTouchYRef.current = null;
    onEdgeDragEnd?.();
  };

  /**
   * REACTION LOGIC (TAP vs LONG PRESS)
   */
  const handleActionClick = () => {
    // Desktop fallback/click handling
    if (isLocked) {
      setShowLockedPopover(true);
      setShowPicker(false);
      return;
    }
    
    // For Mouse devices, toggle picker or default reaction
    if (userReaction) {
      clearReaction();
    } else {
      react(ReactionType.ME_TOO);
    }
  };

  const startReactionTouch = (e: React.TouchEvent) => {
    if (isLocked) return;
    
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActive.current = false;

    longPressTimer.current = window.setTimeout(() => {
      isLongPressActive.current = true;
      setShowPicker(true);
      // Vibrate if supported for haptic feedback
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, LONG_PRESS_DURATION);
  };

  const moveReactionTouch = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // If moved significantly (10px deadzone), cancel long press
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  // ADDED FIX: Implement missing endReactionTouch to clear long-press timer
  const endReactionTouch = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startResetTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setShowLockedPopover(false);
      setShowPicker(false);
    }, 200);
  }, []);

  const clearResetTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = () => {
    if (window.matchMedia('(pointer: coarse)').matches) return; // Ignore on touch devices
    
    clearResetTimeout();
    if (isLocked) {
      setShowLockedPopover(true);
    } else {
      setShowPicker(true);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget as Node;
    if (interactionRef.current?.contains(relatedTarget)) return;
    startResetTimeout();
  };

  const handleShareToX = () => {
    const shareUrl = window.location.href;
    const shareText = confession.title ? `${confession.title}\n\n` : "Read this confession on Untold.\n\n";
    const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(xShareUrl, '_blank');
  };

  // REACTION CALCULATION - Optimized for real-time local updates and aggregate fallback
  const reactionSummary = useMemo(() => {
    const displayReactions = { ...confession.reactions };
    const dbTotal = confession.reactionCount || 0;
    
    // RATIONALE: If DB has a count but NO specific emoji data, seed the heart as a real entry 
    // so it persists in the stack even after the user adds their own different emoji.
    if (dbTotal > 0 && Object.keys(confession.reactions).length === 0) {
      displayReactions['❤️'] = 1;
    }

    if (userReaction) {
      const emoji = REACTION_EMOJI[userReaction];
      if (emoji) displayReactions[emoji] = (displayReactions[emoji] || 0) + 1;
    }

    // Filter out zero-count emojis and sort by popularity
    const entries = Object.entries(displayReactions)
      .filter(([_, count]) => (count as number) > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number));

    // COMBINED TOTAL LOGIC: Prioritize aggregate count + local delta
    const localHasReaction = Boolean(userReaction);
    const totalCount = dbTotal > 0 
      ? (dbTotal + (localHasReaction ? 1 : 0)) 
      : entries.reduce((acc, [_, count]) => acc + (count as number), 0);
    
    // Extract top 3 unique emojis for the visual stack
    const uniqueEmojis = entries.slice(0, 3).map(([emoji]) => emoji);

    return { totalCount, uniqueEmojis };
  }, [confession.reactions, confession.reactionCount, userReaction]);

  const scallopStyleTop: React.CSSProperties = {
    backgroundColor: 'white', width: '100%', height: '9px', position: 'absolute', top: '-8px', left: 0, zIndex: 10,
    WebkitMaskImage: 'radial-gradient(circle at 11px -4px, transparent 8px, black 8.1px)',
    maskImage: 'radial-gradient(circle at 11px -4px, transparent 8px, black 8.1px)',
    WebkitMaskSize: '22px 9px', maskSize: '22px 9px', WebkitMaskRepeat: 'repeat-x', maskRepeat: 'repeat-x',
    contain: 'paint'
  };

  const scallopStyleBottom: React.CSSProperties = {
    backgroundColor: 'white', width: '100%', height: '9px', position: 'absolute', bottom: '-8px', left: 0, zIndex: 10,
    WebkitMaskImage: 'radial-gradient(circle at 11px 13px, transparent 8px, black 8.1px)',
    maskImage: 'radial-gradient(circle at 11px 13px, transparent 8px, black 8.1px)',
    WebkitMaskSize: '22px 9px', maskSize: '22px 9px', WebkitMaskRepeat: 'repeat-x', maskRepeat: 'repeat-x',
    contain: 'paint'
  };

  return (
    <div className="relative w-[550px] h-[calc(100dvh-220px)] md:h-[70dvh] max-w-full mx-auto overflow-visible confession-card transform-gpu will-change-transform">
      {showScallop && (
        <>
          <div style={scallopStyleTop} />
          <div style={scallopStyleBottom} />
        </>
      )}

      <div className="relative w-full h-full bg-white rounded-none shadow-2xl flex flex-col overflow-hidden border border-black/5">
        <div className="flex-1 flex flex-col p-4 md:p-5 relative overflow-hidden">
          
          <div className="flex-1 overflow-hidden flex flex-col text-left relative">
            <div 
              ref={scrollableRef}
              className={`pr-2 custom-scrollbar relative scrollbar-gutter-stable touch-pan-y ${isExpanded ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}
              style={isExpanded ? { 
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                touchAction: 'pan-y'
              } as any : {
                touchAction: 'pan-y'
              } as any}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {confession.title && (
                <h2 className="text-[20px] font-medium md:text-2xl md:font-bold text-[#1A1A1A] mb-4 md:mb-3 leading-tight shrink-0">
                  {confession.title}
                </h2>
              )}

              <div 
                style={{ 
                  maxHeight: isExpanded ? 'none' : `${previewMaxHeight}px`,
                  contain: isExpanded ? 'content' : 'none'
                }} 
                className={isExpanded ? "" : "overflow-hidden"}
              >
                <p ref={textRef} className={`text-[16px] leading-[22px] md:text-[17px] md:leading-[1.6] text-black/80 p-0 m-0 whitespace-pre-line ${isExpanded ? '' : 'line-clamp-8'}`}>
                  {previewContent}
                </p>
              </div>
              
              {!isExpanded && hasOverflow && (
                <button 
                  onClick={() => setIsExpanded(true)}
                  className="w-fit cursor-pointer group mt-0 font-semibold text-black text-[16px] leading-[22px] md:text-[17px] md:leading-[1.6] hover:underline outline-none"
                >
                  Read more
                </button>
              )}
            </div>
          </div>

          <div className="mt-auto relative shrink-0">
            <div className="-mx-[20px] h-px bg-black/10 mb-4" />
            
            <div className="flex justify-between items-center mb-3">
              <p className="text-[16px] font-normal text-black/70">
                {confession.readerCount} others have read this.
              </p>
              
              {/* Reaction summary UI: Number left, Stack right */}
              {reactionSummary.totalCount > 0 && reactionSummary.uniqueEmojis.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[16px] font-normal text-black/70">{reactionSummary.totalCount}</span>
                  <div className="flex -space-x-[8px]">
                    {reactionSummary.uniqueEmojis.map((emoji, idx) => (
                      <span key={idx} className="text-xl" style={{ zIndex: 10 - idx }}>{emoji}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div ref={interactionRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {showPicker && !isLocked && (
                  <div className="absolute bottom-[calc(100%+12px)] left-0 z-[300] pointer-events-auto">
                    <div className="animate-in slide-in-from-bottom-2 zoom-in-95 duration-200">
                      <ReactionPicker 
                        onSelect={(key) => { react(key); setShowPicker(false); }} 
                        currentUserReaction={userReaction || undefined}
                      />
                    </div>
                  </div>
                )}

                {showLockedPopover && isLocked && (
                  <div className="absolute bottom-full left-0 mb-4 z-[300] w-[280px] bg-white p-4 rounded-[24px] border border-[rgba(0,0,0,0.16)] shadow-[0px_4px_16px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <h3 className="text-[20px] font-medium text-black mb-2 leading-tight">Write your first confession to unlock reactions</h3>
                    <p className="text-[14px] font-normal text-[#373737] mb-5 leading-relaxed">Once you share your story, you’ll be able to react to others’ confessions.</p>
                    <button onClick={() => navigate('/write')} className="bg-black text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 shadow-md write-confession-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      Write confession
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleActionClick}
                  onTouchStart={startReactionTouch}
                  onTouchMove={moveReactionTouch}
                  onTouchEnd={endReactionTouch}
                  className={`flex items-center rounded-xl transition-all outline-none px-2 py-1.5 select-none ${
                    userReaction 
                    ? 'bg-[#E43630]/10 text-[#E43630] gap-[8px]' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 gap-2'
                  }`}
                >
                  {userReaction ? (
                    <span className="w-[24px] h-[24px] flex items-center justify-center text-[20px] leading-none shrink-0 animate-in zoom-in-110 duration-200">
                      {REACTION_EMOJI[userReaction]}
                    </span>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  )}
                  <span className="text-base font-medium whitespace-nowrap">
                    {userReaction ? REACTION_LABELS[userReaction] : "Reaction"}
                  </span>
                </button>
              </div>

              <div ref={shareContainerRef} className="relative">
                {showSharePopover && (
                  <div className="absolute bottom-full left-0 mb-3 z-[300] w-[300px] bg-white rounded-[24px] p-4 border border-[rgba(0,0,0,0.16)] shadow-[0px_4px_16px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-2 duration-200">
                    <h3 className="text-base font-bold text-center mb-5">Share</h3>
                    <div className="flex justify-between items-center gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(window.location.href); setIsCopied(true); }} className="flex flex-col items-center flex-1">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></div>
                        <span className="text-[10px] font-bold text-black/60">{isCopied ? 'Link copied' : 'Copy link'}</span>
                      </button>
                      <button className="flex flex-col items-center flex-1"><div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-2"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.3c.94 0 1.84.15 2.6.43L21 3l-1.4 4.5A8.38 8.38 0 0 1 21 11.5Z"></path></svg></div><span className="text-[10px] font-bold text-black/60">WhatsApp</span></button>
                      <button className="flex flex-col items-center flex-1"><div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-2"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0084FF" strokeWidth="2"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg></div><span className="text-[10px] font-bold text-black/60">Messenger</span></button>
                      <button onClick={handleShareToX} className="flex flex-col items-center flex-1">
                        <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mb-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z"/>
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold text-black/60">X</span>
                      </button>
                    </div>
                  </div>
                )}
                <button onClick={() => setShowSharePopover(!showSharePopover)} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 outline-none">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  <span className="text-base font-medium">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ConfessionCard;
