import { Link } from 'wouter';
import { Gauge, Timer, Settings, Usb, Wifi, ChevronRight, Server } from 'lucide-react';

const QUICK_LINKS = [
  { 
    path: '/gauges', 
    label: 'Gauge Cluster', 
    description: 'Live ECU telemetry with customizable gauges',
    icon: Gauge,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
  },
  { 
    path: '/quarter-mile', 
    label: 'Quarter Mile', 
    description: 'Drag strip timer with split times',
    icon: Timer,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
  },
  { 
    path: '/settings', 
    label: 'Settings', 
    description: 'App configuration, connectivity, and downloads',
    icon: Settings,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
];

export default function Home() {
  return (
    <div className="h-full flex flex-col bg-background overflow-auto" data-testid="page-home">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Gauge className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground tracking-wide" data-testid="text-home-title">
            KPro Gauge Cluster
          </h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
            Digital instrument cluster for Honda S2000 with Hondata KPro ECU
          </p>
          <span className="inline-block text-[10px] text-zinc-600 mt-2 px-2 py-0.5 rounded-full bg-zinc-800/50 border border-zinc-800">
            v1.6
          </span>
          <p className="text-[11px] text-emerald-400/80 mt-3" data-testid="text-offline-guarantee">
            Works fully offline. No internet needed after install.
          </p>
        </div>

        <div className="w-full space-y-3 mb-10">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.path} href={link.path}>
                <div 
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors hover:bg-white/5 ${link.bg}`}
                  data-testid={`link-${link.path.replace('/', '')}`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-zinc-900/60 flex items-center justify-center ${link.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-zinc-100 block">{link.label}</span>
                    <span className="text-[11px] text-zinc-500 block">{link.description}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-1.5">
              <Usb className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">USB</span>
            </div>
            <span className="text-xs text-zinc-400">KPro V4 Protocol</span>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-1.5">
              <Wifi className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">WiFi</span>
            </div>
            <span className="text-xs text-zinc-400">Phone Control Ready</span>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Server</span>
            </div>
            <span className="text-xs text-zinc-400">Any Browser Support</span>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2 mb-1.5">
              <Gauge className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Offline</span>
            </div>
            <span className="text-xs text-zinc-400">No Internet Needed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
