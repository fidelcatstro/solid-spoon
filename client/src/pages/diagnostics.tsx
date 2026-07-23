import { useState, useRef, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useGaugeStore } from '@/hooks/use-gauge-store';
import type { TelemetryData } from '@shared/schema';
import { defaultTelemetry } from '@shared/schema';
import { dtcDatabase, type DTCEntry } from '@/lib/dtc-database';
import { getWebSocketUrl, subscribeServerHost } from '@/lib/runtime';

interface SensorConfig {
  key: keyof TelemetryData;
  label: string;
  unit: string;
  min: number;
  max: number;
  normalMin: number;
  normalMax: number;
  decimals: number;
  format?: (v: number) => string;
  isBoolean?: boolean;
}

const SENSOR_CONFIGS: SensorConfig[] = [
  { key: 'rpm', label: 'RPM', unit: 'rpm', min: 0, max: 9000, normalMin: 700, normalMax: 8000, decimals: 0 },
  { key: 'speed', label: 'Speed', unit: 'mph', min: 0, max: 180, normalMin: 0, normalMax: 160, decimals: 1 },
  { key: 'coolantTemp', label: 'Coolant Temp', unit: '°C', min: -10, max: 130, normalMin: 75, normalMax: 105, decimals: 1 },
  { key: 'map', label: 'MAP', unit: 'kPa', min: 0, max: 300, normalMin: 20, normalMax: 250, decimals: 1 },
  { key: 'afr', label: 'Air/Fuel Ratio', unit: 'λ', min: 10, max: 18, normalMin: 12.5, normalMax: 15.0, decimals: 2 },
  { key: 'throttlePosition', label: 'Throttle', unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 100, decimals: 1 },
  { key: 'vtcDegree', label: 'VTC Degree', unit: '°', min: -10, max: 50, normalMin: 0, normalMax: 40, decimals: 1 },
  { key: 'timingAdvance', label: 'Timing Advance', unit: '°', min: -10, max: 50, normalMin: 5, normalMax: 40, decimals: 1 },
  { key: 'injectorPulseWidth', label: 'Injector PW', unit: 'ms', min: 0, max: 20, normalMin: 1, normalMax: 12, decimals: 2 },
  { key: 'injectorDutyCycle', label: 'Injector Duty', unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 85, decimals: 1 },
  { key: 'iat', label: 'Intake Air Temp', unit: '°C', min: -20, max: 80, normalMin: 10, normalMax: 55, decimals: 1 },
  { key: 'oilTemp', label: 'Oil Temp', unit: '°C', min: 0, max: 150, normalMin: 70, normalMax: 120, decimals: 1 },
  { key: 'oilPressure', label: 'Oil Pressure', unit: 'psi', min: 0, max: 150, normalMin: 25, normalMax: 100, decimals: 1 },
  { key: 'batteryVoltage', label: 'Battery', unit: 'V', min: 10, max: 16, normalMin: 12.0, normalMax: 14.8, decimals: 1 },
  { key: 'stft', label: 'Short Fuel Trim', unit: '%', min: -25, max: 25, normalMin: -10, normalMax: 10, decimals: 1 },
  { key: 'ltft', label: 'Long Fuel Trim', unit: '%', min: -25, max: 25, normalMin: -10, normalMax: 10, decimals: 1 },
  { key: 'knockCount', label: 'Knock Count', unit: '', min: 0, max: 20, normalMin: 0, normalMax: 2, decimals: 0 },
  { key: 'fuelLevel', label: 'Fuel Level', unit: '%', min: 0, max: 100, normalMin: 15, normalMax: 100, decimals: 1 },
  { key: 'gear', label: 'Gear', unit: '', min: 0, max: 6, normalMin: 0, normalMax: 6, decimals: 0 },
];

const VTEC_CONFIG = { key: 'vtec' as keyof TelemetryData, label: 'VTEC', isBoolean: true };

const HISTORY_SECONDS = 30;
const HISTORY_SAMPLES = 300;

type HistoryMap = Record<string, { time: number; value: number }[]>;

function getStatus(value: number, config: SensorConfig): 'normal' | 'warning' | 'danger' {
  if (value >= config.normalMin && value <= config.normalMax) return 'normal';
  const rangeSize = config.max - config.min;
  const lowDanger = config.normalMin - rangeSize * 0.15;
  const highDanger = config.normalMax + rangeSize * 0.15;
  if (value < lowDanger || value > highDanger) return 'danger';
  return 'warning';
}

