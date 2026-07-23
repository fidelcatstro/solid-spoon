import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Download, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/runtime';

interface MasterDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MasterDownloadDialog({ open, onOpenChange }: MasterDownloadDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPassword('');
    setError(null);
    setBusy(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleDownload = async () => {
    if (!password) {
      setError('Enter the master password.');
      return;
    }
    setError(null);
    setBusy(true);
    const apiUrl = getApiUrl('/api/download-master');
    if (!apiUrl) {
      setError('No server configured. Open Settings → Server to set one.');
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'X-Master-Password': password },
      });

      if (res.status === 401) {
        setError('Incorrect password.');
        setBusy(false);
        return;
      }
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        setError(msg);
        setBusy(false);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || 'kpro-gauges-self-host.zip';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      reset();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Download failed.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-master-download">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-yellow-400" />
            Master Bundle (Self-Host Kit)
          </DialogTitle>
          <DialogDescription>
            Everything you need to host the download site on your own computer. Enter the master password to start the download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            type="password"
            placeholder="Master password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleDownload(); }}
            autoFocus
            data-testid="input-master-password"
          />
          {error && (
            <p className="text-xs text-red-400" data-testid="text-master-error">{error}</p>
          )}
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            After unzipping on your computer, run <span className="font-mono text-zinc-300">start.sh</span> (Mac/Linux) or <span className="font-mono text-zinc-300">start.bat</span> (Windows). The site will be available at <span className="font-mono text-zinc-300">http://your-ip:8080</span>.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={busy} data-testid="button-master-cancel">
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={busy} className="gap-2" data-testid="button-master-download">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? 'Preparing…' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
