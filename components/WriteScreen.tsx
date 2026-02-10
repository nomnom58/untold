import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactionUnlock } from '../hooks/useReactionUnlock';
import SuccessPopup from './SuccessPopup';
import NoticePopup from './NoticePopup';
import { Confession } from '../types';
import { supabase, trackEvent as logEvent } from '../lib/supabase';

interface WriteScreenProps {
  onPost: () => void;
}

const MY_POSTS_IDS_KEY = 'untold_my_post_ids_v1';
const GLOBAL_DB_KEY = 'untold_mock_db_v1';
const SEEN_IDS_KEY = 'seen_confession_ids';
const SEEN_IDS_V2_KEY = 'seen_confession_ids_v2';
const ADMIN_MODE_KEY = 'untold_admin_mode';

// Anti-abuse Constants
const COOLDOWN_MS = 15000;
const QUOTA_LIMIT = 15;
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const ENABLE_DUPLICATE_GUARD = false;

const DEBUG_WRITE_RECEIPT = true;

const WriteScreen: React.FC<WriteScreenProps> = ({ onPost }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastPostedId, setLastPostedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSafetyBlocked, setIsSafetyBlocked] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  
  // Notice Popup State
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeCtaText, setNoticeCtaText] = useState('OK');
  const [noticeOnCta, setNoticeOnCta] = useState<() => void>(() => () => {});

  const openNotice = (t: string, b: string, cta: string = 'OK', onCta?: () => void) => {
    setNoticeTitle(t);
    setNoticeBody(b);
    setNoticeCtaText(cta);
    setNoticeOnCta(() => onCta || (() => setIsNoticeOpen(false)));
    setIsNoticeOpen(true);
  };
  
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { markAsPosted } = useReactionUnlock();

  const lastValidTitle = useRef('');

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus();
    }
  }, []);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const style = window.getComputedStyle(el);
    const lh = parseFloat(style.lineHeight);
    const maxHeight = Math.ceil(lh * 3);

    el.style.height = 'auto';
    const currentScrollHeight = el.scrollHeight;

    if (currentScrollHeight > maxHeight && title.length > 0) {
      setTitle(lastValidTitle.current);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    } else {
      lastValidTitle.current = title;
      el.style.height = `${currentScrollHeight}px`;
    }
  }, [title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!title.trim() && !content.trim()) || isSubmitting) return;

    // 1. Safety Keyword Check
    const text = `${title} ${content}`.toLowerCase();
    const safetyKeywords = ["suicide", "kill myself", "self harm", "end my life", "want to die", "hurt myself"];
    if (safetyKeywords.some(k => text.includes(k))) {
      setIsSafetyBlocked(true);
      logEvent('safety_blocked', { screen: "write" });
      return;
    }

    // 2. Anti-Abuse Checks
    const isDevMode = localStorage.getItem('is_dev_mode') === 'true';
    if (!isDevMode) {
      const now = Date.now();
      
      // Cooldown: 1 post / 15s
      const lastSubmitTs = Number(localStorage.getItem('abuse_last_submit_ts') || 0);
      if (now - lastSubmitTs < COOLDOWN_MS) {
        openNotice("Hold on", "Please wait about 15 seconds before posting again.", "Ok, I get it");
        return;
      }

      // Quota: 15 posts / 24h
      let timestamps: number[] = [];
      try {
        timestamps = JSON.parse(localStorage.getItem('abuse_submit_timestamps') || '[]');
      } catch (e) { timestamps = []; }
      const validTimestamps = timestamps.filter(ts => now - ts < QUOTA_WINDOW_MS);
      if (validTimestamps.length >= QUOTA_LIMIT) {
        openNotice(
          "Hold on", 
          "You’ve reached today’s posting limit. Please try again tomorrow.", 
          "Back to Home", 
          () => navigate('/')
        );
        return;
      }

      // Duplicate Guard (Disabled by default)
      if (ENABLE_DUPLICATE_GUARD) {
        const lastBody = localStorage.getItem('abuse_last_body');
        const lastBodyTs = Number(localStorage.getItem('abuse_last_body_ts') || 0);
        if (lastBody === content.trim() && (now - lastBodyTs < QUOTA_WINDOW_MS)) {
          openNotice("Hold on", "Looks like you already posted this. Please change it.");
          return;
        }
      }
    }
    
    setIsSubmitting(true);
    setReceipt(null); // Clear previous

    const s = supabase as any;
    const currentReceipt: any = {
      supabase_url_suffix: s.supabaseUrl?.slice(-20),
      supabase_key_suffix: s.supabaseKey?.slice(-8),
      target_table: 'confessions',
      payload_meta: { title_len: title.length, body_len: content.length },
      client_timestamp: new Date().toISOString()
    };

    try {
      let newId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);

      const { data: postData, error: postError } = await supabase
        .from('confessions')
        .insert([{ 
          title: title.trim() || null,
          body: content.trim() 
        }])
        .select()
        .single();

      if (postError) {
        currentReceipt.status = "ERROR";
        currentReceipt.error = { message: postError.message, code: postError.code };
        setReceipt(currentReceipt);
        setIsSubmitting(false);
        return; // STOP: do not show success UI
      }

      // SUCCESS FLOW
      const now = Date.now();
      currentReceipt.status = "SUCCESS";
      currentReceipt.inserted_id = postData.id;
      currentReceipt.inserted_at = postData.created_at;

      // Update Anti-Abuse Tracking
      localStorage.setItem('abuse_last_submit_ts', now.toString());
      let tsArr: number[] = [];
      try {
        tsArr = JSON.parse(localStorage.getItem('abuse_submit_timestamps') || '[]');
      } catch (e) {}
      const updatedTsArr = [...tsArr.filter(ts => now - ts < QUOTA_WINDOW_MS), now];
      localStorage.setItem('abuse_submit_timestamps', JSON.stringify(updatedTsArr));
      localStorage.setItem('abuse_last_body', content.trim());
      localStorage.setItem('abuse_last_body_ts', now.toString());

      // Follow-up Confirmation
      const { data: confirmData } = await supabase
        .from('confessions')
        .select('id')
        .eq('id', postData.id)
        .single();
      
      currentReceipt.db_confirm = confirmData ? "FOUND" : "NOT FOUND";
      setReceipt(currentReceipt);

      newId = postData.id;
      const isAdminSeed = localStorage.getItem(ADMIN_MODE_KEY) === '1';
      logEvent('submit_confession', { 
        confession_id: newId, 
        screen: "write",
        is_admin_seed: isAdminSeed
      });

      // Legacy V1 seen ids update
      let seenIds: string[] = JSON.parse(localStorage.getItem(SEEN_IDS_KEY) || '[]');
      if (!seenIds.includes(newId)) {
        seenIds.push(newId);
        if (seenIds.length > 30) seenIds.shift();
        localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(seenIds));
      }

      // V2 seen ids update (to sync with Home feed filtering)
      try {
        let seenV2: { id: string, seenAt: number }[] = JSON.parse(localStorage.getItem(SEEN_IDS_V2_KEY) || '[]');
        if (!seenV2.some(x => x.id === newId)) {
          seenV2.push({ id: newId, seenAt: Date.now() });
          localStorage.setItem(SEEN_IDS_V2_KEY, JSON.stringify(seenV2));
        }
      } catch (e) {}

      const newConfession: Confession = {
        id: newId,
        title: title.trim() || undefined,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        readerCount: 1,
        reactions: {}
      };

      const existingDb = JSON.parse(localStorage.getItem(GLOBAL_DB_KEY) || '[]');
      localStorage.setItem(GLOBAL_DB_KEY, JSON.stringify([newConfession, ...existingDb]));

      const myIds = JSON.parse(localStorage.getItem(MY_POSTS_IDS_KEY) || '[]');
      localStorage.setItem(MY_POSTS_IDS_KEY, JSON.stringify([newId, ...myIds]));
      
      setLastPostedId(newId);
      markAsPosted();
      onPost();
      setShowSuccess(true);
    } catch (err: any) {
      currentReceipt.status = "EXCEPTION";
      currentReceipt.error = { message: err.message };
      setReceipt(currentReceipt);
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      contentRef.current?.focus();
    }
  };

  const isFilled = (title.trim().length > 0 || content.trim().length > 0) && !isSubmitting;

  return (
    <div className="w-full flex-1 flex flex-col items-center pt-[100px] px-2 md:px-0 justify-start animate-[fadeIn_0.3s_ease-out] overflow-hidden">
      {showSuccess && (
        <SuccessPopup 
          onClose={() => navigate('/')} 
          onSeePost={() => navigate('/', { state: { focusId: lastPostedId } })} 
        />
      )}

      <NoticePopup 
        isOpen={isNoticeOpen}
        title={noticeTitle}
        body={noticeBody}
        ctaText={noticeCtaText}
        onClose={() => setIsNoticeOpen(false)}
        onCta={noticeOnCta}
      />

      {/* WRITE RECEIPT DIAGNOSTICS */}
      {DEBUG_WRITE_RECEIPT && receipt && (
        <div className="w-full md:w-[550px] bg-black text-[#00FF00] font-mono text-[10px] p-4 rounded-xl mb-4 border border-[#00FF00]/20 shadow-xl overflow-x-auto select-text z-50">
          <div className="flex justify-between items-center mb-2 border-b border-[#00FF00]/30 pb-1">
            <h3 className="font-bold uppercase tracking-widest">WRITE RECEIPT (DEV)</h3>
            <span className={receipt.status === 'ERROR' ? 'text-red-500' : 'text-green-500'}>{receipt.status}</span>
          </div>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      )}

      <div className="w-full md:w-[550px] h-[calc(100dvh-220px)] md:h-[70dvh] max-w-full flex flex-col relative mx-auto confession-card">
        <div className="w-full flex-1 bg-white rounded-none border border-black/5 p-4 md:p-5 flex flex-col overflow-hidden mb-6">
          {isSafetyBlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#E43630]/10 flex items-center justify-center text-[#E43630]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h3 className="text-[20px] font-bold text-black leading-tight">If you're feeling unsafe, please seek help.</h3>
              <p className="text-[16px] text-black/50 leading-relaxed">
                This space can't host content about self-harm. Please reach out to a support service or someone you trust.
              </p>
              <button 
                onClick={() => setIsSafetyBlocked(false)}
                className="mt-4 text-[#E43630] font-bold text-sm uppercase tracking-widest hover:underline"
              >
                Go back
              </button>
            </div>
          ) : (
            <>
              <textarea 
                ref={titleRef}
                placeholder="Confession title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                rows={1}
                disabled={isSubmitting}
                className={`w-full text-[20px] md:text-[24px] font-[500] border-none focus:ring-0 ${title.length > 0 ? 'text-[#373737]' : 'text-[#373737]/50'} placeholder:text-[#373737]/50 mb-10 outline-none shrink-0 resize-none whitespace-pre-wrap break-words leading-[1.5] transition-[color] duration-200 overflow-hidden`}
              />
              
              <textarea 
                ref={contentRef}
                required
                placeholder="Enter your story"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
                className={`w-full flex-1 text-[16px] md:text-[18px] font-[400] leading-[24px] ${content.length > 0 ? 'text-[#373737]' : 'text-[#373737]/50'} border-none focus:ring-0 placeholder:text-[#373737]/50 resize-none bg-transparent custom-scrollbar outline-none min-h-0 overflow-y-auto transition-colors duration-200`}
              />
            </>
          )}
        </div>

        <div className="w-full flex items-center gap-4 shrink-0 pb-2">
          <button 
            type="button"
            onClick={() => navigate('/')}
            disabled={isSubmitting}
            className="px-8 py-4 rounded-[14px] font-medium text-[16px] transition-all active:scale-95 border border-white text-white bg-transparent hover:bg-white/10 outline-none disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={!isFilled || isSafetyBlocked}
            className={`flex-1 py-4 rounded-[14px] font-medium text-[16px] transition-all active:scale-[0.98] outline-none ${
              isFilled && !isSafetyBlocked
              ? 'bg-white text-black shadow-xl' 
              : 'bg-white/50 text-black/30 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default WriteScreen;
