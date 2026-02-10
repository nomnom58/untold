import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as any)[key];
  }
  return undefined;
};

const envUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const envKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const nodeEnv = getEnv('NODE_ENV');
const isProd = nodeEnv === 'production';

// Hardcoded fallback values for development/AI Studio preview
const FALLBACK_URL = 'https://ydtrzmpjcfyvuukyfzby.supabase.co';
const FALLBACK_KEY = 'sb_publishable_V_E6XVg7QSJcWa0mDdPm1w_DI5s5Ixp';

let supabaseUrl = envUrl;
let supabaseKey = envKey;

// Check for missing or placeholder 'undefined' strings sometimes injected by poorly configured environments
if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined' || supabaseKey === 'undefined') {
  if (isProd) {
    throw new Error("Missing Supabase env in production");
  } else {
    console.warn("SUPABASE FALLBACK ACTIVE (DEV ONLY) — remove before export/deploy");
    supabaseUrl = FALLBACK_URL;
    supabaseKey = FALLBACK_KEY;
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey);

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
