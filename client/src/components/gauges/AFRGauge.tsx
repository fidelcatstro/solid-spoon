import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_GLOW } from '@/lib/colors';

interface AFRGaugeProps {
  afr: number;
  targetLow: number;
  targetHigh: number;
  color?: GaugeColor;
}

export function AFRGauge({ afr, targetLow, targetHigh, color = 'green' }: AFRGaugeProps) {
  const isRich = afr < targetLow;
  const isLean = afr > targetHigh;
  const isOptimal = !isRich && !isLean;
  
  const minAfr = 10;
  const maxAfr = 18;
  const percentage = ((afr - minAfr) / (maxAfr - minAfr)) * 100;

  const hex = COLOR_HEX[color];
  const glow = COLOR_GLOW[color];
  const redHex = COLOR_HEX.red;
  const orangeHex = COLOR_HEX.orange;
  
  const valueColor = isRich ? orangeHex : isLean ? redHex : hex;
  const indicatorColor = isRich ? orangeHex : isLean ? redHex : hex;
  const indicatorGlow = isOptimal ? glow : isRich ? COLOR_GLOW.orange : COLOR_GLOW.red;
  
  return (
    <div className="flex flex-col gap-2" data-testid="gauge-afr">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">A/F Ratio</span>
        <span 
          className="font-mono text-lg font-semibold"
          style={{ 
            color: valueColor,
            textShadow: isOptimal ? `0 0 8px ${glow}` : 'none',
          }}
        >
          {afr.toFixed(1)}
        </span>
      </div>
      
      <div className="relative h-3 bg-muted/30 rounded-sm overflow-hidden">
        <div 
          className="absolute top-0 h-full opacity-30"
          style={{ 
            left: 0, 
            right: 0,
            background: `linear-gradient(to right, ${orangeHex}, ${hex}, ${redHex})`,
          }}
        />
        <div 
          className="absolute top-0 h-full"
          style={{ 
            left: `${((targetLow - minAfr) / (maxAfr - minAfr)) * 100}%`,
            width: `${((targetHigh - targetLow) / (maxAfr - minAfr)) * 100}%`,
            background: `${hex}33`,
          }}
        />
        <div 
          className="absolute top-0 w-1 h-full rounded-full"
          style={{ 
            backgroundColor: indicatorColor,
            left: `${Math.min(100, Math.max(0, percentage))}%`,
            transform: 'translateX(-50%)',
            boxShadow: `0 0 8px ${indicatorGlow}`,
            transition: 'left 80ms linear, box-shadow 200ms ease',
          }}
        />
      </div>
      
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>RICH</span>
        <span>STOICH</span>
        <span>LEAN</span>
      </div>
    </div>
  );
}