function SensorGraph({ config, history }: { config: SensorConfig; history: { time: number; value: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 12, right: 10, bottom: 20, left: 44 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);

    const range = config.max - config.min;
    const normalMinY = pad.top + plotH * (1 - (config.normalMin - config.min) / range);
    const normalMaxY = pad.top + plotH * (1 - (config.normalMax - config.min) / range);

    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.fillRect(pad.left, normalMaxY, plotW, normalMinY - normalMaxY);

    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, normalMaxY);
    ctx.lineTo(pad.left + plotW, normalMaxY);
    ctx.moveTo(pad.left, normalMinY);
    ctx.lineTo(pad.left + plotW, normalMinY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (plotH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      const val = config.max - (range / gridLines) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(config.decimals > 1 ? 1 : 0), pad.left - 4, y + 3);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 3; i++) {
      const x = pad.left + (plotW / 3) * i;
      const secAgo = HISTORY_SECONDS - (HISTORY_SECONDS / 3) * i;
      ctx.fillText(`-${secAgo.toFixed(0)}s`, x, h - 4);
    }

    if (history.length > 1) {
      const now = Date.now();
      const startTime = now - HISTORY_SECONDS * 1000;

      ctx.beginPath();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      let started = false;

      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        const x = pad.left + ((pt.time - startTime) / (HISTORY_SECONDS * 1000)) * plotW;
        const clampedVal = Math.max(config.min, Math.min(config.max, pt.value));
        const y = pad.top + plotH * (1 - (clampedVal - config.min) / range);

        if (x < pad.left) continue;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      if (history.length > 0) {
        const last = history[history.length - 1];
        const lx = pad.left + ((last.time - startTime) / (HISTORY_SECONDS * 1000)) * plotW;
        const lClamp = Math.max(config.min, Math.min(config.max, last.value));
        const ly = pad.top + plotH * (1 - (lClamp - config.min) / range);

        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      }
    }
  }, [history, config]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg"
      style={{ height: 160 }}
      data-testid={`graph-${config.key}`}
    />
  );
}

