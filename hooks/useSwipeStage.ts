// Added React import to resolve namespace errors for event types
import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  TRANSITION_MS, 
  SNAP_THRESHOLD_COLLAPSED, 
  SNAP_THRESHOLD_EXPANDED_EDGE,
  WHEEL_SENSITIVITY, 
  WHEEL_DEBOUNCE_MS,
  DEADZONE_PX
} from '../swipeConfig';

interface SwipeStageParams {
  totalCards: number;
  initialIndex: number;
}

export function useSwipeStage({
  totalCards,
  initialIndex
}: SwipeStageParams) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [innerScrollLock, setInnerScrollLock] = useState(false);

  // Persistence Refs to keep callbacks stable
  const stateRef = useRef({
    currentIndex,
    dragY,
    isTransitioning,
    innerScrollLock,
    totalCards
  });

  // CRITICAL: Synchronously sync the totalCards prop so boundary checks are never stale
  stateRef.current.totalCards = totalCards;

  // Sync stateRef with latest state using useLayoutEffect to update before browser paint
  useLayoutEffect(() => {
    stateRef.current = {
      ...stateRef.current,
      currentIndex,
      dragY,
      isTransitioning,
      innerScrollLock,
      totalCards
    };
  }, [currentIndex, dragY, isTransitioning, innerScrollLock, totalCards]);

  const wheelDragAcc = useRef(0);
  const wheelTimer = useRef<number | null>(null);
  const nudgeTimers = useRef<number[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
      nudgeTimers.current.forEach(id => window.clearTimeout(id));
      nudgeTimers.current = [];
    };
  }, []);

  // Sync index if initialIndex changes from parent
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const commitTransition = useCallback((direction: 'next' | 'prev') => {
    const { isTransitioning, currentIndex, totalCards } = stateRef.current;
    const targetIdx = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    console.log("HOME go", { dir: direction, idxBefore: currentIndex, idxAfter: targetIdx, isTransitioning, totalCards });

    if (isTransitioning) {
      console.log("HOME block", { reason: "already transitioning" });
      return;
    }
    
    const viewportHeight = window.innerHeight;
    
    // Bounds check for spring-back
    if (targetIdx < 0 || targetIdx >= totalCards) {
      console.log("HOME block", { reason: "boundary reached", targetIdx, totalCards });
      // We set transitioning to false very quickly for boundary nudges so we don't trap the user
      setIsTransitioning(true);
      stateRef.current.isTransitioning = true;
      setDragY(0);
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
        stateRef.current.isTransitioning = false;
      }, 150); // Shorter duration for boundary "nudge" to avoid trapping input
      nudgeTimers.current.push(timer);
      return;
    }

    // Perform actual move
    setIsTransitioning(true);
    stateRef.current.isTransitioning = true;
    const finalY = direction === 'next' ? -viewportHeight : viewportHeight;
    setDragY(finalY);

    const timer = window.setTimeout(() => {
      setCurrentIndex(targetIdx);
      setDragY(0);
      setIsTransitioning(false);
      stateRef.current.isTransitioning = false;
    }, TRANSITION_MS);
    nudgeTimers.current.push(timer);
  }, []);

  const requestSwipe = useCallback((direction: 'next' | 'prev', source: 'wheel' | 'touch' | 'arrow' | 'edge') => {
    const { isTransitioning, currentIndex, totalCards } = stateRef.current;
    
    // Check transition specifically here before the arrow nudge logic
    if (isTransitioning) {
      console.log("HOME block", { reason: `transitioning during request from ${source}` });
      return;
    }

    if (source === 'arrow') {
      const targetIdx = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      
      if (targetIdx < 0 || targetIdx >= totalCards) {
        commitTransition(direction);
        return;
      }

      const viewportHeight = window.innerHeight;
      const nudgeAmount = Math.floor(viewportHeight * 0.12);
      const initialDrag = direction === 'next' ? -nudgeAmount : nudgeAmount;
      
      setIsTransitioning(true);
      stateRef.current.isTransitioning = true;
      setDragY(initialDrag);
      
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
        stateRef.current.isTransitioning = false;
        commitTransition(direction);
      }, 100);
      nudgeTimers.current.push(timer);
    } else {
      commitTransition(direction);
    }
  }, [commitTransition]);

  const handleEdgeDragDelta = useCallback((deltaY: number) => {
    const { isTransitioning } = stateRef.current;
    if (isTransitioning) return;
    const viewportHeight = window.innerHeight;
    wheelDragAcc.current += deltaY * WHEEL_SENSITIVITY;
    const nextDragY = Math.max(-viewportHeight, Math.min(viewportHeight, -wheelDragAcc.current));
    setDragY(nextDragY);
  }, []);

  const handleEdgeDragEnd = useCallback(() => {
    const { isTransitioning, dragY, innerScrollLock } = stateRef.current;
    if (isTransitioning) return;
    
    const viewportHeight = window.innerHeight;
    const activeThreshold = innerScrollLock ? SNAP_THRESHOLD_EXPANDED_EDGE : SNAP_THRESHOLD_COLLAPSED;
    const threshold = viewportHeight * activeThreshold;
    const source = innerScrollLock ? 'edge' : 'wheel';
    
    if (dragY < -threshold) {
      requestSwipe('next', source);
    } else if (dragY > threshold) {
      requestSwipe('prev', source);
    } else if (Math.abs(dragY) < DEADZONE_PX) {
      setDragY(0);
    } else if (dragY !== 0) {
      setIsTransitioning(true);
      stateRef.current.isTransitioning = true;
      setDragY(0);
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
        stateRef.current.isTransitioning = false;
      }, TRANSITION_MS);
      nudgeTimers.current.push(timer);
    }

    wheelDragAcc.current = 0;
  }, [requestSwipe]);

  const onWheelCapture = (e: React.WheelEvent) => {
    const { isTransitioning, innerScrollLock, currentIndex, totalCards } = stateRef.current;
    
    // LOG WHEEL ATTEMPT
    console.log("HOME wheel", { 
      deltaY: e.deltaY, 
      idx: currentIndex, 
      totalCards, 
      isTransitioning, 
      innerScrollLock 
    });

    if (innerScrollLock) return;
    
    // We REMOVED the isTransitioning early return here.
    // This ensures that even if we are in a "boundary nudge" state, 
    // wheel events are still captured and accumulated.
    // The commitTransition function still protects against double transitions.

    e.preventDefault();
    if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
    handleEdgeDragDelta(e.deltaY);
    wheelTimer.current = window.setTimeout(() => {
      handleEdgeDragEnd();
      wheelTimer.current = null;
    }, WHEEL_DEBOUNCE_MS);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning || innerScrollLock) return;
    setTouchStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || touchStartY === null || isTransitioning || innerScrollLock) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    setDragY(deltaY);
  };

  const onTouchEnd = () => {
    if (!isDragging || isTransitioning || innerScrollLock) return;
    setIsDragging(false);
    
    const viewportHeight = window.innerHeight;
    const activeThreshold = innerScrollLock ? SNAP_THRESHOLD_EXPANDED_EDGE : SNAP_THRESHOLD_COLLAPSED;
    const threshold = viewportHeight * activeThreshold;

    if (dragY < -threshold) {
      requestSwipe('next', 'touch');
    } else if (dragY > threshold) {
      requestSwipe('prev', 'touch');
    } else if (Math.abs(dragY) < DEADZONE_PX) {
      setDragY(0);
    } else {
      setIsTransitioning(true);
      stateRef.current.isTransitioning = true;
      setDragY(0);
      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
        stateRef.current.isTransitioning = false;
      }, TRANSITION_MS);
      nudgeTimers.current.push(timer);
    }
    setTouchStartY(null);
  };

  return {
    currentIndex,
    setCurrentIndex,
    dragY,
    isTransitioning,
    innerScrollLock,
    setInnerScrollLock,
    requestSwipe,
    go: requestSwipe,
    handleEdgeDragDelta,
    handleEdgeDragEnd,
    onWheelCapture,
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
}
