import type { Track, TrackId } from './data';

const PREFIX = '#s=';

export interface ShareData {
  track: TrackId;
  done: Set<string>;
}

interface SharePayloadV2 {
  v: 2;
  t: TrackId;
  done: string[];
}

export function encodeShareHash(track: TrackId, done: ReadonlySet<string>): string {
  const payload: SharePayloadV2 = { v: 2, t: track, done: [...done].sort() };
  return PREFIX + base64UrlEncode(JSON.stringify(payload));
}

export function decodeShareHash(hash: string, tracks: readonly Track[]): ShareData | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(hash.slice(PREFIX.length))) as {
      v?: unknown;
      t?: unknown;
      done?: unknown;
    } | null;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.done)) return null;
    const trackId = parsed.v === 1 ? 'data-analyst' : parsed.v === 2 ? parsed.t : null;
    const track = tracks.find(t => t.id === trackId);
    if (!track) return null;
    return {
      track: track.id,
      done: new Set(parsed.done.filter((d): d is string => typeof d === 'string' && track.byId.has(d))),
    };
  } catch {
    return null;
  }
}

function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}
