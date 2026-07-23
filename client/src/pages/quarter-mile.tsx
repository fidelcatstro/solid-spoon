import { useState, useRef, useCallback, useEffect } from 'react';
import { Timer, Play, Square, RotateCcw, Flag, Zap, Radio, Cpu } from 'lucide-react';
import { useGaugeStore } from '@/hooks/use-gauge-store';

interface TimingData {
  reactionTime: number | null;
  sixtyFoot: number | null;
  threeThirty: number | null;
  eighth: number | null;
  eighthSpeed: number | null;
  quarter: number | null;
  quarterSpeed: number | null;
  trapSpeed: number | null;
}

const emptyTiming: TimingData = {
  reactionTime: null, sixtyFoot: null, threeThirty: null,
  eighth: null, eighthSpeed: null, quarter: null, quarterSpeed: null, trapSpeed: null,
};

// Distance markers in meters
const DIST_60FT    = 18.288;
const DIST_330FT   = 100.584;
const DIST_EIGHTH  = 201.168;
const DIST_QUARTER = 402.336;
const LAUNCH_MPH   = 2.5;

function formatTime(t: number | null): string {
  if (t === null) return '-.---';
  return t.toFixed(3);
}
function formatSpeed(s: number | null): string {
  if (s === null) return '---';
  return s.toFixed(1);
}

