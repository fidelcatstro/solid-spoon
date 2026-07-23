import { useState, useEffect, useRef, useCallback } from 'react';
import { Bug, Trash2, Copy, CheckCheck, Filter, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { logStore, type LogEntry, type LogLevel, initLogStore } from '@/hooks/use-log-store';
import { useGaugeStore } from '@/hooks/use-gauge-store';

type FilterMode = 'all' | 'errors' | 'ecu' | 'connection';

const FILTER_SOURCES: Record<FilterMode, string[] | null> = {
  all: null,
  errors: null,
  ecu: ['KPro', 'Serial', 'ECU'],
  connection: ['WS', 'Client', 'Server', 'BT', 'USB'],
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatUptime(startMs: number): string {
  const sec = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const LEVEL_STYLES: Record<LogLevel, { badge: string; text: string; icon: typeof Info }> = {
  info:  { badge: 'bg-green-500/10 text-green-400 border-green-500/20',  text: 'text-zinc-300', icon: Info },
  warn:  { badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', text: 'text-yellow-200', icon: AlertTriangle },
  error: { badge: 'bg-red-500/10 text-red-400 border-red-500/20',       text: 'text-red-200',    icon: AlertCircle },
};

export default function DebugPage() {
  const [, forceUpdate] = useState(0);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [copied, setCopied] = useState(false);
  const [uptime, setUptime] = useState('00:00:00');
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const { telemetry, settings } = useGaugeStore();

  useEffect(() => {
    initLogStore();
    logStore.markRead();
    const unsub = logStore.subscribe(() => forceUpdate(n => n + 1));
    return unsub;
  }, []);

  useEffect(() => {
    const t = setInterval(() => setUptime(formatUptime(logStore.getSessionStart())), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  const allLogs = logStore.getLogs();

  const filtered = allLogs.filter(e => {
    if (filter === 'errors') return e.level === 'error' || e.level === 'warn';
    const sources = FILTER_SOURCES[filter];
    if (sources) return sources.some(s => e.source.toLowerCase().includes(s.toLowerCase()));
    return true;
  });

  const errorCount = allLogs.filter(e => e.level === 'error').length;
  const warnCount  = allLogs.filter(e => e.level === 'warn').length;

  const handleCopyReport = useCallback(async () => {
    const speed = settings.speedUnit === 'kmh' ? `${(telemetry.speed * 1.60934).toFixed(0)} km/h` : `${telemetry.speed.toFixed(0)} mph`;
    const temp  = settings.tempUnit === 'fahrenheit'
      ? `${((telemetry.coolantTemp * 9/5) + 32).toFixed(0)}°F`
      : `${telemetry.coolantTemp.toFixed(0)}°C`;

    const logLines = allLogs.slice(-100)
      .map(e => `[${formatTs(e.ts)}] [${e.level.toUpperCase().padEnd(5)}] [${e.source}] ${e.message}`)
      .join('\n');

    const dtcList = (telemetry.dtcCodes && telemetry.dtcCodes.length > 0)
      ? telemetry.dtcCodes.join(', ')
      : 'None';

    const report = [
      '=== KPro Gauge Cluster v1.4 — Diagnostic Report ===',
      `Generated : ${new Date().toLocaleString()}`,
      `Session   : ${uptime} uptime`,
      `Events    : ${allLogs.length} total | ${errorCount} errors | ${warnCount} warnings`,
      '',
      '=== Current Telemetry ===',
      `RPM       : ${telemetry.rpm.toFixed(0)}`,
      `Speed     : ${speed}`,
      `Coolant   : ${temp}`,
      `AFR       : ${telemetry.afr?.toFixed(2) ?? 'N/A'}`,
      `MAP       : ${telemetry.map?.toFixed(1) ?? 'N/A'} kPa`,
      `Fuel      : ${telemetry.fuelLevel?.toFixed(0) ?? 'N/A'}%`,
      `Battery   : ${telemetry.batteryVoltage?.toFixed(1) ?? 'N/A'} V`,
      `Oil Temp  : ${telemetry.oilTemp?.toFixed(0) ?? 'N/A'}°C`,
      `Oil Press : ${telemetry.oilPressure?.toFixed(0) ?? 'N/A'} psi`,
      `IAT       : ${telemetry.iat?.toFixed(0) ?? 'N/A'}°C`,
      `Gear      : ${telemetry.gear ?? 'N/A'}`,
      '',
      '=== Active DTC Codes ===',
      dtcList,
      '',
      '=== Recent Log (last 100 entries) ===',
      logLines,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_e) {
      const el = document.createElement('textarea');
      el.value = report;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [allLogs, telemetry, settings, uptime, errorCount, warnCount]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="page-debug">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Bug className="w-4 h-4 text-purple-400" />
          <h1 className="text-sm font-serif font-bold text-foreground tracking-wide">Debug Log</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-zinc-500">Uptime</span>
            <span className="text-zinc-300">{uptime}</span>
            <span className="text-zinc-700 mx-1">|</span>
            <span className="text-zinc-500">{allLogs.length} events</span>
            {errorCount > 0 && (
              <span className="text-red-400 ml-1">{errorCount} errors</span>
            )}
          </div>
          <button
            onClick={handleCopyReport}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              copied
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20'
            }`}
            data-testid="button-copy-report"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Report'}
          </button>
          <button
            onClick={() => logStore.clearLogs()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent hover:border-zinc-800 transition-colors"
            data-testid="button-clear-logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border/20 flex-shrink-0">
        <Filter className="w-3 h-3 text-zinc-600 mr-0.5" />
        {(['all', 'errors', 'ecu', 'connection'] as FilterMode[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
            }`}
            data-testid={`filter-${f}`}
          >
            {f === 'all' ? `All (${allLogs.length})` : f === 'errors' ? `Errors (${errorCount + warnCount})` : f}
          </button>
        ))}
        <div className="ml-auto">
          {!autoScrollRef.current && (
            <button
              onClick={() => {
                autoScrollRef.current = true;
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-md hover:bg-white/5"
            >
              ↓ Latest
            </button>
          )}
        </div>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed"
        data-testid="log-list"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
            <Bug className="w-8 h-8 opacity-30" />
            <p>No log entries yet</p>
            <p className="text-[10px]">Connect to the ECU to start seeing events</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {filtered.map((entry) => {
                const style = LEVEL_STYLES[entry.level];
                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-zinc-900 hover:bg-white/[0.02] ${
                      entry.level === 'error' ? 'bg-red-500/[0.03]' :
                      entry.level === 'warn'  ? 'bg-yellow-500/[0.02]' : ''
                    }`}
                    data-testid={`log-entry-${entry.id}`}
                  >
                    <td className="pl-4 pr-2 py-1 text-zinc-600 whitespace-nowrap w-28">
                      {formatTs(entry.ts)}
                    </td>
                    <td className="px-1 py-1 w-14">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold border ${style.badge}`}>
                        {entry.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-1 py-1 w-20 text-zinc-500 whitespace-nowrap">[{entry.source}]</td>
                    <td className={`px-2 py-1 pr-4 ${style.text} break-all`}>{entry.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-border/20 px-5 py-2 flex-shrink-0">
        <p className="text-[10px] text-zinc-600">
          "Copy Report" creates a full diagnostic snapshot — paste it directly into your chat with the assistant to get help with any issue.
        </p>
      </div>
    </div>
  );
}
