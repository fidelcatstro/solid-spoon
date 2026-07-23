import { Activity, AlertTriangle, Gauge, Layout, Palette, Shield, Sparkles, Usb, Wifi } from 'lucide-react';

interface ChangeItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: ChangeItem[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4',
    date: 'Mar 2026',
    title: 'Diagnostics & DTC Code Lookup',
    changes: [
      {
        icon: <Activity className="w-4 h-4 text-cyan-400" />,
        title: 'Live Sensor Diagnostics',
        description: 'New Diagnostics page showing all ECU sensors live: MAP, VTC degree, VTEC, coolant, timing advance, injector pulse width, fuel trims, knock count, and more.',
      },
      {
        icon: <Sparkles className="w-4 h-4 text-green-400" />,
        title: 'Expandable Sensor Graphs',
        description: 'Tap any sensor to see a real-time scrolling graph with fixed operating ranges and a green "normal zone" band. Instantly see if a reading is healthy.',
      },
      {
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
        title: 'DTC Code Database',
        description: 'Swipe to the DTC Codes tab to see any check engine codes with plain-English descriptions, symptoms, and step-by-step fixes. Works completely offline.',
      },
    ],
  },
  {
    version: '1.3',
    date: 'Feb 2026',
    title: 'App Navigation & UI Overhaul',
    changes: [
      {
        icon: <Layout className="w-4 h-4 text-blue-400" />,
        title: 'Multi-Page Navigation',
        description: 'New sidebar with Home, Gauges, Quarter Mile, and Settings pages. Clean collapsible menu with icons.',
      },
      {
        icon: <Gauge className="w-4 h-4 text-green-400" />,
        title: 'Quarter Mile Timer',
        description: 'Dedicated drag timing page with reaction time, 60ft, 330ft, 660ft, and quarter mile splits.',
      },
      {
        icon: <Sparkles className="w-4 h-4 text-purple-400" />,
        title: 'Polished UI',
        description: 'Redesigned settings panel, cleaner header bar, professional look throughout. All gauge visuals preserved.',
      },
    ],
  },
  {
    version: '1.2',
    date: 'Feb 2026',
    title: 'Fixed RPM Zone Colors',
    changes: [
      {
        icon: <Shield className="w-4 h-4 text-red-400" />,
        title: 'Locked Red Zone (7000+ RPM)',
        description: 'The red zone above 7000 RPM now stays red no matter which color scheme you pick. Same for the yellow VTEC zone at 5000-7000 RPM.',
      },
    ],
  },
  {
    version: '1.1',
    date: 'Feb 2026',
    title: 'KPro V4 Native USB & Device Selection',
    changes: [
      {
        icon: <Usb className="w-4 h-4 text-blue-400" />,
        title: 'Native KPro V4 USB Protocol',
        description: 'Direct USB communication with your KPro ECU using the same protocol as HonDash. No more ELM327 adapters needed.',
      },
      {
        icon: <Sparkles className="w-4 h-4 text-purple-400" />,
        title: 'USB Device Selection Menu',
        description: 'New device picker lets you see all connected USB devices and choose which one to connect to.',
      },
      {
        icon: <Palette className="w-4 h-4 text-yellow-400" />,
        title: 'Improved Tachometer Display',
        description: 'RPM numbers stay white for readability. 5000-7000 RPM zone highlighted in yellow as VTEC reference.',
      },
      {
        icon: <Wifi className="w-4 h-4 text-cyan-400" />,
        title: 'Improved WiFi Hotspot',
        description: 'More reliable hotspot setup with better auto-start on boot.',
      },
    ],
  },
  {
    version: '1.0',
    date: 'Jan 2026',
    title: 'Initial Release',
    changes: [
      {
        icon: <Gauge className="w-4 h-4 text-green-400" />,
        title: 'Digital Gauge Cluster',
        description: 'Real-time gauges: tachometer, speedometer, coolant temp, A/F ratio, MAP, and fuel level.',
      },
      {
        icon: <Palette className="w-4 h-4 text-yellow-400" />,
        title: '6 Color Presets + Custom Colors',
        description: 'White, Blue, Red, Green, Yellow, or Multi-color themes with per-gauge overrides.',
      },
      {
        icon: <Layout className="w-4 h-4 text-green-400" />,
        title: 'Drag & Drop Layout',
        description: 'Rearrange gauges freely. Supports portrait and landscape with responsive sizing.',
      },
      {
        icon: <Wifi className="w-4 h-4 text-cyan-400" />,
        title: 'WiFi Hotspot for Phone Control',
        description: 'Pi creates "KProGauges" WiFi. Customize from your phone — works completely offline.',
      },
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className="h-full overflow-y-auto bg-background" data-testid="updates-page">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-white font-serif tracking-wide">Version History</h1>
          <p className="text-xs text-zinc-500 mt-1">All updates and changes</p>
        </div>

        <div className="space-y-4">
          {CHANGELOG.map((entry, idx) => (
            <div
              key={entry.version}
              className="rounded-xl border border-zinc-800 overflow-hidden"
              data-testid={`changelog-entry-${entry.version}`}
            >
              <div className={`px-4 py-3 flex items-center justify-between ${
                idx === 0
                  ? 'bg-green-500/10 border-b border-green-500/20'
                  : 'bg-zinc-800/60 border-b border-zinc-700/50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    idx === 0
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-zinc-700 text-zinc-400'
                  }`} data-testid={`badge-version-${entry.version}`}>
                    v{entry.version}
                  </span>
                  <span className="text-xs font-semibold text-zinc-200">{entry.title}</span>
                </div>
                <span className="text-[10px] text-zinc-500">{entry.date}</span>
              </div>

              <div className="p-3 space-y-2 bg-zinc-900/40">
                {entry.changes.map((change, ci) => (
                  <div key={ci} className="flex gap-2.5 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800/60">
                    <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {change.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-zinc-200 mb-0.5">{change.title}</h3>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{change.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
