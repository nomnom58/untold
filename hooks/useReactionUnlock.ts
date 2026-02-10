
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const POSTED_KEY = 'untold_has_posted';
const REACTED_MAP_KEY = 'untold_reacted_map_v2';
const DEVICE_ID_KEY = 'untold_device_id_v1';

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

/**
 * Hook to manage reaction state and posting status.
 * Optimized for synchronous UI updates and cross-tab synchronization.
 * 
 * RECOMMENDED SQL (Updated):
 * 
 * CREATE OR REPLACE FUNCTION public.add_reaction(
 *   confession_id uuid,
 *   reaction_key text,
 *   device_id text
 * )
 * RETURNS void AS $$
 * BEGIN
 *   -- This RPC now handles both first-time reactions and reaction updates per device.
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 */
export const useReactionUnlock = (confessionId?: string) => {
  const [hasPosted, setHasPosted] = useState(() => localStorage.getItem(POSTED_KEY) === '1');
  
  // Single source of truth for reactions on this device
  const [reactedMap, setReactedMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(REACTED_MAP_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Use a ref to track the latest map to avoid stale closures in listeners
  const mapRef = useRef(reactedMap);
  useEffect(() => {
    mapRef.current = reactedMap;
  }, [reactedMap]);

  // Keep state in sync with localStorage changes from other components/tabs
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent | Event) => {
      // 1. Sync posting status
      const posted = localStorage.getItem(POSTED_KEY) === '1';
      setHasPosted(posted);

      // 2. Sync reaction map with optimization
      try {
        const rawSaved = localStorage.getItem(REACTED_MAP_KEY);
        const saved = rawSaved ? JSON.parse(rawSaved) : {};
        
        // Deep comparison optimization: Only update if the stringified content actually changed
        const currentStr = JSON.stringify(mapRef.current);
        const nextStr = JSON.stringify(saved);
        
        if (currentStr !== nextStr) {
          setReactedMap(saved);
        }
      } catch (err) {
        setReactedMap({});
      }
    };

    window.addEventListener('storage', handleStorageSync);
    
    return () => {
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);


  const react = useCallback(async (reactionKey: string) => {
    if (!hasPosted || !confessionId) return;
    
    // 1. Sync Local State (Instant UI feedback)
    const newMap = { ...reactedMap, [confessionId]: reactionKey };
    setReactedMap(newMap);
    localStorage.setItem(REACTED_MAP_KEY, JSON.stringify(newMap));

    // 2. Sync to Backend (New RPC with 3 parameters)
    try {
      const deviceId = getDeviceId();
      const { error } = await supabase.rpc('add_reaction', { 
        confession_id: confessionId,
        reaction_key: reactionKey,
        device_id: deviceId
      });
      if (error) {
        console.warn('[Sync] Failed to persist reaction:', error.message);
      }
    } catch (err) {
      console.warn('[Sync] Reaction RPC failed:', err);
    }
  }, [hasPosted, reactedMap, confessionId]);

  const clearReaction = useCallback(() => {
    if (!confessionId) return;
    
    const newMap = { ...reactedMap };
    delete newMap[confessionId];

    setReactedMap(newMap);
    localStorage.setItem(REACTED_MAP_KEY, JSON.stringify(newMap));

    // Note: For MVP, we don't decrement reaction_count on clear to keep 
    // the HOT ranking stable and prevent negative counts or manipulation.
  }, [reactedMap, confessionId]);

  const markAsPosted = useCallback(() => {
    localStorage.setItem(POSTED_KEY, '1');
    setHasPosted(true);
  }, []);

  const userReaction = confessionId ? (reactedMap[confessionId] || null) : null;

  return {
    isLocked: !hasPosted,
    userReaction,
    react,
    clearReaction,
    markAsPosted
  };
};
