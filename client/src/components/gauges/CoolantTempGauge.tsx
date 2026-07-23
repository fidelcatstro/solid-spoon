import { Thermometer } from 'lucide-react';
import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_GLOW } from '@/lib/colors';

interface CoolantTempGaugeProps {
  temp: number;
  warningTemp: number;
  unit: 'celsius' | 'fahrenheit';
  color?: GaugeColor;
}

export function CoolantTempGauge({ temp, warningTemp, unit, color = 'green' }: CoolantTempGaugeProps) {
  const displayTemp = unit === 'celsius' ? temp : Math.round((temp * 9/5) + 32);
  const maxTemp = unit === 'celsius' ? 130 : 266;
  const minTemp = unit === 'celsius' ? 40 : 104;
  
  const percentage = Math.min(100, Math.max(0, ((displayTemp - minTemp) / (maxTemp - minTemp)) * 100));
  const isWarning = temp >= warningTemp;
  
  const segments = 8;
  const activeSegments = Math.ceil((percentage / 100) * segments);
  
  const hex = COLOR_HEX[color];
  const glow = COLOR_GLOW[color];
  const redHex = COLOR_HEX.red;
  const redGlow = COLOR_GLOW.red;
  
  return (
    <div className="flex flex-col gap-2" data-testid="gauge-coolant-temp">
      <div className="flex items-center gap-2">
        <Thermometer className="w-4 h-4 text-muted-foreground" />
        <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">Coolant</span>
      </div>
      
      <div className="flex items-center gap-1">
        <span className="font-sans text-xs text-foreground/60">C</span>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex gap-[2px]">
            {Array.from({ length: segments }, (_, i) => {
              const isActive = i < activeSegments;
              const isRedZone = i >= segments - 2;
              const barColor = isRedZone ? redHex : hex;
              const barGlow = isRedZone ? redGlow : glow;
              return (
                <div
                  key={i}
                  className="h-4 flex-1 rounded-sm transition-all duration-150"
                  style={{
                    backgroundColor: isActive ? barColor : 'hsl(var(--muted) / 0.3)',
                    boxShadow: isActive ? `0 0 6px ${barGlow}` : 'none',
                  }}
                />
              );
            })}
          </div>
          <div className="text-center">
            <span className="font-mono text-sm font-bold" style={{ color: isWarning ? redHex : hex }}>
              {displayTemp}&deg;{unit === 'celsius' ? 'C' : 'F'}
            </span>
          </div>
        </div>
        <span className="font-sans text-xs text-foreground/60">H</span>
      </div>
      
      {isWarning && (
        <div className="flex items-center gap-1 animate-pulse" style={{ color: redHex }}>
          <span className="font-sans text-xs font-semibold">HIGH TEMP</span>
        </div>
      )}
    </div>
  );
}
