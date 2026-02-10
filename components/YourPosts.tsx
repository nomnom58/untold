import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfessionCard from './ConfessionCard';
import { Confession } from '../types';

const MY_POSTS_IDS_KEY = 'untold_my_post_ids_v1';
const GLOBAL_DB_KEY = 'untold_mock_db_v1';

const YourPosts: React.FC = () => {
  const navigate = useNavigate();
  const [myConfessions, setMyConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated DB Fetch
    const myIds: string[] = JSON.parse(localStorage.getItem(MY_POSTS_IDS_KEY) || '[]');
    const savedDb: Confession[] = JSON.parse(localStorage.getItem(GLOBAL_DB_KEY) || '[]');
    
    // Query: SELECT * FROM confessions WHERE id IN (myIds)
    const myPosts = savedDb.filter(post => myIds.includes(post.id));
    setMyConfessions(myPosts);
    setLoading(false);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center pt-24 px-6 overflow-y-auto custom-scrollbar pb-12">
      <div className="w-full max-w-[550px] mb-8 flex justify-between items-end mx-auto">
        <div>
          <h1 className="text-white text-3xl font-black uppercase tracking-widest">Your stories</h1>
          <p className="text-white/60 text-sm mt-1">Stories you have shared on this device.</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="text-white/80 hover:text-white flex items-center gap-1 text-sm font-bold uppercase tracking-tighter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Back
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : myConfessions.length === 0 ? (
        <div className="bg-white/10 rounded-2xl p-12 text-center w-full max-w-[550px] border border-white/5 mx-auto">
          <p className="text-white/40 mb-6 italic text-lg">You haven't shared any stories yet.</p>
          <button 
            onClick={() => navigate('/write')}
            className="bg-white text-black px-8 py-3 rounded-full font-bold shadow-xl write-confession-btn"
          >
            Write your first story
          </button>
        </div>
      ) : (
        <div className="w-full max-w-[550px] flex flex-col items-center gap-12 mx-auto">
          {myConfessions.map((confession) => (
            <div key={confession.id} className="w-full flex justify-center">
               <ConfessionCard confession={confession} />
            </div>
          ))}
          
          {myConfessions.length > 0 && (
            <p className="text-white/20 text-xs italic mt-8 text-center w-full">
              Stories are stored locally on your device for this version.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default YourPosts;