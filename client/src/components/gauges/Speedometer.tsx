import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_GLOW } from '@/lib/colors';

interface SpeedometerProps {
  speed: number;
  unit: 'mph' | 'kmh';
  color?: GaugeColor;
}

export function Speedometer({ speed, unit, color = 'green' }: SpeedometerProps) {
  const displaySpeed = unit === 'kmh' ? Math.round(speed * 1.60934) : Math.round(speed);
  const formattedSpeed = displaySpeed.toString().padStart(3, ' ');
  
  const hex = COLOR_HEX[color];
  const glow = COLOR_GLOW[color];
  const labelColor = color === 'white' ? '#94a3b8' : hex;
  
  return (
    <div className="flex flex-col items-end" data-testid="gauge-speedometer">
      <div className="flex items-baseline gap-1">
        <span 
          className="font-mono text-7xl font-bold tracking-tight"
          style={{ 
            color: hex,
            textShadow: `0 0 20px ${glow}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formattedSpeed.split('').map((char, i) => (
            <span 
              key={i} 
              className={char === ' ' ? 'opacity-20' : ''}
              style={{ display: 'inline-block', width: '0.6em', textAlign: 'center' }}
            >
              {char === ' ' ? '0' : char}
            </span>
          ))}
        </span>
      </div>
      <div className="flex gap-2 text-sm font-sans">
        <span style={{ color: unit === 'mph' ? labelColor : undefined }} className={unit !== 'mph' ? 'text-muted-foreground' : ''}>mph</span>
        <span className="text-muted-foreground">/</span>
        <span style={{ color: unit === 'kmh' ? labelColor : undefined }} className={unit !== 'kmh' ? 'text-muted-foreground' : ''}>km/h</span>
      </div>
    </div>
  );
}
