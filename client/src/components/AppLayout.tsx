import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { 
  Gauge, Timer, Settings, FileText, ChevronLeft, Menu, Home, Activity, Bug
} from 'lucide-react';
import { logStore, initLogStore } from '@/hooks/use-log-store';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home, description: 'Dashboard' },
  { path: '/gauges', label: 'Gauges', icon: Gauge, description: 'Live ECU data' },
  { path: '/quarter-mile', label: 'Quarter Mile', icon: Timer, description: 'Drag timer' },
  { path: '/diagnostics', label: 'Diagnostics', icon: Activity, description: 'Sensors & DTCs' },
  { path: '/debug', label: 'Debug', icon: Bug, description: 'Logs & errors' },
  { path: '/updates', label: 'Updates', icon: FileText, description: "What's new" },
  { path: '/settings', label: 'Settings', icon: Settings, description: 'App config' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [unreadErrors, setUnreadErrors] = useState(0);
  const [location] = useLocation();

  useEffect(() => {
    initLogStore();
    const unsub = logStore.subscribe(() => {
      setUnreadErrors(logStore.getUnreadErrors());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (location === '/debug') {
      logStore.markRead();
    }
  }, [location]);

  return (
    <div className="flex h-screen bg-background overflow-hidden" data-testid="app-layout">
      <aside 
        className={`flex flex-col border-r border-border/30 bg-zinc-950/80 transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-14' : 'w-48'
        }`}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between px-2 py-2.5 border-b border-border/20 h-12">
          {!collapsed && (
            <span className="text-[10px] font-serif text-foreground/70 tracking-widest pl-1.5 uppercase">KPro</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors mx-auto"
            data-testid="button-toggle-sidebar"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-2 space-y-0.5 px-1.5 overflow-y-auto" data-testid="nav-list">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            const showBadge = item.path === '/debug' && unreadErrors > 0 && !isActive;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-all relative ${
                    isActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/15'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <div className="relative flex-shrink-0">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-green-400' : ''}`} />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium block leading-tight">{item.label}</span>
                        {showBadge && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded-sm border border-red-500/30">
                            {unreadErrors > 9 ? '9+' : unreadErrors}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-600 block leading-tight">{item.description}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
}
