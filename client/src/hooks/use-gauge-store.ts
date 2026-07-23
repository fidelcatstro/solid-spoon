import { useState, useCallback, useEffect, useRef } from 'react';
import type { 
  TelemetryData, 
  GaugeSettings, 
  TripData, 
  BluetoothStatus,
  LayoutConfig,
  GaugePosition
} from '@shared/schema';
import { 
  defaultTelemetry, 
  defaultSettings, 
  defaultTripData,
  defaultLayout
} from '@shared/schema';
import { bluetoothService } from '@/lib/bluetooth';
import { nativeBleService } from '@/lib/native-ble';
import { getWebSocketUrl, subscribeServerHost } from '@/lib/runtime';

const STORAGE_KEYS = {
  settings: 'kpro-gauge-settings',
  tripData: 'kpro-trip-data',
  layout: 'kpro-gauge-layout',
};

type SyncListener = (msg: { type: string; payload: unknown }) => void;
const syncListeners = new Set<SyncListener>();
let syncWs: WebSocket | null = null;
let syncWsReady = false;

function getSyncWs(): WebSocket | null {
  return syncWs;
}

function initSyncChannel() {
  if (syncWs && syncWs.readyState <= WebSocket.OPEN) return;
  const wsUrl = getWebSocketUrl('/ws');
  if (!wsUrl) {
    // Standalone app with no server configured — settings persist locally only.
    return;
  }
  try {
    const ws = new WebSocket(wsUrl);
    syncWs = ws;
    ws.onopen = () => { syncWsReady = true; };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_sync' || data.type === 'layout_sync') {
          syncListeners.forEach(fn => fn(data));
        }
      } catch (_e) {}
    };
    ws.onclose = () => {
      syncWsReady = false;
      syncWs = null;
      // Only auto-reconnect if a server is still configured.
      if (getWebSocketUrl('/ws')) setTimeout(() => initSyncChannel(), 3000);
    };
    ws.onerror = () => { ws.close(); };
  } catch (_e) {}
}

// Re-bind the settings sync channel whenever the user changes the server host.
let syncHostListenerInstalled = false;
function ensureSyncHostListener() {
  if (syncHostListenerInstalled) return;
  syncHostListenerInstalled = true;
  subscribeServerHost(() => {
    if (syncWs) {
      try { syncWs.close(); } catch { /* ignore */ }
      syncWs = null;
      syncWsReady = false;
    }
    initSyncChannel();
  });
}

function broadcastSync(type: string, payload: unknown) {
  const ws = getSyncWs();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
  }
}

export function useGaugeStore() {
  const [telemetry, setTelemetryState] = useState<TelemetryData>(defaultTelemetry);
  const [settings, setSettingsState] = useState<GaugeSettings>(() => {
    const stored = loadFromStorage(STORAGE_KEYS.settings, defaultSettings);
    return { ...defaultSettings, ...stored };
  });
  const [tripData, setTripDataState] = useState<TripData>(() => 
    loadFromStorage(STORAGE_KEYS.tripData, defaultTripData)
  );
  const [layout, setLayoutState] = useState<LayoutConfig>(() => 
    loadFromStorage(STORAGE_KEYS.layout, defaultLayout)
  );
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>({
    connectionState: 'idle',
    connected: false,
    isSupported: bluetoothService.isSupported() || nativeBleService.isAvailable(),
  });
  const [editMode, setEditMode] = useState(false);
  
  const speedRef = useRef(0);
  const wasMovingRef = useRef(false);
  const tripAccumulatorRef = useRef(0);
  const lastTickRef = useRef(Date.now());

  const setTelemetry = useCallback((data: TelemetryData) => {
    setTelemetryState(data);
    speedRef.current = data.speed;
  }, []);

  const setSettings = useCallback((newSettings: Partial<GaugeSettings>, fromSync = false) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      saveToStorage(STORAGE_KEYS.settings, updated);
      if (!fromSync) {
        broadcastSync('settings_sync', updated);
      }
      return updated;
    });
  }, []);

  const setTripData = useCallback((newTripData: Partial<TripData>) => {
    setTripDataState(prev => {
      const updated = { ...prev, ...newTripData };
      saveToStorage(STORAGE_KEYS.tripData, updated);
      return updated;
    });
  }, []);

  const resetTripA = useCallback(() => {
    setTripData({ tripA: 0 });
  }, [setTripData]);

  const resetTripB = useCallback(() => {
    setTripData({ tripB: 0 });
  }, [setTripData]);

  const setOdometer = useCallback((value: number) => {
    setTripData({ odometer: value });
  }, [setTripData]);

  const updateGaugePosition = useCallback((gaugeId: string, position: Partial<GaugePosition>, fromSync = false) => {
    setLayoutState(prev => {
      const updated = {
        ...prev,
        gauges: prev.gauges.map(g => 
          g.id === gaugeId ? { ...g, ...position } : g
        ),
      };
      saveToStorage(STORAGE_KEYS.layout, updated);
      if (!fromSync) {
        broadcastSync('layout_sync', updated);
      }
      return updated;
    });
  }, []);

  const setLayout = useCallback((newLayout: LayoutConfig, fromSync = false) => {
    setLayoutState(newLayout);
    saveToStorage(STORAGE_KEYS.layout, newLayout);
    if (!fromSync) {
      broadcastSync('layout_sync', newLayout);
    }
  }, []);

  const resetLayout = useCallback(() => {
    const reset = { ...defaultLayout };
    setLayout(reset);
  }, [setLayout]);

  useEffect(() => {
    initSyncChannel();
    ensureSyncHostListener();
    const listener: SyncListener = (msg) => {
      if (msg.type === 'settings_sync' && msg.payload) {
        setSettingsState(msg.payload as GaugeSettings);
        saveToStorage(STORAGE_KEYS.settings, msg.payload);
      }
      if (msg.type === 'layout_sync' && msg.payload) {
        setLayoutState(msg.payload as LayoutConfig);
        saveToStorage(STORAGE_KEYS.layout, msg.payload);
      }
    };
    syncListeners.add(listener);
    return () => { syncListeners.delete(listener); };
  }, []);

  useEffect(() => {
    const TICK_MS = 500;
    const MIN_SPEED = 2;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const speed = speedRef.current;
      const elapsed = (now - lastTickRef.current) / 1000 / 3600;
      
      lastTickRef.current = now;
      
      if (speed < MIN_SPEED) {
        wasMovingRef.current = false;
        tripAccumulatorRef.current = 0;
        return;
      }
      
      if (!wasMovingRef.current) {
        wasMovingRef.current = true;
        tripAccumulatorRef.current = 0;
        return;
      }
      
      const distance = speed * elapsed;
      tripAccumulatorRef.current += distance;
      
      if (tripAccumulatorRef.current >= 0.001) {
        const toAdd = tripAccumulatorRef.current;
        tripAccumulatorRef.current = 0;
        
        setTripDataState(prev => {
          const updated = {
            odometer: prev.odometer + toAdd,
            tripA: prev.tripA + toAdd,
            tripB: prev.tripB + toAdd,
            lastSpeed: speed,
            lastUpdateTime: now,
          };
          saveToStorage(STORAGE_KEYS.tripData, updated);
          return updated;
        });
      }
    }, TICK_MS);
    
    return () => clearInterval(interval);
  }, []);

  return {
    telemetry,
    setTelemetry,
    settings,
    setSettings,
    tripData,
    setTripData,
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
  };
}

export type GaugeStore = ReturnType<typeof useGaugeStore>;
