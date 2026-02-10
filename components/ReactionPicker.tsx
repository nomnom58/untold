import React from 'react';
import { ReactionType, REACTION_LABELS, REACTION_EMOJI } from '../types';

interface ReactionPickerProps {
  onSelect: (key: string) => void;
  currentUserReaction?: string;
}

const reactions = [
  { key: ReactionType.ME_TOO, label: REACTION_LABELS[ReactionType.ME_TOO], emoji: REACTION_EMOJI[ReactionType.ME_TOO] },
  { key: ReactionType.WITH_YOU, label: REACTION_LABELS[ReactionType.WITH_YOU], emoji: REACTION_EMOJI[ReactionType.WITH_YOU] },
  { key: ReactionType.HURTS, label: REACTION_LABELS[ReactionType.HURTS], emoji: REACTION_EMOJI[ReactionType.HURTS] },
  { key: ReactionType.GET_IT, label: REACTION_LABELS[ReactionType.GET_IT], emoji: REACTION_EMOJI[ReactionType.GET_IT] },
];

const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelect, currentUserReaction }) => {
  return (
    <div className="bg-white p-4 rounded-[32px] shadow-[0px_8px_24px_rgba(0,0,0,0.15)] flex items-center gap-6 animate-in slide-in-from-bottom-2 fade-in duration-200">
      {reactions.map((r) => {
        const isSelected = currentUserReaction === r.key;

        return (
          <button 
            key={r.key}
            onClick={() => onSelect(r.key)}
            className="flex flex-col items-center group transition-all cursor-pointer outline-none min-w-fit"
          >
            <span className={`text-3xl mb-1 transition-transform ${isSelected ? 'scale-125' : 'group-hover:scale-125 group-active:scale-95'}`}>
              {r.emoji}
            </span>
            <span className={`text-[11px] font-medium whitespace-nowrap transition-colors ${isSelected ? 'text-[#FF6B9D]' : 'text-[#666]'}`}>
              {r.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ReactionPicker;