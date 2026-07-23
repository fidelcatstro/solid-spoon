import type { GaugeColor, GaugeColors, ThemePreset } from '@shared/schema';

export const COLOR_HEX: Record<GaugeColor, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  blue: '#3b82f6',
  orange: '#f97316',
  green: '#22c55e',
  white: '#e2e8f0',
};

export const COLOR_HEX_DIM: Record<GaugeColor, string> = {
  red: '#7f1d1d',
  yellow: '#713f12',
  blue: '#1e3a5f',
  orange: '#7c2d12',
  green: '#14532d',
  white: '#334155',
};

export const COLOR_GLOW: Record<GaugeColor, string> = {
  red: 'rgba(239,68,68,0.6)',
  yellow: 'rgba(234,179,8,0.5)',
  blue: 'rgba(59,130,246,0.5)',
  orange: 'rgba(249,115,22,0.5)',
  green: 'rgba(34,197,94,0.4)',
  white: 'rgba(226,232,240,0.4)',
};

export const COLOR_GLOW_DIM: Record<GaugeColor, string> = {
  red: 'rgba(239,68,68,0.15)',
  yellow: 'rgba(234,179,8,0.12)',
  blue: 'rgba(59,130,246,0.12)',
  orange: 'rgba(249,115,22,0.12)',
  green: 'rgba(34,197,94,0.1)',
  white: 'rgba(226,232,240,0.1)',
};

export const COLOR_LABELS: Record<GaugeColor, string> = {
  red: 'Red',
  yellow: 'Yellow',
  blue: 'Blue',
  orange: 'Orange',
  green: 'Green',
  white: 'White',
};

export const THEME_PRESETS: Record<Exclude<ThemePreset, 'custom'>, GaugeColors> = {
  white: {
    tachometer: 'white',
    speedometer: 'white',
    coolant: 'white',
    fuel: 'white',
    afr: 'white',
    map: 'white',
    trip: 'white',
  },
  blue: {
    tachometer: 'blue',
    speedometer: 'blue',
    coolant: 'blue',
    fuel: 'blue',
    afr: 'blue',
    map: 'blue',
    trip: 'blue',
  },
  red: {
    tachometer: 'red',
    speedometer: 'red',
    coolant: 'red',
    fuel: 'red',
    afr: 'red',
    map: 'red',
    trip: 'red',
  },
  green: {
    tachometer: 'green',
    speedometer: 'green',
    coolant: 'green',
    fuel: 'green',
    afr: 'green',
    map: 'green',
    trip: 'green',
  },
  yellow: {
    tachometer: 'yellow',
    speedometer: 'yellow',
    coolant: 'yellow',
    fuel: 'yellow',
    afr: 'yellow',
    map: 'yellow',
    trip: 'yellow',
  },
  multicolor: {
    tachometer: 'green',
    speedometer: 'green',
    coolant: 'blue',
    fuel: 'yellow',
    afr: 'orange',
    map: 'blue',
    trip: 'green',
  },
};

export const PRESET_LABELS: Record<Exclude<ThemePreset, 'custom'>, string> = {
  white: 'White',
  blue: 'Blue',
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  multicolor: 'Multi',
};

export const GAUGE_LABELS: Record<keyof GaugeColors, string> = {
  tachometer: 'Tachometer',
  speedometer: 'Speedometer',
  coolant: 'Coolant',
  fuel: 'Fuel',
  afr: 'A/F Ratio',
  map: 'MAP',
  trip: 'Trip',
};

export function getGaugeColor(gaugeId: keyof GaugeColors, colors: GaugeColors): GaugeColor {
  return colors[gaugeId] || 'green';
}

export function getHex(color: GaugeColor): string {
  return COLOR_HEX[color];
}

export function getDimHex(color: GaugeColor): string {
  return COLOR_HEX_DIM[color];
}

export function getGlow(color: GaugeColor): string {
  return COLOR_GLOW[color];
}

export function getDimGlow(color: GaugeColor): string {
  return COLOR_GLOW_DIM[color];
}
