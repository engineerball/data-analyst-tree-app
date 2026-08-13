const PREFIX = '#s=';

interface SharePayload {
  v: 1;
  done: string[];
}

export function encodeShareHash(done: ReadonlySet<string>): string {
  const payload: SharePayload = { v: 1, done: [...done].sort() };
  return PREFIX + base64UrlEncode(JSON.stringify(payload));
}

export function decodeShareHash(hash: string, validIds: ReadonlySet<string>): Set<string> | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(hash.slice(PREFIX.length))) as Partial<SharePayload> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1 || !Array.isArray(parsed.done)) return null;
    return new Set(parsed.done.filter((d): d is string => typeof d === 'string' && validIds.has(d)));
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
