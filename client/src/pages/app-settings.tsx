import { useState, useEffect } from 'react';
import { Settings, Usb, Wifi, Server, Download, Monitor, Info, RefreshCw, Lock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { MasterDownloadDialog } from '@/components/MasterDownloadDialog';
import { AndroidDownloadCard } from '@/components/AndroidDownloadButton';
import { getServerHost, setServerHost, isStandaloneApp, pingServer, getApiUrl } from '@/lib/runtime';

interface ServerStatus {
  status: string;
  ecuConnected: boolean;
  demoMode: boolean;
}

interface UsbStatus {
  devices: Array<{ path: string; manufacturer?: string; productId?: string; vendorId?: string }>;
  ecuConnected: boolean;
  usbLibAvailable: boolean;
  serialPortAvailable: boolean;
}

export default function AppSettings() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [usbStatus, setUsbStatus] = useState<UsbStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const standalone = isStandaloneApp();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const statusUrl = getApiUrl('/api/status');
      const usbUrl = getApiUrl('/api/usb/devices');
      const [statusRes, usbRes] = await Promise.all([
        statusUrl ? fetch(statusUrl).then(r => r.json()).catch(() => null) : Promise.resolve(null),
        usbUrl ? fetch(usbUrl).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      ]);
      if (statusRes) setServerStatus(statusRes);
      if (usbRes) setUsbStatus(usbRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  return (
    <div className="h-full flex flex-col bg-background overflow-auto" data-testid="page-settings">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Settings className="w-4 h-4 text-blue-400" />
          <h1 className="text-sm font-serif font-bold text-foreground tracking-wide">Settings</h1>
        </div>
        <button
          onClick={fetchStatus}
          className={`p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors ${loading ? 'animate-spin' : ''}`}
          data-testid="button-refresh-status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="flex-1 p-5 space-y-4 max-w-2xl mx-auto w-full">
        <ServerSection />

        <SettingsSection title="Connection Status" icon={<Server className="w-4 h-4 text-green-400" />}>
          <StatusRow 
            label="Server" 
            value={serverStatus ? 'Online' : 'Checking...'} 
            status={serverStatus ? 'good' : 'neutral'} 
          />
          <StatusRow 
            label="ECU Connected" 
            value={serverStatus?.ecuConnected ? 'Yes' : 'No'} 
            status={serverStatus?.ecuConnected ? 'good' : 'neutral'} 
          />
          <StatusRow 
            label="Demo Mode" 
            value={serverStatus?.demoMode ? 'Active' : 'Off'} 
            status={serverStatus?.demoMode ? 'warn' : 'neutral'} 
          />
        </SettingsSection>

        <SettingsSection title="USB Devices" icon={<Usb className="w-4 h-4 text-blue-400" />}>
          <StatusRow 
            label="USB Library" 
            value={usbStatus?.usbLibAvailable ? 'Available' : 'Not installed'} 
            status={usbStatus?.usbLibAvailable ? 'good' : 'neutral'} 
          />
          <StatusRow 
            label="Serial Port" 
            value={usbStatus?.serialPortAvailable ? 'Available' : 'Not installed'} 
            status={usbStatus?.serialPortAvailable ? 'good' : 'neutral'} 
          />
          <StatusRow 
            label="Detected Devices" 
            value={`${usbStatus?.devices?.length || 0} found`} 
            status={(usbStatus?.devices?.length || 0) > 0 ? 'good' : 'neutral'} 
          />
        </SettingsSection>

        <SettingsSection title="WiFi Hotspot" icon={<Wifi className="w-4 h-4 text-cyan-400" />}>
          <div className="text-xs text-zinc-500 leading-relaxed">
            The Pi creates a WiFi hotspot called <span className="text-zinc-300 font-mono">"KProGauges"</span> so 
            you can connect your phone and control the gauges wirelessly. Set up via the 
            <span className="text-zinc-300"> setup-hotspot.sh</span> script in the install package.
          </div>
          <div className="text-[10px] text-zinc-600 mt-2">
            Default password: <span className="text-zinc-400 font-mono">kpro2000</span>
          </div>
        </SettingsSection>

        <SettingsSection title="Display" icon={<Monitor className="w-4 h-4 text-purple-400" />}>
          <div className="text-xs text-zinc-500 leading-relaxed">
            Gauge appearance settings (colors, layout, engine parameters, warnings) are available in the 
            <span className="text-zinc-300"> Gauge Cluster</span> page via the settings icon in the top-right corner.
          </div>
          <ForceLandscapeToggle />
        </SettingsSection>

        <SettingsSection title="Download Packages" icon={<Download className="w-4 h-4 text-yellow-400" />}>
          <div className="space-y-2">
            {!standalone && <AndroidDownloadCard />}
            <a
              href={getApiUrl('/api/download-offline') || '#'}
              download
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40 hover:border-zinc-600/50 transition-colors cursor-pointer"
              data-testid="link-download-chromium"
            >
              <Download className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-xs text-zinc-200 font-medium block">Pi + Chromium Package</span>
                <span className="text-[10px] text-zinc-500">Kiosk mode with Chromium browser on Pi screen</span>
              </div>
            </a>
            <a
              href={getApiUrl('/api/download-native') || '#'}
              download
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40 hover:border-zinc-600/50 transition-colors cursor-pointer"
              data-testid="link-download-native"
            >
              <Download className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-xs text-zinc-200 font-medium block">Pi Headless Package</span>
                <span className="text-[10px] text-zinc-500">Lightweight surf browser or phone-only via WiFi</span>
              </div>
            </a>
            <button
              type="button"
              onClick={() => setMasterOpen(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40 hover:border-zinc-600/50 transition-colors cursor-pointer text-left"
              data-testid="button-download-master"
            >
              <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs text-zinc-200 font-medium block">Master Bundle (Self-Host Kit)</span>
                <span className="text-[10px] text-zinc-500">Everything you need to host the download site on your own computer. Password-protected.</span>
              </div>
            </button>
          </div>
        </SettingsSection>
        <MasterDownloadDialog open={masterOpen} onOpenChange={setMasterOpen} />

        <SettingsSection title="About" icon={<Info className="w-4 h-4 text-zinc-400" />}>
          <StatusRow label="Version" value="v1.6" status="neutral" />
          <StatusRow label="Platform" value="Raspberry Pi 3B+" status="neutral" />
          <StatusRow label="ECU" value="Hondata KPro V4" status="neutral" />
          <StatusRow label="Protocol" value="USB Bulk Transfer" status="neutral" />
        </SettingsSection>
      </div>
    </div>
  );
}

const FORCE_LANDSCAPE_KEY = 'kpro-force-landscape';

function readForceLandscape(): 'auto' | 'on' | 'off' {
  try {
    const v = localStorage.getItem(FORCE_LANDSCAPE_KEY);
    if (v === 'true') return 'on';
    if (v === 'false') return 'off';
  } catch { /* ignore */ }
  return 'auto';
}

function ForceLandscapeToggle() {
  const [mode, setMode] = useState<'auto' | 'on' | 'off'>(readForceLandscape());

  const apply = (next: 'auto' | 'on' | 'off') => {
    try {
      if (next === 'auto') localStorage.removeItem(FORCE_LANDSCAPE_KEY);
      else localStorage.setItem(FORCE_LANDSCAPE_KEY, next === 'on' ? 'true' : 'false');
    } catch { /* ignore */ }
    setMode(next);
    try { window.dispatchEvent(new Event('kpro-force-landscape-changed')); } catch { /* ignore */ }
  };

  const opts: Array<{ value: 'auto' | 'on' | 'off'; label: string; hint: string }> = [
    { value: 'auto', label: 'Auto',  hint: 'Tablets locked landscape, phones rotate freely' },
    { value: 'on',   label: 'Always', hint: 'Force landscape on every device' },
    { value: 'off',  label: 'Never',  hint: 'Follow device rotation everywhere' },
  ];

  return (
    <div className="pt-2 mt-2 border-t border-zinc-800/60">
      <div className="text-[11px] text-zinc-400 font-semibold mb-1">Orientation</div>
      <div className="text-[10px] text-zinc-500 mb-2 leading-relaxed">
        Standalone Android app only. {opts.find(o => o.value === mode)?.hint}
      </div>
      <div className="flex gap-1.5" data-testid="group-force-landscape">
        {opts.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => apply(opt.value)}
            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
              mode === opt.value
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-100'
                : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:border-zinc-600/60 hover:text-zinc-200'
            }`}
            data-testid={`button-orientation-${opt.value}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ServerSection() {
  const [host, setHost] = useState<string>(() => getServerHost() ?? '');
  const [draft, setDraft] = useState<string>(() => getServerHost() ?? '');
  const [pingState, setPingState] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [pingMsg, setPingMsg] = useState<string>('');

  const runPing = async () => {
    setPingState('checking');
    setPingMsg('');
    const res = await pingServer();
    if (res.ok) {
      setPingState('ok');
      setPingMsg('Connected');
    } else {
      setPingState('fail');
      setPingMsg(res.error || `HTTP ${res.status ?? 'error'}`);
    }
  };

  useEffect(() => {
    if (host) runPing();
    else setPingState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const onSave = () => {
    const cleaned = draft.trim().replace(/\/+$/, '');
    setServerHost(cleaned || null);
    setHost(cleaned);
  };

  const onClear = () => {
    setServerHost(null);
    setDraft('');
    setHost('');
  };

  const statusChip = (() => {
    if (pingState === 'checking') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/60 text-zinc-300" data-testid="chip-server-status">
          <Loader2 className="w-3 h-3 animate-spin" /> checking…
        </span>
      );
    }
    if (pingState === 'ok') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/15 text-green-300" data-testid="chip-server-status">
          <CheckCircle2 className="w-3 h-3" /> connected
        </span>
      );
    }
    if (pingState === 'fail') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/15 text-red-300" data-testid="chip-server-status">
          <XCircle className="w-3 h-3" /> {pingMsg || 'unreachable'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/60 text-zinc-400" data-testid="chip-server-status">
        not configured
      </span>
    );
  })();

  return (
    <SettingsSection title="Server" icon={<Server className="w-4 h-4 text-cyan-400" />}>
      <div className="space-y-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Run the dashboard server on your laptop, desktop, or Pi and enter its address here.
          Leave blank to use USB / Bluetooth only.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="192.168.1.42:5000"
            spellCheck={false}
            className="flex-1 px-2 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-700/60 text-xs text-zinc-100 font-mono outline-none focus:border-cyan-500/50"
            data-testid="input-server-host"
          />
          <button
            onClick={onSave}
            className="px-3 py-1.5 rounded-md bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 text-[11px] font-medium hover:bg-cyan-500/30"
            data-testid="button-save-server"
          >
            Save
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 text-[11px] hover:bg-zinc-800"
            data-testid="button-clear-server"
          >
            Clear
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Active host: <span className="font-mono text-zinc-300">{host || '(none)'}</span>
          </span>
          {statusChip}
        </div>
      </div>
    </SettingsSection>
  );
}

function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden" data-testid={`section-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-800/20">
        {icon}
        <span className="text-xs font-semibold text-zinc-300">{title}</span>
      </div>
      <div className="p-4 space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function StatusRow({ label, value, status }: { label: string; value: string; status: 'good' | 'warn' | 'neutral' }) {
  const dotColor = status === 'good' ? 'bg-green-400' : status === 'warn' ? 'bg-yellow-400' : 'bg-zinc-600';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-300 font-mono">{value}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      </div>
    </div>
  );
}
