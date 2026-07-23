import { AlertTriangle, Droplets, Thermometer, Gauge, ShieldAlert, Wrench } from 'lucide-react';
import type { WarningState } from '@shared/schema';

interface WarningBarProps {
  warnings: WarningState;
}

export function WarningBar({ warnings }: WarningBarProps) {
  const warningItems = [
    { key: 'checkEngine', icon: AlertTriangle, label: 'CEL', active: warnings.checkEngine },
    { key: 'lowFuel', icon: Droplets, label: 'FUEL', active: warnings.lowFuel },
    { key: 'highTemp', icon: Thermometer, label: 'TEMP', active: warnings.highTemp },
    { key: 'abs', icon: Gauge, label: 'ABS', active: warnings.abs },
    { key: 'srs', icon: ShieldAlert, label: 'SRS', active: warnings.srs },
    { key: 'maintenance', icon: Wrench, label: 'MAINT', active: warnings.maintenance },
  ];
  
  const activeWarnings = warningItems.filter(w => w.active);
  
  if (activeWarnings.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="flex items-center justify-center gap-6 py-2 px-4 bg-card/50 border-b border-border"
      data-testid="warning-bar"
    >
      {activeWarnings.map((warning) => (
        <div 
          key={warning.key}
          className="flex items-center gap-1 text-gauge-red animate-pulse"
        >
          <warning.icon className="w-4 h-4" />
          <span className="font-sans text-xs font-semibold tracking-wider">{warning.label}</span>
        </div>
      ))}
    </div>
  );
}
