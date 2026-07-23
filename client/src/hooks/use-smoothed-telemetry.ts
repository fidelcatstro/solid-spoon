import { useRef, useCallback, useEffect, useState } from 'react';
import type { TelemetryData } from '@shared/schema';

const NUMERIC_KEYS: (keyof TelemetryData)[] = [
  'rpm', 'speed', 'coolantTemp', 'fuelLevel', 'afr', 'map', 'throttlePosition',
];

const OPTIONAL_NUMERIC_KEYS: (keyof TelemetryData)[] = [
  'oilPressure', 'oilTemp', 'batteryVoltage', 'iat', 'gear',
];

const LERP_SPEEDS: Partial<Record<keyof TelemetryData, number>> = {
  rpm: 0.18,
  speed: 0.14,
  coolantTemp: 0.06,
  fuelLevel: 0.04,
  afr: 0.20,
  map: 0.22,
  throttlePosition: 0.25,
  oilPressure: 0.08,
  oilTemp: 0.06,
  batteryVoltage: 0.10,
  iat: 0.06,
  gear: 0.5,
};

function lerp(current: number, target: number, speed: number): number {
  const diff = target - current;
  if (Math.abs(diff) < 0.01) return target;
  return current + diff * speed;
}

function hasLargeJump(a: TelemetryData, b: TelemetryData): boolean {
  const rpmDiff = Math.abs((a.rpm ?? 0) - (b.rpm ?? 0));
  const speedDiff = Math.abs((a.speed ?? 0) - (b.speed ?? 0));
  return rpmDiff > 3000 || speedDiff > 50;
}

export function useSmoothedTelemetry(rawTelemetry: TelemetryData): TelemetryData {
  const targetRef = useRef<TelemetryData>(rawTelemetry);
  const currentRef = useRef<TelemetryData>({ ...rawTelemetry });
  const prevRawRef = useRef<TelemetryData>(rawTelemetry);
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const [smoothed, setSmoothed] = useState<TelemetryData>(rawTelemetry);

  useEffect(() => {
    if (hasLargeJump(prevRawRef.current, rawTelemetry)) {
      currentRef.current = { ...rawTelemetry };
    }
    prevRawRef.current = rawTelemetry;
    targetRef.current = rawTelemetry;
  }, [rawTelemetry]);

  useEffect(() => {
    const onVisChange = () => {
      visibleRef.current = !document.hidden;
      if (!document.hidden) {
        currentRef.current = { ...targetRef.current };
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  const animate = useCallback(() => {
    if (!visibleRef.current) return;

    const target = targetRef.current;
    const current = currentRef.current;
    const next = { ...current };

    for (const key of NUMERIC_KEYS) {
      const t = target[key] as number;
      const c = current[key] as number;
      const speed = LERP_SPEEDS[key] ?? 0.15;
      (next as any)[key] = lerp(c, t, speed);
    }

    for (const key of OPTIONAL_NUMERIC_KEYS) {
      const t = target[key] as number | undefined;
      const c = current[key] as number | undefined;
      if (t !== undefined) {
        const speed = LERP_SPEEDS[key] ?? 0.15;
        (next as any)[key] = lerp(c ?? t, t, speed);
      } else {
        (next as any)[key] = undefined;
      }
    }

    next.checkEngine = target.checkEngine;
    next.vtec = target.vtec;

    currentRef.current = next;
    setSmoothed(next);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  return smoothed;
}
