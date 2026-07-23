import { useEffect, useState } from 'react';
import { Smartphone, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/runtime';

interface ApkStatus {
  available: boolean;
  version: string;
  filename: string;
  sizeBytes: number;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function useApkStatus() {
  const [status, setStatus] = useState<ApkStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const url = getApiUrl('/api/download-apk/status');
      if (!url) { setLoading(false); return; }
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as ApkStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const id = setInterval(run, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { status, loading };
}

const STEPS = [
  'Tap the download button. Your browser saves the APK to your Downloads folder.',
  'Open the APK from the download notification (or your file manager).',
  'If Android asks, tap "Settings" → enable "Allow from this source", go back, and tap Install.',
];

function HowToInstall() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
        data-testid="button-toggle-install-help"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        How to install on Android
      </button>
      {open && (
        <ol className="mt-2 ml-4 list-decimal text-[10px] text-zinc-400 space-y-1" data-testid="list-install-steps">
          {STEPS.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </div>
  );
}

/**
 * Compact "card" variant for Settings → Downloads (full-width row).
 */
export function AndroidDownloadCard() {
  const { status, loading } = useApkStatus();
  const url = getApiUrl('/api/download-apk');
  const available = !!status?.available;
  const sizeLabel = status ? formatSize(status.sizeBytes) : '';
  const version = status?.version ?? '';

  const baseClass = 'flex items-center gap-3 p-3 rounded-lg border transition-colors';
  const enabledClass = `${baseClass} bg-zinc-800/40 border-zinc-700/40 hover:border-zinc-600/50 cursor-pointer`;
  const disabledClass = `${baseClass} bg-zinc-900/40 border-zinc-800/40 opacity-70 cursor-not-allowed`;

  return (
    <div>
      {available && url ? (
        <a
          href={url}
          download={status?.filename}
          className={enabledClass}
          data-testid="link-download-apk"
        >
          <Smartphone className="w-4 h-4 text-green-400 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-zinc-200 font-medium block">
              Android App {version}
              {sizeLabel ? <span className="text-zinc-500 font-normal"> · {sizeLabel}</span> : null}
            </span>
            <span className="text-[10px] text-zinc-500">
              Real home-screen app for Android phones and tablets (Samsung Galaxy / Tab included).
              Works fully offline — no internet needed after install.
            </span>
          </div>
        </a>
      ) : (
        <div className={disabledClass} data-testid="link-download-apk-disabled" aria-disabled="true">
          {loading ? (
            <Loader2 className="w-4 h-4 text-zinc-500 flex-shrink-0 animate-spin" />
          ) : (
            <Smartphone className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <span className="text-xs text-zinc-300 font-medium block">
              Android App {version || ''} <span className="text-zinc-500 font-normal">· preparing</span>
            </span>
            <span className="text-[10px] text-zinc-500">
              {loading
                ? 'Checking availability…'
                : 'The APK is being prepared by the build pipeline. Check back shortly.'}
            </span>
          </div>
        </div>
      )}
      <HowToInstall />
    </div>
  );
}

/**
 * Inline "button" variant for the Gauge Cluster downloads strip.
 */
export function AndroidDownloadButtonInline() {
  const { status, loading } = useApkStatus();
  const url = getApiUrl('/api/download-apk');
  const available = !!status?.available;
  const sizeLabel = status ? formatSize(status.sizeBytes) : '';
  const version = status?.version ?? '';

  const base =
    'inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border transition-colors';

  return (
    <div className="flex flex-col items-center gap-1">
      {available && url ? (
        <a
          href={url}
          download={status?.filename}
          className={`${base} bg-secondary hover:bg-secondary/80 border-transparent text-secondary-foreground`}
          data-testid="link-download-apk-cluster"
        >
          <Smartphone className="w-4 h-4" />
          Android App {version}
          {sizeLabel ? <span className="opacity-60 font-normal">· {sizeLabel}</span> : null}
        </a>
      ) : (
        <span
          className={`${base} bg-secondary/30 border-transparent text-muted-foreground opacity-70 cursor-not-allowed`}
          data-testid="link-download-apk-cluster-disabled"
          aria-disabled="true"
          title={loading ? 'Checking availability…' : 'APK is being prepared. Check back shortly.'}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
          Android App {version} · preparing
        </span>
      )}
      <HowToInstall />
    </div>
  );
}
