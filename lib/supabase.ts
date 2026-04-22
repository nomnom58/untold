import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  // Try Vite's import.meta.env first (Standard for Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = (import.meta.env as any)[key];
    if (val !== undefined) return val;
  }
  // Fallback to process.env for Node/CI environments
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as any)[key];
  }
  return undefined;
};

const envUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
const nodeEnv = getEnv('NODE_ENV') || (import.meta.env?.MODE);
const isProd = nodeEnv === 'production';

let supabaseUrl = envUrl;
let supabaseKey = envKey;

// Critical Error Handling: No more silent fallbacks to old/revoked keys
if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined' || supabaseKey === 'undefined') {
  const errorMsg = "MISSING SUPABASE CREDENTIALS. Please check your .env.local or Vercel Environment Variables.";
  if (isProd) {
    throw new Error(errorMsg);
  } else {
    console.error(`[Supabase Error] ${errorMsg}`);
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

/**
 * Centralized event tracking with Dev Mode protection.
 * If localStorage.getItem('is_dev_mode') === 'true', tracking is disabled.
 */
export const trackEvent = async (eventName: string, meta: any, options: { useFetch?: boolean } = {}) => {
  if (localStorage.getItem('is_dev_mode') === 'true') {
    console.info(`[DEV MODE] metrics disabled: ${eventName}`, meta);
    return;
  }

  if (options.useFetch) {
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/rest/v1/events`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify([{ event_name: eventName, meta }]),
        keepalive: true
      }).catch(() => {});
    }
  } else {
    try {
      await supabase.from('events').insert([{ event_name: eventName, meta }]);
    } catch (err) {
      console.warn(`Event logging failed: ${eventName}`, err);
    }
  }
};
