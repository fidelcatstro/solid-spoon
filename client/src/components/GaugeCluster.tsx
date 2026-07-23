import { useEffect, useCallback, useState, useRef } from 'react';
import { Tachometer } from './gauges/Tachometer';
import { Speedometer } from './gauges/Speedometer';
import { CoolantTempGauge } from './gauges/CoolantTempGauge';
import { FuelGauge } from './gauges/FuelGauge';
import { AFRGauge } from './gauges/AFRGauge';
import { MAPGauge } from './gauges/MAPGauge';
import { TripMeter } from './gauges/TripMeter';
import { WarningBar } from './gauges/WarningBar';
import { BluetoothStatus } from './gauges/BluetoothStatus';
import { SettingsPanel } from './gauges/SettingsPanel';
import { DraggableGauge } from './gauges/DraggableGauge';
import { DeviceSelector } from './gauges/DeviceSelector';
import { useGaugeStore } from '@/hooks/use-gauge-store';
import { useOrientation } from '@/hooks/use-orientation';
import { Button } from '@/components/ui/button';
import { Move, RotateCcw, Smartphone, Bluetooth, Maximize, Minimize, Download, Usb, Server, Gauge, Lock } from 'lucide-react';
import { MasterDownloadDialog } from '@/components/MasterDownloadDialog';
import { AndroidDownloadButtonInline } from '@/components/AndroidDownloadButton';
import type { TelemetryData, WarningState } from '@shared/schema';
import { portraitLayout, defaultTelemetry } from '@shared/schema';
import { bluetoothService } from '@/lib/bluetooth';
import { serialService } from '@/lib/serial';
import { useSmoothedTelemetry } from '@/hooks/use-smoothed-telemetry';
import { logStore, initLogStore } from '@/hooks/use-log-store';
import { getWebSocketUrl, getApiUrl, isStandaloneApp, subscribeServerHost } from '@/lib/runtime';
import { nativeUsbService } from '@/lib/native-usb';
import { nativeBleService } from '@/lib/native-ble';

