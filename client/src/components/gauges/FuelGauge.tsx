import { Fuel } from 'lucide-react';
import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_GLOW } from '@/lib/colors';

interface FuelGaugeProps {
  level: number;
  lowWarning: number;
  color?: GaugeColor;
}

export function FuelGauge({ level, lowWarning, color = 'green' }: FuelGaugeProps) {
  const segments = 8;
  const activeSegments = Math.ceil((level / 100) * segments);
  const isLow = level <= lowWarning;
  
  const hex = COLOR_HEX[color];
  const glow = COLOR_GLOW[color];
  const redHex = COLOR_HEX.red;
  const redGlow = COLOR_GLOW.red;
  
  return (
    <div className="flex flex-col gap-2" data-testid="gauge-fuel">
      <div className="flex items-center justify-end gap-2">
        <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">Fuel</span>
        <Fuel className={`w-4 h-4 ${isLow ? 'animate-pulse' : ''}`} style={{ color: isLow ? redHex : undefined }} />
      </div>
      
      <div className="flex items-center gap-1">
        <span className="font-sans text-xs text-foreground/60">E</span>
        <div className="flex gap-[2px] flex-1">
          {Array.from({ length: segments }, (_, i) => {
            const isActive = i < activeSegments;
            const isFirstBar = i === 0;
            const barColor = isFirstBar ? redHex : hex;
            const barGlow = isFirstBar ? redGlow : glow;
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
        <span className="font-sans text-xs text-foreground/60">F</span>
      </div>
      
      {isLow && (
        <div className="flex items-center justify-end gap-1 animate-pulse" style={{ color: redHex }}>
          <span className="font-sans text-xs font-semibold">LOW FUEL</span>
        </div>
      )}
    </div>
  );
}