export default function QuarterMile() {
  const { telemetry, settings } = useGaugeStore();
  const isLiveConnected = telemetry.rpm > 0 || telemetry.speed > 0;

  const [state, setState] = useState<'idle' | 'staging' | 'running' | 'finished'>('idle');
  const [timing, setTiming] = useState<TimingData>(emptyTiming);
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [bestQuarter, setBestQuarter] = useState<number | null>(null);
  const [usingLive, setUsingLive] = useState(false);

  const startTimeRef    = useRef<number>(0);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const distanceRef     = useRef(0);
  const lastTickRef     = useRef(0);
  const timingRef       = useRef<TimingData>(emptyTiming);
  const stateRef        = useRef<'idle' | 'staging' | 'running' | 'finished'>('idle');
  const simSpeedRef     = useRef(0);
  const usingLiveRef    = useRef(false);
  // Ref so the interval always reads the latest speed without stale closure
  const liveSpeedRef    = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { usingLiveRef.current = usingLive; }, [usingLive]);
  useEffect(() => { liveSpeedRef.current = telemetry.speed; }, [telemetry.speed]);

  const speedUnit = settings.speedUnit;
  const speedLabel = speedUnit === 'kmh' ? 'km/h' : 'mph';

  const startRun = useCallback((live: boolean) => {
    distanceRef.current = 0;
    lastTickRef.current = Date.now();
    timingRef.current = emptyTiming;
    simSpeedRef.current = 0;
    startTimeRef.current = Date.now();
    setUsingLive(live);
    usingLiveRef.current = live;
    setTiming(emptyTiming);
    setElapsed(0);
    setState('running');

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const e = (now - startTimeRef.current) / 1000;
      setElapsed(e);

      let speedMph: number;
      if (usingLiveRef.current) {
        speedMph = liveSpeedRef.current;
      } else {
        // Simulate a realistic speed curve
        const targetSpeed = Math.min(120, e * 22);
        simSpeedRef.current += (targetSpeed - simSpeedRef.current) * 0.08 + (Math.random() - 0.5) * 0.5;
        speedMph = Math.max(0, simSpeedRef.current);
      }

      setCurrentSpeed(speedMph);
      distanceRef.current += speedMph * 0.44704 * dt; // meters
      const dist = distanceRef.current;

      setTiming(prev => {
        const next = { ...prev };
        if (prev.sixtyFoot === null && dist >= DIST_60FT) {
          next.sixtyFoot = e;
        }
        if (prev.threeThirty === null && dist >= DIST_330FT) {
          next.threeThirty = e;
        }
        if (prev.eighth === null && dist >= DIST_EIGHTH) {
          next.eighth = e;
          next.eighthSpeed = speedMph;
        }
        if (prev.quarter === null && dist >= DIST_QUARTER) {
          next.quarter = e;
          next.quarterSpeed = speedMph;
          next.trapSpeed = speedMph;
          // Finish
          setElapsed(e);
          setState('finished');
          if (intervalRef.current) clearInterval(intervalRef.current);
          setBestQuarter(bq => (bq === null || e < bq) ? e : bq);
        }
        return next;
      });

      // Safety timeout: abort after 30s
      if (e > 30) {
        setState('finished');
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 16);
  }, []);

  const handleStage = useCallback(() => {
    setState('staging');
    setTiming(emptyTiming);
    setElapsed(0);
    setCurrentSpeed(0);

    if (isLiveConnected) {
      // Wait for actual launch (speed > threshold)
      const pollInterval = setInterval(() => {
        if (stateRef.current !== 'staging') { clearInterval(pollInterval); return; }
        if (liveSpeedRef.current >= LAUNCH_MPH) {
          clearInterval(pollInterval);
          startRun(true);
        }
      }, 50);
      stageTimerRef.current = setTimeout(() => {
        clearInterval(pollInterval);
        if (stateRef.current === 'staging') {
          // ECU connected but no launch after 60s — fall back to sim
          startRun(false);
        }
      }, 60000) as unknown as ReturnType<typeof setTimeout>;
    } else {
      // Simulation mode: random light delay
      const delay = 1500 + Math.random() * 2000;
      stageTimerRef.current = setTimeout(() => {
        if (stateRef.current === 'staging') startRun(false);
      }, delay);
    }
  }, [isLiveConnected, startRun, telemetry.speed]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    setState('idle');
    setElapsed(0);
    setCurrentSpeed(0);
    setTiming(emptyTiming);
  }, []);

  const handleReset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    setState('idle');
    setElapsed(0);
    setCurrentSpeed(0);
    setTiming(emptyTiming);
  }, []);

  const displaySpeed = speedUnit === 'kmh'
    ? (currentSpeed * 1.60934).toFixed(0)
    : currentSpeed.toFixed(0);

  const fmtSpeed = (mph: number | null) => {
    if (mph === null) return '---';
    const v = speedUnit === 'kmh' ? mph * 1.60934 : mph;
    return v.toFixed(1);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-auto" data-testid="page-quarter-mile">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Timer className="w-4 h-4 text-yellow-400" />
          <h1 className="text-sm font-serif font-bold text-foreground tracking-wide">Quarter Mile</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Live / Sim badge */}
          {state !== 'idle' && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
              usingLive
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }`}>
              {usingLive ? <Cpu className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
              {usingLive ? 'LIVE ECU' : 'SIMULATION'}
            </div>
          )}
          {bestQuarter !== null && (
            <div className="flex items-center gap-1.5">
              <Flag className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400 font-mono">BEST: {bestQuarter.toFixed(3)}s</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        <div className="w-full mb-8">
          <div className="text-center mb-6">
            <div className="text-5xl font-mono font-bold text-foreground tracking-tight" data-testid="text-elapsed-time">
              {elapsed.toFixed(3)}
            </div>
            {state === 'running' && (
              <div className="text-lg font-mono text-zinc-400 mt-1" data-testid="text-current-speed">
                {displaySpeed} <span className="text-sm">{speedLabel}</span>
              </div>
            )}
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
              {state === 'idle' ? 'Ready' : state === 'staging' ? (isLiveConnected ? 'Waiting for launch...' : 'Staging...') : state === 'running' ? 'Running' : 'Finished'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <TimingSplit label="60ft"     time={formatTime(timing.sixtyFoot)}  unit="s" />
            <TimingSplit label="330ft"    time={formatTime(timing.threeThirty)} unit="s" />
            <TimingSplit label="1/8 Mile" time={formatTime(timing.eighth)}      unit="s" speed={fmtSpeed(timing.eighthSpeed)} speedUnit={speedLabel} />
            <TimingSplit label="1/4 Mile" time={formatTime(timing.quarter)}     unit="s" speed={fmtSpeed(timing.quarterSpeed)} speedUnit={speedLabel} highlight />
            <TimingSplit label="Trap Speed" time={fmtSpeed(timing.trapSpeed)}   unit={speedLabel} />
            <TimingSplit label="Best ET"  time={bestQuarter !== null ? bestQuarter.toFixed(3) : '-.---'} unit="s" />
          </div>
        </div>

        <div className="flex gap-3 w-full max-w-xs">
          {state === 'idle' && (
            <button
              onClick={handleStage}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
              data-testid="button-stage"
            >
              <Play className="w-4 h-4" />
              Stage
            </button>
          )}
          {(state === 'staging' || state === 'running') && (
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              data-testid="button-stop"
            >
              <Square className="w-4 h-4" />
              Abort
            </button>
          )}
          {state === 'finished' && (
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold transition-colors"
              data-testid="button-reset"
            >
              <RotateCcw className="w-4 h-4" />
              New Run
            </button>
          )}
        </div>

        <p className="text-[10px] text-zinc-600 text-center mt-4 max-w-xs">
          {state === 'idle'
            ? isLiveConnected
              ? 'Stage and launch — timer starts when speed is detected.'
              : 'Press Stage to begin. Connect ECU for real timing.'
            : state === 'staging'
              ? isLiveConnected ? 'Release brake and launch — timer auto-starts.' : 'Waiting for green light...'
              : state === 'running' ? 'Run in progress...'
              : 'Run complete! Press New Run to go again.'}
        </p>
        {state === 'idle' && !isLiveConnected && (
          <p className="text-[10px] text-zinc-700 text-center mt-1 max-w-xs flex items-center gap-1 justify-center">
            <Radio className="w-3 h-3" /> Using simulation — no ECU data
          </p>
        )}
      </div>
    </div>
  );
}

function TimingSplit({ label, time, unit, speed, speedUnit, highlight }: {
  label: string;
  time: string;
  unit: string;
  speed?: string;
  speedUnit?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${
      highlight ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-zinc-900/50 border-zinc-800/50'
    }`} data-testid={`split-${label.toLowerCase().replace(/[\s/]/g, '-')}`}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-mono font-bold ${highlight ? 'text-yellow-400' : 'text-zinc-200'}`}>
          {time}
        </span>
        <span className="text-[10px] text-zinc-600">{unit}</span>
      </div>
      {speed && (
        <div className="text-[10px] text-zinc-500 mt-0.5">{speed} {speedUnit}</div>
      )}
    </div>
  );
}
