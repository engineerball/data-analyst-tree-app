import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACK, trackById, tracks } from './data';
import { depthOf } from './graph';

describe('track registry', () => {
  it('lists the data-analyst track first as the default', () => {
    expect(tracks[0]!.id).toBe('data-analyst');
    expect(DEFAULT_TRACK).toBe('data-analyst');
  });

  it('has unique track ids and a complete lookup map', () => {
    expect(new Set(tracks.map(t => t.id)).size).toBe(tracks.length);
    for (const t of tracks) expect(trackById.get(t.id)).toBe(t);
  });

  it('gives every track a title, tagline, and tutor framing', () => {
    for (const t of tracks) {
      expect(t.title.length, t.id).toBeGreaterThan(0);
      expect(t.tagline.length, t.id).toBeGreaterThan(0);
      expect(t.tutorRole.length, t.id).toBeGreaterThan(0);
      expect(t.tutorContext.length, t.id).toBeGreaterThan(0);
    }
  });
});

describe.each(tracks.map(t => [t.id, t] as const))('curriculum integrity: %s', (_id, track) => {
  const { concepts, byId } = track;
  const depth = depthOf(byId);

  it('has unique ids', () => {
    expect(new Set(concepts.map(c => c.id)).size).toBe(concepts.length);
  });

  it('lists every prerequisite earlier in the array', () => {
    const seen = new Set<string>();
    for (const c of concepts) {
      for (const p of c.pre) expect(seen.has(p), `${c.id} -> ${p}`).toBe(true);
      seen.add(c.id);
    }
  });

  it('indexes every concept in byId', () => {
    for (const c of concepts) expect(byId.get(c.id)).toBe(c);
  });

  it('has non-empty title, desc, and task on every concept', () => {
    for (const c of concepts) {
      expect(c.title.length, c.id).toBeGreaterThan(0);
      expect(c.desc.length, c.id).toBeGreaterThan(0);
      expect(c.task ?? '', c.id).not.toBe('');
    }
  });

  it('stays within the 8-category palette', () => {
    expect(new Set(concepts.map(c => c.cat)).size).toBeLessThanOrEqual(8);
  });

  it('has at least 3 root concepts and a connected depth range', () => {
    expect(concepts.filter(c => c.pre.length === 0).length).toBeGreaterThanOrEqual(3);
    const depths = concepts.map(c => depth.get(c.id)!);
    const max = Math.max(...depths);
    expect(Math.min(...depths)).toBe(1);
    expect(max).toBeGreaterThanOrEqual(4);
    expect(max).toBeLessThanOrEqual(8);
    for (let d = 1; d <= max; d++) {
      expect(depths.filter(x => x === d).length, `depth ${d} empty`).toBeGreaterThan(0);
    }
  });

  it('marks 3 to 5 concepts as bonus', () => {
    const bonus = concepts.filter(c => c.bonus).length;
    expect(bonus).toBeGreaterThanOrEqual(3);
    expect(bonus).toBeLessThanOrEqual(5);
  });

  it('never uses a bonus concept as a prerequisite of a core concept', () => {
    for (const c of concepts.filter(k => !k.bonus)) {
      for (const p of c.pre) {
        expect(byId.get(p)!.bonus, `${c.id} -> ${p}`).toBeUndefined();
      }
    }
  });
});
