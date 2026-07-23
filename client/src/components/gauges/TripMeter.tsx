import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GaugeColor } from '@shared/schema';
import { COLOR_HEX, COLOR_GLOW } from '@/lib/colors';

interface TripMeterProps {
  odometer: number;
  tripA: number;
  tripB: number;
  unit: 'mph' | 'kmh';
  onResetTripA: () => void;
  onResetTripB: () => void;
  color?: GaugeColor;
}

export function TripMeter({ odometer, tripA, tripB, unit, onResetTripA, onResetTripB, color = 'green' }: TripMeterProps) {
  const [activeTrip, setActiveTrip] = useState<'A' | 'B'>('A');
  
  const hex = COLOR_HEX[color];
  const glow = COLOR_GLOW[color];
  
  const convertDistance = (miles: number) => {
    return unit === 'kmh' ? miles * 1.60934 : miles;
  };
  
  const formatOdometer = (value: number) => {
    return Math.floor(convertDistance(value)).toString().padStart(6, '0');
  };
  
  const formatTrip = (value: number) => {
    const converted = convertDistance(value);
    return converted.toFixed(1).padStart(5, ' ');
  };
  
  const currentTrip = activeTrip === 'A' ? tripA : tripB;
  const resetFn = activeTrip === 'A' ? onResetTripA : onResetTripB;
  
  return (
    <div className="flex flex-col items-center gap-1" data-testid="gauge-trip-meter">
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="font-sans text-[10px] text-muted-foreground uppercase">Trip</span>
          <button
            onClick={() => setActiveTrip(activeTrip === 'A' ? 'B' : 'A')}
            className="font-serif text-sm transition-colors"
            style={{ color: hex }}
            data-testid="button-toggle-trip"
          >
            {activeTrip}
          </button>
        </div>
        
        <div className="flex items-baseline">
          <span 
            className="font-mono text-xl tracking-tight"
            style={{ 
              color: hex,
              textShadow: `0 0 10px ${glow}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatOdometer(odometer)}
          </span>
          <span className="font-mono text-lg ml-2" style={{ color: hex }}>
            {formatTrip(currentTrip)}
          </span>
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={resetFn}
          data-testid="button-reset-trip"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>MAINT REQ'D</span>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTrip(activeTrip === 'A' ? 'B' : 'A')}
            className="hover:text-foreground"
            data-testid="button-sel-trip"
          >
            SEL
          </button>
          <button 
            onClick={resetFn}
            className="hover:text-foreground"
            data-testid="button-trip-reset"
          >
            TRIP
          </button>
        </div>
        <span>{unit === 'mph' ? 'mph' : 'km/h'}</span>
      </div>
    </div>
  );
}
