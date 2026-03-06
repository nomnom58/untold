import { describe, it, expect } from 'vitest';
import type { Confession } from '../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const getPrunedSeenIds = (raw: { id: string, seenAt: number }[], now: number) => {
  const valid: { id: string, seenAt: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i];
    if ((now - x.seenAt) < THIRTY_DAYS_MS) valid.push(x);
  }
  valid.sort((a, b) => b.seenAt - a.seenAt);
  if (valid.length > 2000) valid.length = 2000;
  const ids = new Array<string>(valid.length);
  for (let i = 0; i < valid.length; i++) ids[i] = valid[i].id;
  return ids;
};

const buildAllSeenIds = (
  confessions: Confession[],
  historicalSeenIds: string[],
  servedIds: Set<string>,
  isUUID: (id: string) => boolean
) => {
  const seenSet = new Set<string>();
  for (let i = 0; i < confessions.length; i++) {
    const id = confessions[i].id;
    if (isUUID(id)) seenSet.add(id);
  }
  for (let i = 0; i < historicalSeenIds.length; i++) {
    const id = historicalSeenIds[i];
    if (isUUID(id)) seenSet.add(id);
  }
  servedIds.forEach((id) => {
    if (isUUID(id)) seenSet.add(id);
  });
  return Array.from(seenSet);
};

const isUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || id.length > 20;

describe('getPrunedSeenIds (pure)', () => {
  it('giới hạn kết quả tối đa 2000 ID và sort đúng thứ tự', () => {
    const now = Date.now();
    const items = [];
    for (let i = 0; i < 10000; i++) {
      items.push({ id: `id-${i.toString().padStart(4, '0')}`, seenAt: now - i * 1000 });
    }
    const result = getPrunedSeenIds(items, now);
    expect(result.length).toBeLessThanOrEqual(2000);
    for (let i = 1; i < result.length; i++) {
      const idxPrev = parseInt(result[i - 1].slice(3), 10);
      const idxCurr = parseInt(result[i].slice(3), 10);
      expect(idxPrev).toBeLessThan(idxCurr);
    }
  });

  it('bỏ các phần tử quá 30 ngày', () => {
    const now = Date.now();
    const within = { id: 'within', seenAt: now - (THIRTY_DAYS_MS - 1000) };
    const out = { id: 'out', seenAt: now - (THIRTY_DAYS_MS + 1000) };
    const result = getPrunedSeenIds([within, out], now);
    expect(result).toEqual(['within']);
  });
});

describe('buildAllSeenIds (pure)', () => {
  it('loại bỏ duplicate và chỉ trả về ID hợp lệ', () => {
    const confessions: Confession[] = [
      { id: 'a'.repeat(21), title: '', content: '', createdAt: '', readerCount: 0, reactionCount: 0, reactions: {} },
      { id: 'invalid', title: '', content: '', createdAt: '', readerCount: 0, reactionCount: 0, reactions: {} },
    ];
    const historical = ['duplicated', 'a'.repeat(21)];
    const served = new Set<string>(['duplicated', 'extra']);
    const all = buildAllSeenIds(confessions, historical, served, isUUID);
    expect(all.length).toBe(new Set(all).size);
    expect(all).not.toContain('invalid');
  });
});
