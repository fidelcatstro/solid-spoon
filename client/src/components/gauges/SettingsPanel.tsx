import { useState } from 'react';
import { Settings, Palette, Gauge, Monitor, AlertTriangle, Layout, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { GaugeSettings, GaugeColor, GaugeColors, ThemePreset } from '@shared/schema';
import { gaugeColorValues } from '@shared/schema';
import { COLOR_HEX, THEME_PRESETS, PRESET_LABELS, GAUGE_LABELS } from '@/lib/colors';

interface SettingsPanelProps {
  settings: GaugeSettings;
  onSettingsChange: (settings: Partial<GaugeSettings>) => void;
  onResetLayout: () => void;
  editMode: boolean;
  onEditModeChange: (mode: boolean) => void;
  odometer: number;
  onOdometerChange: (value: number) => void;
}

function ColorSwatch({ color, selected, onClick, size = 'md' }: { 
  color: GaugeColor; 
  selected?: boolean; 
  onClick?: () => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return (
    <button
      onClick={onClick}
      className={`${dim} rounded-full border-2 transition-all ${
        selected ? 'border-white scale-110 shadow-lg' : 'border-zinc-700 hover:border-zinc-500'
      }`}
      style={{ backgroundColor: COLOR_HEX[color] }}
      data-testid={`swatch-${color}`}
    />
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800/60">
      {icon}
      <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{title}</span>
    </div>
  );
}

function SettingRow({ label, children, description }: { label: string; children: React.ReactNode; description?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs text-zinc-300">{label}</Label>
          {description && <p className="text-[10px] text-zinc-600 mt-0.5">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function SliderRow({ label, value, displayValue, min, max, step, onChange, testId }: {
  label: string; value: number; displayValue: string; min: number; max: number; step: number;
  onChange: (v: number) => void; testId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-300">{label}</Label>
        <span className="text-[11px] text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">{displayValue}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} data-testid={testId} />
    </div>
  );
}

export function SettingsPanel({ 
  settings, 
  onSettingsChange, 
  onResetLayout,
  editMode,
  onEditModeChange,
  odometer,
  onOdometerChange,
}: SettingsPanelProps) {
  const [odometerInput, setOdometerInput] = useState(odometer.toFixed(1));
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('colors');
  
  const displayOdometer = isEditing ? odometerInput : odometer.toFixed(1);
  
  const handleOdometerSave = () => {
    const value = parseFloat(odometerInput);
    if (!isNaN(value) && value >= 0) {
      onOdometerChange(value);
      setIsEditing(false);
    }
  };
  
  const handleOdometerFocus = () => {
    setIsEditing(true);
    setOdometerInput(odometer.toFixed(1));
  };

  const handlePresetSelect = (preset: ThemePreset) => {
    if (preset === 'custom') return;
    const colors = THEME_PRESETS[preset];
    onSettingsChange({ themePreset: preset, gaugeColors: { ...colors } });
  };

  const handleGaugeColorChange = (gaugeId: keyof GaugeColors, color: GaugeColor) => {
    const newColors = { ...settings.gaugeColors, [gaugeId]: color };
    onSettingsChange({ themePreset: 'custom', gaugeColors: newColors });
  };

  const sections = [
    { id: 'colors', label: 'Colors', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'engine', label: 'Engine', icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: 'display', label: 'Display', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'layout', label: 'Layout', icon: <Layout className="w-3.5 h-3.5" /> },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-settings">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] bg-zinc-950 border-zinc-800 p-0 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800/60">
          <h2 className="text-sm font-serif font-bold text-foreground tracking-wide">Gauge Settings</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">Customize your cluster appearance</p>
        </div>

        <div className="flex border-b border-zinc-800/60 px-2 py-1.5 gap-0.5 overflow-x-auto flex-shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeSection === s.id
                  ? 'bg-green-500/10 text-green-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
              data-testid={`tab-${s.id}`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {activeSection === 'colors' && (
            <div className="space-y-5">
              <div>
                <SectionHeader icon={<Palette className="w-3.5 h-3.5 text-yellow-400" />} title="Theme Presets" />
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(PRESET_LABELS) as Array<Exclude<ThemePreset, 'custom'>>).map((preset) => {
                    const presetColors = THEME_PRESETS[preset];
                    const isSelected = settings.themePreset === preset;
                    const previewColor = preset === 'multicolor' ? 'green' : presetColors.tachometer;
                    return (
                      <button
                        key={preset}
                        onClick={() => handlePresetSelect(preset)}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                          isSelected 
                            ? 'border-green-500/40 bg-green-500/5' 
                            : 'border-zinc-800/60 hover:border-zinc-700 bg-zinc-900/30'
                        }`}
                        data-testid={`preset-${preset}`}
                      >
                        <div 
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLOR_HEX[previewColor] }}
                        />
                        <span className="text-[11px] text-zinc-300">{PRESET_LABELS[preset]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <SectionHeader icon={<Palette className="w-3.5 h-3.5 text-purple-400" />} title="Per-Gauge Colors" />
                <div className="space-y-2.5">
                  {(Object.keys(GAUGE_LABELS) as Array<keyof GaugeColors>).map((gaugeId) => (
                    <div key={gaugeId} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 border border-zinc-800/40">
                      <span className="text-[11px] text-zinc-400">{GAUGE_LABELS[gaugeId]}</span>
                      <div className="flex gap-1">
                        {gaugeColorValues.map((c) => (
                          <ColorSwatch
                            key={c}
                            color={c}
                            size="sm"
                            selected={settings.gaugeColors[gaugeId] === c}
                            onClick={() => handleGaugeColorChange(gaugeId, c)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {settings.themePreset === 'custom' && (
                  <p className="text-[10px] text-zinc-600 mt-2">Custom color configuration active</p>
                )}
              </div>
            </div>
          )}

          {activeSection === 'engine' && (
            <div className="space-y-5">
              <SectionHeader icon={<Gauge className="w-3.5 h-3.5 text-green-400" />} title="RPM Settings" />
              <SliderRow label="Redline RPM" value={settings.redlineRpm} displayValue={`${settings.redlineRpm}`} min={5000} max={11000} step={100} onChange={(v) => onSettingsChange({ redlineRpm: v })} testId="slider-redline" />
              <SliderRow label="Shift Light RPM" value={settings.shiftLightRpm} displayValue={`${settings.shiftLightRpm}`} min={4000} max={10500} step={100} onChange={(v) => onSettingsChange({ shiftLightRpm: v })} testId="slider-shift-light" />
              <SliderRow label="Max RPM" value={settings.maxRpm} displayValue={`${settings.maxRpm}`} min={8000} max={12000} step={500} onChange={(v) => onSettingsChange({ maxRpm: v })} testId="slider-max-rpm" />

              <div className="pt-2">
                <SectionHeader icon={<Gauge className="w-3.5 h-3.5 text-blue-400" />} title="Vehicle" />
                <SliderRow label="Fuel Tank (gal)" value={settings.fuelTankCapacity} displayValue={`${settings.fuelTankCapacity}`} min={5} max={30} step={0.1} onChange={(v) => onSettingsChange({ fuelTankCapacity: v })} testId="slider-fuel-capacity" />
                
                <div className="space-y-1.5 mt-4">
                  <Label className="text-xs text-zinc-300">Odometer (miles)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={displayOdometer}
                      onChange={(e) => setOdometerInput(e.target.value)}
                      onFocus={handleOdometerFocus}
                      className="font-mono text-xs h-8 bg-zinc-900/50 border-zinc-800"
                      min={0}
                      step={0.1}
                      data-testid="input-odometer"
                    />
                    <Button onClick={handleOdometerSave} variant="secondary" size="sm" className="h-8 text-xs" data-testid="button-save-odometer">
                      Set
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'display' && (
            <div className="space-y-5">
              <SectionHeader icon={<Monitor className="w-3.5 h-3.5 text-purple-400" />} title="Units" />
              
              <SettingRow label="Speed">
                <div className="flex gap-1">
                  <Button size="sm" variant={settings.speedUnit === 'mph' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ speedUnit: 'mph' })} className="h-7 text-[11px] px-3" data-testid="button-speed-mph">MPH</Button>
                  <Button size="sm" variant={settings.speedUnit === 'kmh' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ speedUnit: 'kmh' })} className="h-7 text-[11px] px-3" data-testid="button-speed-kmh">KM/H</Button>
                </div>
              </SettingRow>
              
              <SettingRow label="Temperature">
                <div className="flex gap-1">
                  <Button size="sm" variant={settings.tempUnit === 'fahrenheit' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ tempUnit: 'fahrenheit' })} className="h-7 text-[11px] px-3" data-testid="button-temp-f">&deg;F</Button>
                  <Button size="sm" variant={settings.tempUnit === 'celsius' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ tempUnit: 'celsius' })} className="h-7 text-[11px] px-3" data-testid="button-temp-c">&deg;C</Button>
                </div>
              </SettingRow>

              <SettingRow label="MAP" description="inHg/PSI shows vacuum in inHg and boost in PSI">
                <div className="flex gap-1">
                  <Button size="sm" variant={settings.mapUnit === 'kpa' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ mapUnit: 'kpa' })} className="h-7 text-[11px] px-2" data-testid="button-map-kpa">kPa</Button>
                  <Button size="sm" variant={settings.mapUnit === 'inhg' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ mapUnit: 'inhg' })} className="h-7 text-[11px] px-2" data-testid="button-map-inhg">inHg</Button>
                  <Button size="sm" variant={settings.mapUnit === 'bar' ? 'default' : 'secondary'} onClick={() => onSettingsChange({ mapUnit: 'bar' })} className="h-7 text-[11px] px-2" data-testid="button-map-bar">bar</Button>
                </div>
              </SettingRow>

              <div className="pt-2">
                <SectionHeader icon={<Monitor className="w-3.5 h-3.5 text-yellow-400" />} title="Screen" />
                <SliderRow label="Brightness" value={settings.brightness} displayValue={`${settings.brightness}%`} min={20} max={100} step={5} onChange={(v) => onSettingsChange({ brightness: v })} testId="slider-brightness" />
              </div>
            </div>
          )}

          {activeSection === 'alerts' && (
            <div className="space-y-5">
              <SectionHeader icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />} title="Warning Thresholds" />
              <SliderRow label="Coolant Warning" value={settings.coolantWarningTemp} displayValue={`${settings.coolantWarningTemp}°C`} min={80} max={130} step={1} onChange={(v) => onSettingsChange({ coolantWarningTemp: v })} testId="slider-coolant-warning" />
              <SliderRow label="Low Fuel Warning" value={settings.lowFuelWarning} displayValue={`${settings.lowFuelWarning}%`} min={5} max={30} step={1} onChange={(v) => onSettingsChange({ lowFuelWarning: v })} testId="slider-fuel-warning" />
              <SliderRow label="AFR Target Low" value={settings.afrTargetLow} displayValue={`${settings.afrTargetLow}`} min={10} max={14} step={0.1} onChange={(v) => onSettingsChange({ afrTargetLow: v })} testId="slider-afr-low" />
              <SliderRow label="AFR Target High" value={settings.afrTargetHigh} displayValue={`${settings.afrTargetHigh}`} min={14} max={18} step={0.1} onChange={(v) => onSettingsChange({ afrTargetHigh: v })} testId="slider-afr-high" />
              <SliderRow label="MAP Warning" value={settings.mapWarningHigh} displayValue={`${settings.mapWarningHigh} kPa`} min={100} max={300} step={5} onChange={(v) => onSettingsChange({ mapWarningHigh: v })} testId="slider-map-warning" />
            </div>
          )}

          {activeSection === 'layout' && (
            <div className="space-y-5">
              <SectionHeader icon={<Layout className="w-3.5 h-3.5 text-cyan-400" />} title="Gauge Layout" />
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40">
                <div>
                  <Label className="text-xs text-zinc-300">Edit Mode</Label>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Drag and reposition gauges</p>
                </div>
                <Switch checked={editMode} onCheckedChange={onEditModeChange} data-testid="switch-edit-mode" />
              </div>
              
              <Button
                variant="secondary"
                onClick={onResetLayout}
                className="w-full gap-2 h-9 text-xs"
                data-testid="button-reset-layout"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Default Layout
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