export function GaugeCluster() {
  const {
    telemetry,
    setTelemetry,
    settings,
    setSettings,
    tripData,
    resetTripA,
    resetTripB,
    setOdometer,
    layout,
    updateGaugePosition,
    resetLayout,
    bluetoothStatus,
    setBluetoothStatus,
    editMode,
    setEditMode,
  } = useGaugeStore();
  
  const wsRef = useRef<WebSocket | null>(null);
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const demoModeRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbPortName, setUsbPortName] = useState<string | null>(null);
  const [serverSerialConnected, setServerSerialConnected] = useState(false);
  const [dataSource, setDataSource] = useState<'demo' | 'ecu' | null>(null);
  const [serverUsbMode, setServerUsbMode] = useState(false);
  const serverUsbModeRef = useRef(false);
  const [masterOpen, setMasterOpen] = useState(false);
  
  const hasBluetooth = bluetoothService.isSupported();
  const hasSerial = serialService.isSupported();

  // Initialise log store once
  useEffect(() => { initLogStore(); }, []);

  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);
  
  useEffect(() => {
    serverUsbModeRef.current = serverUsbMode;
  }, [serverUsbMode]);
  
  const orientation = useOrientation();
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await clusterRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Fullscreen toggle failed:', e);
    }
  }, []);
  
  const isConnected = bluetoothStatus.connectionState === 'connected' || demoMode || usbConnected || serverUsbMode;
  
  const warnings: WarningState = {
    checkEngine: telemetry.checkEngine || ((telemetry.dtcCodes?.length ?? 0) > 0),
    lowFuel: telemetry.fuelLevel <= settings.lowFuelWarning,
    highTemp: telemetry.coolantTemp >= settings.coolantWarningTemp,
    lowOilPressure: telemetry.oilPressure != null && telemetry.oilPressure < 20,
    abs: false,
    srs: false,
    maintenance: false,
  };

  useEffect(() => {
    const unsubscribeState = bluetoothService.subscribe((state) => {
      setBluetoothStatus({
        connectionState: state.connectionState,
        connected: state.connectionState === 'connected',
        deviceName: state.connectedDevice?.name,
        deviceId: state.connectedDevice?.id,
        error: state.error ?? undefined,
        lastDataReceived: state.lastDataReceived ?? undefined,
        isSupported: bluetoothService.isSupported() || nativeBleService.isAvailable(),
        discoveredServices: state.discoveredServices,
      });
      
      if (state.connectionState === 'connected' && (demoMode || serverUsbMode)) {
        setDemoMode(false);
        setServerUsbMode(false);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    });

    const unsubscribeTelemetry = bluetoothService.subscribeTelemetry((data) => {
      if (bluetoothStatus.connectionState === 'connected') {
        setTelemetry(data);
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeTelemetry();
    };
  }, [setBluetoothStatus, setTelemetry, demoMode, bluetoothStatus.connectionState]);

  const handleScan = useCallback(async () => {
    // In the standalone Android APK the browser Web Bluetooth API is
    // unavailable, so route the connect action through the Capacitor BLE
    // plugin instead. The web build keeps using Web Bluetooth.
    if (isStandaloneApp() && nativeBleService.isAvailable()) {
      await nativeBleService.scanAndConnect();
      return;
    }
    await bluetoothService.scanAndConnect();
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (isStandaloneApp() && nativeBleService.isAvailable()) {
      await nativeBleService.disconnect().catch(() => { /* ignore */ });
    }
    if (isStandaloneApp() && nativeUsbService.isAvailable()) {
      await nativeUsbService.disconnect().catch(() => { /* ignore */ });
    }
    await bluetoothService.disconnect();
    await serialService.disconnect();
    setUsbConnected(false);
    setUsbPortName(null);
    setDemoMode(false);
    setServerUsbMode(false);
    setDataSource(null);
    setServerSerialConnected(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const handleUsbConnect = useCallback(async () => {
    await serialService.connect();
  }, []);

  useEffect(() => {
    const unsubState = serialService.subscribe((state) => {
      setUsbConnected(state.connectionState === 'connected');
      setUsbPortName(state.portName);
      if (state.connectionState === 'connected' && (demoMode || serverUsbMode)) {
        setDemoMode(false);
        setServerUsbMode(false);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    });

    const unsubTelemetry = serialService.subscribeTelemetry((data) => {
      if (serialService.getState().connectionState === 'connected') {
        setTelemetry(data);
      }
    });

    return () => { unsubState(); unsubTelemetry(); };
  }, [setTelemetry, demoMode]);

  // Track last data source to only log on change
  const lastDataSourceRef = useRef<'demo' | 'ecu' | null>(null);

  // Core WebSocket connection — always connect on mount, auto-detect ECU vs demo
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      return;
    }
    
    const wsUrl = getWebSocketUrl('/ws');
    if (!wsUrl) {
      // Standalone app with no server configured — skip WS entirely.
      return;
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logStore.addLog('info', 'Client', `WebSocket connected to ${wsUrl}`);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Skip log/log_batch — handled by use-log-store's own WS
          if (data.type === 'log' || data.type === 'log_batch') return;
          if (data.type === 'connected') {
            if (data.ecuConnected) {
              setServerSerialConnected(true);
              setServerUsbMode(true);
              logStore.addLog('info', 'Client', 'Server reports ECU connected on startup');
            }
            if (data.serialConnected) {
              setServerSerialConnected(true);
            }
            return;
          }
          if (data.rpm !== undefined && typeof data.rpm === 'number') {
            // Source-priority arbitration: a local transport (USB-OTG or
            // Bluetooth) always wins over server-relayed telemetry. If
            // either local source is currently connected, drop the WS
            // telemetry frame so the on-device data path stays
            // authoritative.
            const localUsb = usbConnected || (isStandaloneApp() && nativeUsbService.getStatus().state === 'connected');
            const localBle = bluetoothStatus.connectionState === 'connected'
              || (isStandaloneApp() && nativeBleService.getStatus().state === 'connected');
            if (localUsb || localBle) {
              return;
            }
            if (data._source === 'ecu') {
              if (lastDataSourceRef.current !== 'ecu') {
                logStore.addLog('info', 'ECU', 'Live ECU data stream started');
                lastDataSourceRef.current = 'ecu';
              }
              setDataSource('ecu');
              setServerSerialConnected(true);
              setServerUsbMode(true);
            } else {
              if (lastDataSourceRef.current !== 'demo') {
                logStore.addLog('info', 'Client', 'Demo mode auto-activated — no ECU connected');
                lastDataSourceRef.current = 'demo';
              }
              setDataSource('demo');
              if (!demoModeRef.current) setDemoMode(true);
            }
            const { _source, ...telemetryData } = data;
            setTelemetry(telemetryData as TelemetryData);
          }
        } catch (e) {
          logStore.addLog('error', 'Client', `Failed to parse server message: ${e}`);
        }
      };
      
      ws.onclose = () => {
        wsRef.current = null;
        logStore.addLog('warn', 'Client', 'WebSocket disconnected — reconnecting in 3s');
        lastDataSourceRef.current = null;
        setTimeout(() => {
          // Always reconnect unless Bluetooth or browser USB is active
          const btConnected = bluetoothStatus.connectionState === 'connected';
          if (!btConnected && !usbConnected) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = () => {
        logStore.addLog('error', 'Client', 'WebSocket error — connection failed');
        ws.close();
      };
    } catch (e) {
      logStore.addLog('error', 'Client', `Failed to create WebSocket: ${e}`);
    }
  }, [bluetoothStatus.connectionState, usbConnected, setTelemetry]);

  // Always connect WebSocket on mount — data flows automatically without user action
  useEffect(() => {
    connectWebSocket();

    // Reconnect when the user changes the server host in settings.
    const unsub = subscribeServerHost(() => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
      connectWebSocket();
    });

    return () => {
      unsub();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // ── Native Android transports ──────────────────────────────────────────────
  // When running inside the standalone APK, install USB-OTG auto-connect and
  // forward telemetry from the native plugins into the existing data path.
  useEffect(() => {
    if (!isStandaloneApp()) return;

    nativeUsbService.installAutoConnect().catch(() => { /* ignore */ });

    const unsubUsbState = nativeUsbService.subscribe((s) => {
      if (s.state === 'connected') {
        setUsbConnected(true);
        setUsbPortName(s.deviceName);
        setDemoMode(false);
        setServerUsbMode(false);
        logStore.addLog('info', 'USB', `Android USB connected: ${s.deviceName} (${s.protocol})`);
      } else if (s.state === 'idle') {
        setUsbConnected(false);
        setUsbPortName(null);
      } else if (s.state === 'error' && s.error) {
        logStore.addLog('warn', 'USB', s.error);
      }
    });
    const unsubUsbTelemetry = nativeUsbService.subscribeTelemetry((data) => {
      setTelemetry(data);
    });

    const unsubBleState = nativeBleService.subscribe((s) => {
      if (s.state === 'connected') {
        setBluetoothStatus({
          connectionState: 'connected',
          connected: true,
          deviceName: s.deviceName ?? undefined,
          deviceId: s.deviceId ?? undefined,
          isSupported: true,
        });
        setDemoMode(false);
        setServerUsbMode(false);
        logStore.addLog('info', 'BLE', `Android Bluetooth connected: ${s.deviceName}`);
      } else if (s.state === 'scanning' || s.state === 'connecting') {
        setBluetoothStatus(prev => ({
          ...prev,
          connectionState: s.state === 'scanning' ? 'scanning' : 'connecting',
          connected: false,
          isSupported: true,
        }));
      } else if (s.state === 'idle') {
        setBluetoothStatus(prev => ({ ...prev, connectionState: 'idle', connected: false, isSupported: prev.isSupported || true }));
      } else if (s.state === 'error') {
        setBluetoothStatus(prev => ({ ...prev, connectionState: 'error', connected: false, error: s.error ?? undefined, isSupported: true }));
      }
    });
    const unsubBleTelemetry = nativeBleService.subscribeTelemetry((data) => {
      setTelemetry(data);
    });

    return () => {
      unsubUsbState();
      unsubUsbTelemetry();
      unsubBleState();
      unsubBleTelemetry();
    };
  }, []);

  const enableDemoMode = useCallback(() => {
    setDemoMode(true);
    setServerUsbMode(false);
    setDataSource('demo');
    setServerSerialConnected(false);
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      connectWebSocket();
    }
  }, [connectWebSocket]);
  
  const enableServerUsb = useCallback(() => {
    setServerUsbMode(true);
    setDemoMode(false);
    setDataSource(null);
    setServerSerialConnected(false);
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      connectWebSocket();
    }
  }, [connectWebSocket]);

  // Legacy wrapper kept so old call-sites still compile
  const connectWebSocketDemo = connectWebSocket;
  
  const getGaugePosition = (id: string) => {
    if (orientation === 'portrait') {
      const portraitPos = portraitLayout.gauges.find(g => g.id === id);
      if (portraitPos) return portraitPos;
    }
    const found = layout.gauges.find(g => g.id === id);
    if (found) return { scale: 100, ...found };
    return {
      id,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      visible: true,
      scale: 100,
    };
  };

  const rawDisplayTelemetry = isConnected ? telemetry : defaultTelemetry;
  const displayTelemetry = useSmoothedTelemetry(rawDisplayTelemetry);
  
  return (
    <div 
      ref={clusterRef}
      className="h-full bg-background flex flex-col select-none overflow-hidden"
      style={{ 
        filter: `brightness(${settings.brightness / 100})`,
      }}
      data-testid="gauge-cluster"
    >
      <WarningBar warnings={warnings} />
      
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BluetoothStatus 
            status={bluetoothStatus} 
            onScan={handleScan}
            onDisconnect={handleDisconnect}
            onEnableDemoMode={enableDemoMode}
            onEnableServerUsb={enableServerUsb}
          />
          <DeviceSelector onConnectionChange={(connected, mode) => {
            if (connected) {
              setServerUsbMode(true);
              setDemoMode(false);
              setDataSource(null);
              connectWebSocketDemo();
            }
          }} />

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {serverUsbMode && dataSource === 'ecu' && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10">
              <Server className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400 font-sans tracking-wider">LIVE ECU</span>
            </div>
          )}
          {serverUsbMode && dataSource !== 'ecu' && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/10">
              <Server className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-yellow-400 font-sans animate-pulse tracking-wider">WAITING</span>
            </div>
          )}
          {demoMode && dataSource === 'ecu' && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10">
              <Usb className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400 font-sans tracking-wider">LIVE ECU</span>
            </div>
          )}
          {demoMode && dataSource !== 'ecu' && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/10">
              <span className="text-[10px] text-yellow-400 font-sans tracking-wider">DEMO</span>
              {hasSerial && (
                <Button size="icon" variant="ghost" onClick={handleUsbConnect} className="h-5 w-5 ml-1" data-testid="button-demo-usb-connect">
                  <Usb className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
          {usbConnected && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10">
              <Usb className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400 font-sans tracking-wider">USB</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Smartphone className={`w-3 h-3 ${orientation === 'portrait' ? 'rotate-0' : 'rotate-90'}`} />
            <span className="text-[10px] uppercase tracking-wider">{orientation}</span>
          </div>
          {/* MPH / KPH quick toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettings({ speedUnit: settings.speedUnit === 'mph' ? 'kmh' : 'mph' })}
            className="h-7 text-[11px] px-2 font-mono tracking-wider text-zinc-400 hover:text-zinc-100"
            data-testid="button-unit-toggle"
            title="Toggle MPH / KM/H"
          >
            <Gauge className="w-3 h-3 mr-1" />
            {settings.speedUnit === 'mph' ? 'MPH' : 'KM/H'}
          </Button>
          {isConnected && (
            <>
              <Button
                size="sm"
                variant={editMode ? 'default' : 'ghost'}
                onClick={() => setEditMode(!editMode)}
                className="gap-1 h-7 text-[11px] px-2"
                data-testid="button-edit-mode"
              >
                <Move className="w-3 h-3" />
                {editMode ? 'Done' : 'Edit'}
              </Button>
              {editMode && (
                <Button size="sm" variant="secondary" onClick={resetLayout} className="gap-1 h-7 text-[11px] px-2" data-testid="button-reset-layout">
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
              )}
            </>
          )}
          <Button size="icon" variant="ghost" onClick={toggleFullscreen} className="h-7 w-7" data-testid="button-fullscreen">
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </Button>
          <SettingsPanel
            settings={settings}
            onSettingsChange={setSettings}
            onResetLayout={resetLayout}
            editMode={editMode}
            onEditModeChange={setEditMode}
            odometer={tripData.odometer}
            onOdometerChange={setOdometer}
          />
        </div>
      </header>
      
      <main className="flex-1 relative p-4 pt-8 overflow-auto">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
            <div className="text-center">
              <Bluetooth className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-connection-title">Awaiting ECU Connection</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Connect to your Hondata KPro ECU to see live gauge data.
              </p>
            </div>

            <Button onClick={enableServerUsb} className="gap-2" data-testid="button-server-usb">
              <Server className="w-4 h-4" />
              Server USB (Pi Serial)
            </Button>
            <p className="text-xs text-muted-foreground max-w-xs text-center -mt-4">
              Receives ECU data from server-side USB serial. Works in any browser including surf and midori.
            </p>

            {(hasBluetooth || hasSerial) && (
              <>
                <div className="w-48 border-t border-border/30" />
                <div className="flex flex-wrap gap-3 justify-center">
                  {hasBluetooth && (
                    <Button onClick={handleScan} className="gap-2" variant="secondary" data-testid="button-connect-ecu">
                      <Bluetooth className="w-4 h-4" />
                      Bluetooth Scan
                    </Button>
                  )}
                  {hasSerial && (
                    <Button onClick={handleUsbConnect} className="gap-2" variant="secondary" data-testid="button-connect-usb">
                      <Usb className="w-4 h-4" />
                      Browser USB
                    </Button>
                  )}
                </div>
                {hasBluetooth && hasSerial && (
                  <p className="text-xs text-muted-foreground max-w-xs text-center -mt-4">
                    Browser-based connections require Chrome or Chromium.
                  </p>
                )}
              </>
            )}

            <div className="w-48 border-t border-border/30" />
            <Button variant="outline" onClick={enableDemoMode} data-testid="button-demo-mode">
              Demo Mode
            </Button>

            <div className="mt-4 pt-4 border-t border-border/30 flex flex-col items-center gap-3">
              <div className="flex flex-row flex-wrap gap-2 justify-center">
                {!isStandaloneApp() && <AndroidDownloadButtonInline />}
                <Button
                  variant="secondary"
                  className="gap-2"
                  asChild
                  data-testid="link-download-offline"
                >
                  <a href={getApiUrl('/api/download-offline') || '#'} download>
                    <Download className="w-4 h-4" />
                    Pi + Chromium Package
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  asChild
                  data-testid="link-download-native"
                >
                  <a href={getApiUrl('/api/download-native') || '#'} download>
                    <Download className="w-4 h-4" />
                    Pi Headless Package
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setMasterOpen(true)}
                  data-testid="button-download-master-cluster"
                >
                  <Lock className="w-4 h-4" />
                  Master Bundle (Self-Host Kit)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground max-w-md text-center">
                Chromium: Displays gauges on Pi screen. Headless: No browser needed, view from phone via WiFi hotspot. Master: password-locked self-host kit.
              </p>
            </div>
          </div>
        ) : orientation === 'portrait' ? (
          <div className="flex flex-col gap-4 w-full">
            <div className="w-full">
              <Tachometer
                rpm={displayTelemetry.rpm}
                maxRpm={settings.maxRpm}
                redlineRpm={settings.redlineRpm}
                shiftLightRpm={settings.shiftLightRpm}
                vtec={displayTelemetry.vtec}
                color={settings.gaugeColors.tachometer}
                multiColorZones={settings.themePreset === 'multicolor'}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/30 rounded-md p-3">
                <Speedometer
                  speed={displayTelemetry.speed}
                  unit={settings.speedUnit}
                  color={settings.gaugeColors.speedometer}
                />
              </div>
              <div className="bg-card/30 rounded-md p-3">
                <CoolantTempGauge
                  temp={displayTelemetry.coolantTemp}
                  warningTemp={settings.coolantWarningTemp}
                  unit={settings.tempUnit}
                  color={settings.gaugeColors.coolant}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/30 rounded-md p-3">
                <FuelGauge
                  level={displayTelemetry.fuelLevel}
                  lowWarning={settings.lowFuelWarning}
                  color={settings.gaugeColors.fuel}
                />
              </div>
              <div className="bg-card/30 rounded-md p-3">
                <AFRGauge
                  afr={displayTelemetry.afr}
                  targetLow={settings.afrTargetLow}
                  targetHigh={settings.afrTargetHigh}
                  color={settings.gaugeColors.afr}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/30 rounded-md p-3">
                <MAPGauge
                  map={displayTelemetry.map}
                  warningHigh={settings.mapWarningHigh}
                  unit={settings.mapUnit}
                  color={settings.gaugeColors.map}
                />
              </div>
              <div className="bg-card/30 rounded-md p-3">
                <TripMeter
                  odometer={tripData.odometer}
                  tripA={tripData.tripA}
                  tripB={tripData.tripB}
                  unit={settings.speedUnit}
                  onResetTripA={resetTripA}
                  onResetTripB={resetTripB}
                  color={settings.gaugeColors.trip}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full min-h-[420px]">
            <DraggableGauge
              id="coolantTemp"
              position={getGaugePosition('coolantTemp')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <CoolantTempGauge
                temp={displayTelemetry.coolantTemp}
                warningTemp={settings.coolantWarningTemp}
                unit={settings.tempUnit}
                color={settings.gaugeColors.coolant}
              />
            </DraggableGauge>
            
            <DraggableGauge
              id="tachometer"
              position={getGaugePosition('tachometer')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <Tachometer
                rpm={displayTelemetry.rpm}
                maxRpm={settings.maxRpm}
                redlineRpm={settings.redlineRpm}
                shiftLightRpm={settings.shiftLightRpm}
                vtec={displayTelemetry.vtec}
                color={settings.gaugeColors.tachometer}
                multiColorZones={settings.themePreset === 'multicolor'}
              />
            </DraggableGauge>
            
            <DraggableGauge
              id="speedometer"
              position={getGaugePosition('speedometer')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <Speedometer
                speed={displayTelemetry.speed}
                unit={settings.speedUnit}
                color={settings.gaugeColors.speedometer}
              />
            </DraggableGauge>
            
            <DraggableGauge
              id="fuelLevel"
              position={getGaugePosition('fuelLevel')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <FuelGauge
                level={displayTelemetry.fuelLevel}
                lowWarning={settings.lowFuelWarning}
                color={settings.gaugeColors.fuel}
              />
            </DraggableGauge>
            
            <DraggableGauge
              id="afr"
              position={getGaugePosition('afr')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <AFRGauge
                afr={displayTelemetry.afr}
                targetLow={settings.afrTargetLow}
                targetHigh={settings.afrTargetHigh}
                color={settings.gaugeColors.afr}
              />
            </DraggableGauge>
            
            <DraggableGauge
              id="map"
              position={getGaugePosition('map')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <MAPGauge
                map={displayTelemetry.map}
                warningHigh={settings.mapWarningHigh}
                unit={settings.mapUnit}
                color={settings.gaugeColors.map}
              />
            </DraggableGauge>
            
            <DraggableGauge
              id="tripMeter"
              position={getGaugePosition('tripMeter')}
              editMode={editMode}
              onPositionChange={updateGaugePosition}
            >
              <TripMeter
                odometer={tripData.odometer}
                tripA={tripData.tripA}
                tripB={tripData.tripB}
                unit={settings.speedUnit}
                onResetTripA={resetTripA}
                onResetTripB={resetTripB}
                color={settings.gaugeColors.trip}
              />
            </DraggableGauge>
          </div>
        )}
      </main>
      
      <footer className="flex items-center justify-between px-6 py-3 border-t border-border/30">
        <div className="flex items-center gap-6">
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">ABS</span>
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">-</span>
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">+</span>
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">PUSH CANCEL</span>
        </div>
        
        <div className="text-center">
          {editMode && (
            <span className="text-xs text-gauge-yellow font-sans tracking-wide animate-pulse">
              DRAG GAUGES TO REPOSITION
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-6">
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">SRS</span>
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">SEL</span>
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">TRIP</span>
          <span className="text-[10px] text-foreground/50 font-sans tracking-wider">
            {settings.speedUnit === 'mph' ? 'mph·km/h' : 'km/h·mph'}
          </span>
        </div>
      </footer>
      <MasterDownloadDialog open={masterOpen} onOpenChange={setMasterOpen} />
    </div>
  );
}
