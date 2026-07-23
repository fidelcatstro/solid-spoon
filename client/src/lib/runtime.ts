// Runtime helpers for the gauge cluster.
//
// In a normal browser the app hits the server it was loaded from
// (window.location.host). When the app runs as a Capacitor-wrapped
// standalone Android APK, there is no host to inherit from so the user
// can configure a custom server (e.g. a laptop on their LAN). When no
// host is configured, server-only features degrade gracefully.

const SERVER_HOST_KEY = 'kpro-server-host';
const NONE = '__none__';

type HostListener = (host: string | null) => void;
const listeners = new Set<HostListener>();

let cachedHost: string | null | undefined = undefined;

function readStored(): string | null {
  try {
    const raw = localStorage.getItem(SERVER_HOST_KEY);
    if (raw === null) return null;
    if (raw === '' || raw === NONE) return null;
    return raw;
  } catch {
    return null;
  }
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
  if (w.Capacitor?.isNativePlatform?.()) return true;
  if (typeof navigator !== 'undefined' && /Capacitor/i.test(navigator.userAgent)) return true;
  return false;
}

export function getNativePlatform(): 'android' | 'ios' | 'web' {
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  const p = w.Capacitor?.getPlatform?.();
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

/**
 * Returns the host to use for HTTP/WebSocket calls, or null when no
 * server should be contacted (standalone APK with no custom host set).
 */
export function getServerHost(): string | null {
  if (cachedHost !== undefined) return cachedHost;
  const stored = readStored();
  if (stored !== null) {
    cachedHost = stored;
  } else if (isStandaloneApp()) {
    // No default — user must configure a server, otherwise standalone-only.
    cachedHost = null;
  } else {
    cachedHost = (typeof window !== 'undefined' && window.location.host) || null;
  }
  return cachedHost;
}

export function setServerHost(host: string | null) {
  const clean = host?.trim() || '';
  try {
    if (!clean) {
      localStorage.removeItem(SERVER_HOST_KEY);
    } else {
      localStorage.setItem(SERVER_HOST_KEY, clean);
    }
  } catch {
    /* ignore */
  }
  cachedHost = clean ? clean : (isStandaloneApp() ? null : window.location.host);
  listeners.forEach((fn) => fn(cachedHost ?? null));
}

export function subscribeServerHost(fn: HostListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns true when the app should attempt to talk to a server. */
export function isServerConfigured(): boolean {
  return getServerHost() !== null;
}

/** Build a ws:// or wss:// url for the WebSocket endpoint, or null when not configured. */
export function getWebSocketUrl(pathname = '/ws'): string | null {
  const host = getServerHost();
  if (!host) return null;
  let scheme: 'ws' | 'wss' = 'ws';
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !isStandaloneApp()) {
    scheme = 'wss';
  }
  // If the user typed a full URL, respect their scheme.
  if (/^wss?:\/\//i.test(host)) return host.replace(/\/$/, '') + pathname;
  if (/^https:\/\//i.test(host)) return 'wss://' + host.replace(/^https:\/\//, '').replace(/\/$/, '') + pathname;
  if (/^http:\/\//i.test(host)) return 'ws://' + host.replace(/^http:\/\//, '').replace(/\/$/, '') + pathname;
  return `${scheme}://${host}${pathname}`;
}

/** Resolve an /api/... path against the configured server host. Returns null if no server. */
export function getApiUrl(path: string): string | null {
  const host = getServerHost();
  if (!host) return null;
  if (/^https?:\/\//i.test(host)) return host.replace(/\/$/, '') + path;
  // In a normal browser we keep relative URLs so cookies/CORS work as before.
  if (!isStandaloneApp() && host === window.location.host) return path;
  const scheme = (typeof window !== 'undefined' && window.location.protocol === 'https:' && !isStandaloneApp()) ? 'https' : 'http';
  return `${scheme}://${host}${path}`;
}

/** Quick reachability check for the configured server. */
export async function pingServer(timeoutMs = 4000): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = getApiUrl('/api/status');
  if (!url) return { ok: false, error: 'No server configured' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'include' });
    clearTimeout(t);
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'unreachable' };
  }
}
