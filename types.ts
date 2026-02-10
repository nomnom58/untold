
export interface Confession {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  readerCount: number;
  reactionCount?: number;
  reactions: { [key: string]: number };
}

export interface Topic {
  id: string;
  badge: string;
  headline: string;
  subtext: string;
}

export enum ReactionType {
  ME_TOO = 'me_too',
  WITH_YOU = 'with_you',
  HURTS = 'hurts',
  GET_IT = 'get_it'
}

export const REACTION_EMOJI: Record<string, string> = {
  [ReactionType.ME_TOO]: '❤️',
  [ReactionType.WITH_YOU]: '🥰',
  [ReactionType.HURTS]: '😢',
  [ReactionType.GET_IT]: '😉'
};

export const REACTION_LABELS: Record<string, string> = {
  [ReactionType.ME_TOO]: 'Me too',
  [ReactionType.WITH_YOU]: "I'm with you",
  [ReactionType.HURTS]: 'That hurts',
  [ReactionType.GET_IT]: 'I get it'
};

export interface LocalState {
  hasPosted: boolean;
  reactedConfessions: Record<string, string>;
}