function SensorTile({
  config,
  value,
  expanded,
  onToggle,
  history,
}: {
  config: SensorConfig;
  value: number | undefined | null;
  expanded: boolean;
  onToggle: () => void;
  history: { time: number; value: number }[];
}) {
  const displayVal = value !== undefined && value !== null ? value : null;
  const status = displayVal !== null ? getStatus(displayVal, config) : 'normal';

  const statusColor =
    status === 'danger' ? 'border-red-500/40 bg-red-500/5' :
    status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
    'border-zinc-700/40 bg-zinc-900/40';

  const dotColor =
    status === 'danger' ? 'bg-red-400' :
    status === 'warning' ? 'bg-yellow-400' :
    'bg-green-400';

  return (
    <div
      className={`rounded-xl border transition-all ${statusColor} ${expanded ? 'col-span-1 sm:col-span-2' : ''}`}
      data-testid={`sensor-tile-${config.key}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left"
        data-testid={`button-expand-${config.key}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <div className="min-w-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider leading-tight">{config.label}</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-mono font-bold text-zinc-100 leading-none">
                {displayVal !== null ? displayVal.toFixed(config.decimals) : '—'}
              </span>
              <span className="text-[10px] text-zinc-500">{config.unit}</span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <SensorGraph config={config} history={history} />
          <div className="flex items-center justify-between mt-2 text-[9px] text-zinc-600">
            <span>Range: {config.min}–{config.max} {config.unit}</span>
            <span className="text-green-500/60">Normal: {config.normalMin}–{config.normalMax}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VtecTile({ active }: { active: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        active ? 'border-green-500/40 bg-green-500/10' : 'border-zinc-700/40 bg-zinc-900/40'
      }`}
      data-testid="sensor-tile-vtec"
    >
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider leading-tight">VTEC</div>
      <div className="flex items-center gap-2 mt-1">
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-400' : 'bg-zinc-600'}`} />
        <span className={`text-lg font-mono font-bold leading-none ${active ? 'text-green-400' : 'text-zinc-500'}`}>
          {active ? 'ENGAGED' : 'OFF'}
        </span>
      </div>
    </div>
  );
}

function DTCCard({ entry, expanded, onToggle }: { entry: DTCEntry; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden"
      data-testid={`dtc-card-${entry.code}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
        data-testid={`button-expand-dtc-${entry.code}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red-400">{entry.code}</span>
              <span className="text-xs text-zinc-300 font-medium truncate">{entry.title}</span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-red-500/10">
          <div className="pt-3">
            <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">What It Means</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">{entry.description}</p>
          </div>

          <div>
            <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Symptoms You May Notice</h4>
            <ul className="space-y-1">
              {entry.symptoms.map((s, i) => (
                <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Potential Fixes (Easiest → Hardest)</h4>
            <ol className="space-y-1.5">
              {entry.fixes.map((f, i) => (
                <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                  <span className="text-green-500 font-mono text-[10px] mt-0.5 flex-shrink-0">{i + 1}.</span>
                  {f}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Diagnostics() {
  const { telemetry, setTelemetry } = useGaugeStore();
  const [activeTab, setActiveTab] = useState<'sensors' | 'dtc'>('sensors');
  const [expandedSensor, setExpandedSensor] = useState<string | null>(null);
  const [expandedDTC, setExpandedDTC] = useState<string | null>(null);
  const historyRef = useRef<HistoryMap>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
      const url = getWebSocketUrl('/ws');
      if (!url) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') return;
            if (data.rpm !== undefined && typeof data.rpm === 'number') {
              const { _source, ...telemetryData } = data;
              setTelemetry(telemetryData as TelemetryData);
            }
          } catch (_e) {}
        };
        ws.onclose = () => {
          wsRef.current = null;
          setTimeout(connect, 3000);
        };
        ws.onerror = () => { ws.close(); };
      } catch (_e) {}
    }

    connect();
    // Re-bind whenever the user changes the server host in settings.
    const unsub = subscribeServerHost(() => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
      connect();
    });
    return () => {
      unsub();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [setTelemetry]);

  const updateHistory = useCallback((telemetryData: TelemetryData) => {
    const now = Date.now();
    const cutoff = now - HISTORY_SECONDS * 1000;

    for (const config of SENSOR_CONFIGS) {
      const val = telemetryData[config.key];
      if (val === undefined || val === null || typeof val === 'boolean') continue;

      if (!historyRef.current[config.key]) {
        historyRef.current[config.key] = [];
      }

      const arr = historyRef.current[config.key];
      arr.push({ time: now, value: val as number });

      while (arr.length > 0 && arr[0].time < cutoff) {
        arr.shift();
      }

      if (arr.length > HISTORY_SAMPLES) {
        historyRef.current[config.key] = arr.slice(-HISTORY_SAMPLES);
      }
    }
  }, []);

  useEffect(() => {
    updateHistory(telemetry);
  }, [telemetry, updateHistory]);

  const dtcCodes = telemetry.dtcCodes || [];
  const dtcEntries: DTCEntry[] = dtcCodes
    .map((code) => dtcDatabase[code.toUpperCase()])
    .filter((e): e is DTCEntry => e !== undefined);

  const unknownCodes = dtcCodes.filter((code) => !dtcDatabase[code.toUpperCase()]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" data-testid="page-diagnostics">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h1 className="text-sm font-serif font-bold text-foreground tracking-wide">Diagnostics</h1>
        </div>
        {dtcCodes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-400 font-mono">{dtcCodes.length} DTC{dtcCodes.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </header>

      <div className="flex border-b border-border/30 flex-shrink-0">
        <button
          onClick={() => setActiveTab('sensors')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'sensors'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          data-testid="tab-sensors"
        >
          Live Sensors
        </button>
        <button
          onClick={() => setActiveTab('dtc')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'dtc'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          data-testid="tab-dtc"
        >
          DTC Codes
          {dtcCodes.length > 0 && (
            <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'sensors' && (
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5" data-testid="sensor-grid">
              <VtecTile active={!!telemetry.vtec} />
              {SENSOR_CONFIGS.map((config) => (
                <SensorTile
                  key={config.key}
                  config={config}
                  value={telemetry[config.key] as number | undefined}
                  expanded={expandedSensor === config.key}
                  onToggle={() => setExpandedSensor(expandedSensor === config.key ? null : config.key)}
                  history={historyRef.current[config.key] || []}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dtc' && (
          <div className="p-4 space-y-3" data-testid="dtc-list">
            {dtcCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="dtc-no-codes">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-sm font-semibold text-green-400 mb-1">No Active Codes</h3>
                <p className="text-xs text-zinc-500 max-w-xs">
                  No check engine light or diagnostic trouble codes detected. Your engine is running clean.
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs text-zinc-500 mb-2">
                  {dtcCodes.length} active code{dtcCodes.length !== 1 ? 's' : ''} detected
                </div>
                {dtcEntries.map((entry) => (
                  <DTCCard
                    key={entry.code}
                    entry={entry}
                    expanded={expandedDTC === entry.code}
                    onToggle={() => setExpandedDTC(expandedDTC === entry.code ? null : entry.code)}
                  />
                ))}
                {unknownCodes.map((code) => (
                  <div
                    key={code}
                    className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4"
                    data-testid={`dtc-unknown-${code}`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-mono font-bold text-yellow-400">{code}</span>
                      <span className="text-xs text-zinc-400">Unknown Code</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2">
                      This code is not in the offline database. Search "{code}" online for details specific to your vehicle.
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
