import { Gauge } from 'lucide-react';
import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_GLOW } from '@/lib/colors';

interface MAPGaugeProps {
  map: number;
  warningHigh: number;
  unit: 'kpa' | 'psi' | 'inhg' | 'bar';
  color?: GaugeColor;
}

const ATM_KPA = 101.325;

function kpaToInhg(kpa: number): number {
  return kpa * 0.29529983071445;
}

function kpaToPsi(kpa: number): number {
  return kpa * 0.145038;
}

function convertMapValue(kpa: number, unit: string): number {
  switch (unit) {
    case 'psi':
      return kpaToPsi(kpa);
    case 'inhg':
      return kpaToInhg(kpa);
    case 'bar':
      return kpa * 0.01;
    default:
      return kpa;
  }
}

export function MAPGauge({ map, warningHigh, unit, color = 'green' }: MAPGaugeProps) {
  const isWarning = map >= warningHigh;
  const isVacuum = map < ATM_KPA;
  const isBoost = map > ATM_KPA;

  const hex = COLOR_HEX[color];
  const glow = COLOR_GLOW[color];
  const redHex = COLOR_HEX.red;
  const yellowHex = COLOR_HEX.yellow;

  let displayValue: string;
  let displayUnit: string;

  if (unit === 'kpa') {
    displayValue = Math.round(map).toString();
    displayUnit = 'kPa';
  } else if (unit === 'bar') {
    displayValue = (map * 0.01).toFixed(2);
    displayUnit = 'bar';
  } else {
    if (isVacuum) {
      const vacuumKpa = ATM_KPA - map;
      const inhgValue = kpaToInhg(vacuumKpa);
      displayValue = inhgValue.toFixed(1);
      displayUnit = 'inHg';
    } else {
      const boostKpa = map - ATM_KPA;
      const psiValue = kpaToPsi(boostKpa);
      displayValue = psiValue.toFixed(1);
      displayUnit = 'PSI';
    }
  }

  const maxMap = 300;
  const percentage = (map / maxMap) * 100;

  const formatScaleValue = (kpa: number) => {
    if (unit === 'bar') return (kpa * 0.01).toFixed(2);
    if (unit === 'kpa') return Math.round(kpa).toString();
    return convertMapValue(kpa, 'inhg').toFixed(0);
  };

  const barColor = isWarning ? redHex : isBoost ? yellowHex : hex;
  const barGlow = isWarning ? COLOR_GLOW.red : isBoost ? COLOR_GLOW.yellow : glow;
  const valueColor = isWarning ? redHex : isBoost ? yellowHex : hex;
  
  return (
    <div className="flex flex-col gap-2" data-testid="gauge-map">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Gauge className="w-3 h-3 text-muted-foreground" />
          <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">MAP</span>
        </div>
        <span 
          className={`font-mono text-lg font-semibold ${isWarning ? 'animate-pulse' : ''}`}
          style={{ color: valueColor }}
        >
          {displayValue}
          <span className="text-xs text-muted-foreground ml-1">{displayUnit}</span>
        </span>
      </div>
      
      <div className="relative h-3 bg-muted/30 rounded-sm overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full rounded-sm"
          style={{ 
            width: `${Math.min(100, percentage)}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barGlow}`,
            transition: 'width 80ms linear, box-shadow 200ms ease',
          }}
        />
        <div 
          className="absolute top-0 w-[1px] h-full bg-foreground/40"
          style={{ left: `${(ATM_KPA / maxMap) * 100}%` }}
        />
      </div>
      
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{formatScaleValue(0)}</span>
        <span className="text-foreground/60">
          {unit === 'kpa' || unit === 'bar' ? 'ATM' : 'inHg / PSI'}
        </span>
        <span>{formatScaleValue(maxMap)}</span>
      </div>
    </div>
  );
}
