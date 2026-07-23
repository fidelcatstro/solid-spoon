import { useState, useEffect, useCallback } from 'react';
import { Usb, RefreshCw, Wifi, Server, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { getApiUrl, isServerConfigured } from '@/lib/runtime';

interface UsbDevice {
  vendorId: number;
  productId: number;
  name: string;
  isKpro: boolean;
  kproVersion: string | null;
  busNumber?: number;
  deviceAddress?: number;
  serialPort?: string;
  type?: string;
}

interface DeviceSelectorProps {
  onConnectionChange?: (connected: boolean, mode: string | null, deviceName: string | null) => void;
}

export function DeviceSelector({ onConnectionChange }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<UsbDevice[]>([]);
  const [ecuConnected, setEcuConnected] = useState(false);
  const [ecuDeviceName, setEcuDeviceName] = useState<string | null>(null);
  const [ecuMode, setEcuMode] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usbAvailable, setUsbAvailable] = useState(false);
  const [serialAvailable, setSerialAvailable] = useState(false);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const url = getApiUrl('/api/usb/devices');
    if (!url) {
      setError('No server configured. Open Settings → Server to set one.');
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setEcuConnected(data.ecuConnected);
        setEcuDeviceName(data.ecuDeviceName);
        setEcuMode(data.ecuConnectionMode);
        setUsbAvailable(data.usbLibAvailable);
        setSerialAvailable(data.serialLibAvailable);
      }
    } catch (e) {
      setError('Could not reach server');
    }
    setIsLoading(false);
  }, []);

  const connectDevice = useCallback(async (device: UsbDevice) => {
    setIsConnecting(true);
    setError(null);
    const url = getApiUrl('/api/usb/connect');
    if (!url) {
      setError('No server configured. Open Settings → Server to set one.');
      setIsConnecting(false);
      return;
    }
    try {
      const body = device.type === 'serial'
        ? { type: 'serial', serialPort: device.serialPort }
        : { vendorId: device.vendorId, productId: device.productId };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setEcuConnected(data.ecuConnected);
        setEcuDeviceName(data.ecuDeviceName);
        setEcuMode(data.ecuConnectionMode);
        if (onConnectionChange) {
          onConnectionChange(data.ecuConnected, data.ecuConnectionMode, data.ecuDeviceName);
        }
        if (data.success) {
          setIsOpen(false);
        } else {
          setError('Failed to connect. Check USB cable and permissions.');
        }
      }
    } catch (e) {
      setError('Connection failed');
    }
    setIsConnecting(false);
  }, [onConnectionChange]);

  const autoConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    const url = getApiUrl('/api/usb/connect');
    if (!url) {
      setError('No server configured. Open Settings → Server to set one.');
      setIsConnecting(false);
      return;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'auto' }),
      });
      if (res.ok) {
        const data = await res.json();
        setEcuConnected(data.ecuConnected);
        setEcuDeviceName(data.ecuDeviceName);
        setEcuMode(data.ecuConnectionMode);
        if (onConnectionChange) {
          onConnectionChange(data.ecuConnected, data.ecuConnectionMode, data.ecuDeviceName);
        }
        if (data.success) {
          setIsOpen(false);
        } else {
          setError('No KPro ECU found. Plug in USB cable and try again.');
        }
      }
    } catch (e) {
      setError('Auto-connect failed');
    }
    setIsConnecting(false);
  }, [onConnectionChange]);

  const disconnectDevice = useCallback(async () => {
    const url = getApiUrl('/api/usb/disconnect');
    if (!url) return;
    try {
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        setEcuConnected(false);
        setEcuDeviceName(null);
        setEcuMode(null);
        if (onConnectionChange) {
          onConnectionChange(false, null, null);
        }
      }
    } catch (e) {}
  }, [onConnectionChange]);

  useEffect(() => {
    if (!isServerConfigured()) return;
    fetchDevices();
    const interval = setInterval(fetchDevices, 8000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  useEffect(() => {
    if (isOpen) fetchDevices();
  }, [isOpen, fetchDevices]);

  const kproDevices = devices.filter(d => d.isKpro);
  const serialDevices = devices.filter(d => d.type === 'serial');
  const otherDevices = devices.filter(d => !d.isKpro && d.type !== 'serial');

  return (
    <div className="relative" data-testid="device-selector">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          ecuConnected 
            ? 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25' 
            : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100'
        }`}
        data-testid="button-device-selector"
      >
        {ecuConnected ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <Server className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{ecuDeviceName || 'ECU Connected'}</span>
            <span className="sm:hidden">ECU</span>
          </>
        ) : (
          <>
            <Usb className="w-3.5 h-3.5" />
            <span>Connect ECU</span>
          </>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 right-0 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden" data-testid="device-selector-dropdown">
            <div className="p-3 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-100">ECU Connection</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={fetchDevices}
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title="Refresh devices"
                    data-testid="button-refresh-devices"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                    data-testid="button-close-selector"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {ecuConnected && (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg p-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <div>
                      <div className="text-xs font-medium text-green-300">{ecuDeviceName}</div>
                      <div className="text-[10px] text-green-400/70">{ecuMode === 'kpro-usb' ? 'KPro Native USB' : 'Serial/ELM327'}</div>
                    </div>
                  </div>
                  <button
                    onClick={disconnectDevice}
                    className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                    data-testid="button-disconnect-device"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              <button
                onClick={autoConnect}
                disabled={isConnecting || ecuConnected}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-medium transition-colors"
                data-testid="button-auto-connect"
              >
                {isConnecting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                ) : (
                  <><Usb className="w-3.5 h-3.5" /> Auto-Detect KPro ECU</>
                )}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {kproDevices.length > 0 && (
                <div className="p-2">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">KPro ECU Devices</div>
                  {kproDevices.map((device, i) => (
                    <button
                      key={`kpro-${i}`}
                      onClick={() => connectDevice(device)}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-left group"
                      data-testid={`device-kpro-${i}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                        <Usb className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">{device.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {device.kproVersion?.toUpperCase()} &middot; {device.vendorId.toString(16)}:{device.productId.toString(16)}
                        </div>
                      </div>
                      <div className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Connect</div>
                    </button>
                  ))}
                </div>
              )}

              {serialDevices.length > 0 && (
                <div className="p-2 border-t border-zinc-800/50">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">Serial Ports</div>
                  {serialDevices.map((device, i) => (
                    <button
                      key={`serial-${i}`}
                      onClick={() => connectDevice(device)}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-left group"
                      data-testid={`device-serial-${i}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <Server className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">{device.name}</div>
                        <div className="text-[10px] text-zinc-500">ELM327 / OBD-II adapter</div>
                      </div>
                      <div className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Connect</div>
                    </button>
                  ))}
                </div>
              )}

              {kproDevices.length === 0 && serialDevices.length === 0 && (
                <div className="p-4 text-center">
                  <Usb className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <div className="text-xs text-zinc-400 mb-1">No USB devices detected</div>
                  <div className="text-[10px] text-zinc-500 leading-relaxed">
                    Plug your KPro USB cable into the Pi and tap refresh.
                    The KPro USB-B port connects to any Pi USB-A port.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-2 border-t border-zinc-800">
                <div className="text-[10px] text-red-400 bg-red-500/10 rounded-lg p-2 text-center">{error}</div>
              </div>
            )}

            <div className="p-2 border-t border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${usbAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                  USB {usbAvailable ? 'OK' : 'N/A'}
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${serialAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                  Serial {serialAvailable ? 'OK' : 'N/A'}
                </div>
                <div className="flex-1" />
                <Wifi className="w-3 h-3" />
                <span>Hotspot: 192.168.4.1</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
