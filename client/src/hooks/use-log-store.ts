import { getWebSocketUrl, subscribeServerHost } from '@/lib/runtime';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  level: LogLevel;
  source: string;
  message: string;
  ts: number;
}

const MAX_ENTRIES = 500;
let entries: LogEntry[] = [];
let idCounter = 0;
let unreadErrors = 0;
let sessionStart = Date.now();

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn());
}

function addEntry(level: LogLevel, source: string, message: string, ts?: number) {
  const entry: LogEntry = { id: idCounter++, level, source, message, ts: ts ?? Date.now() };
  if (entries.length >= MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES + 1);
  }
  entries = [...entries, entry];
  if (level === 'error' || level === 'warn') unreadErrors++;
  notify();
}

export const logStore = {
  addLog(level: LogLevel, source: string, message: string) {
    addEntry(level, source, message);
  },
  getLogs(): LogEntry[] {
    return entries;
  },
  clearLogs() {
    entries = [];
    unreadErrors = 0;
    sessionStart = Date.now();
    idCounter = 0;
    notify();
  },
  getUnreadErrors(): number {
    return unreadErrors;
  },
  markRead() {
    unreadErrors = 0;
    notify();
  },
  getSessionStart(): number {
    return sessionStart;
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// ── Singleton WebSocket connection for log messages ───────────────────────────
let logWs: WebSocket | null = null;
let logWsInitialized = false;

export function initLogStore() {
  if (logWsInitialized) return;
  logWsInitialized = true;
  connectLogWs();
  // Re-bind to the new server when the user changes the host in settings.
  subscribeServerHost(() => {
    if (logWs) {
      try { logWs.close(); } catch { /* ignore */ }
      logWs = null;
    }
    connectLogWs();
  });
}

function connectLogWs() {
  if (logWs && logWs.readyState <= WebSocket.OPEN) return;
  const wsUrl = getWebSocketUrl('/ws');
  if (!wsUrl) {
    // Standalone app with no server configured — skip server log stream.
    return;
  }
  try {
    const ws = new WebSocket(wsUrl);
    logWs = ws;
    ws.onopen = () => {
      addEntry('info', 'Client', 'Connected to server');
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          addEntry(data.level as LogLevel, data.source, data.message, data.ts);
        } else if (data.type === 'log_batch' && Array.isArray(data.entries)) {
          for (const e of data.entries) {
            addEntry(e.level as LogLevel, e.source, e.message, e.ts);
          }
        }
      } catch (_e) {}
    };
    ws.onclose = () => {
      logWs = null;
      addEntry('warn', 'Client', 'Server connection lost — retrying in 4s');
      setTimeout(connectLogWs, 4000);
    };
    ws.onerror = () => {
      ws.close();
    };
  } catch (_e) {}
}
