// Native Bluetooth (Capacitor) transport.
//
// Used when the app runs as the standalone Android APK. Uses the
// `@capacitor-community/bluetooth-le` plugin via dynamic import so the
// regular web build does not break when the plugin is absent.

import type { TelemetryData } from '@shared/schema';
import { isStandaloneApp, getNativePlatform } from './runtime';

export type NativeBleState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface NativeBleStatus {
  state: NativeBleState;
  deviceName: string | null;
  deviceId: string | null;
  error: string | null;
  lastDataReceived: number | null;
}

type StateListener = (s: NativeBleStatus) => void;
type TelemetryListener = (t: TelemetryData) => void;

const ELM327_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
const ELM327_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

class NativeBleService {
  private status: NativeBleStatus = {
    state: 'idle',
    deviceName: null,
    deviceId: null,
    error: null,
    lastDataReceived: null,
  };

  private stateListeners = new Set<StateListener>();
  private telemetryListeners = new Set<TelemetryListener>();
  private currentTelemetry: TelemetryData = {
    rpm: 0, speed: 0, coolantTemp: 0, fuelLevel: 0, afr: 14.7,
    map: 0, throttlePosition: 0, checkEngine: false, vtec: false,
  };

  private BleClient: any = null;
  private deviceId: string | null = null;
  private pollHandle: number | null = null;
  private responseBuffer = '';

  isAvailable(): boolean {
    return isStandaloneApp() && getNativePlatform() === 'android';
  }

  getStatus(): NativeBleStatus {
    return { ...this.status };
  }

  subscribe(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  subscribeTelemetry(fn: TelemetryListener): () => void {
    this.telemetryListeners.add(fn);
    return () => this.telemetryListeners.delete(fn);
  }

  private emit(partial: Partial<NativeBleStatus>) {
    this.status = { ...this.status, ...partial };
    this.stateListeners.forEach(fn => fn(this.status));
  }

  private emitTelemetry(t: TelemetryData) {
    this.telemetryListeners.forEach(fn => fn(t));
  }

  private async loadPlugin(): Promise<any> {
    if (this.BleClient) return this.BleClient;
    try {
      // Indirection so Vite doesn't try to resolve this literal at build time.
      const spec = '@capacitor-community/bluetooth-le';
      const mod: any = await import(/* @vite-ignore */ spec);
      this.BleClient = mod.BleClient;
      return this.BleClient;
    } catch (e: any) {
      throw new Error('Bluetooth plugin not installed. Run: npm install @capacitor-community/bluetooth-le');
    }
  }

  async scanAndConnect(): Promise<void> {
    if (!this.isAvailable()) {
      this.emit({ state: 'error', error: 'Native Bluetooth only available in the Android app' });
      return;
    }
    try {
      const Ble = await this.loadPlugin();
      this.emit({ state: 'scanning', error: null });
      await Ble.initialize({ androidNeverForLocation: false });

      const device = await Ble.requestDevice({
        services: [ELM327_SERVICE],
        optionalServices: [ELM327_SERVICE],
      });

      this.emit({ state: 'connecting', deviceName: device.name || 'BLE Device', deviceId: device.deviceId });
      this.deviceId = device.deviceId;
      await Ble.connect(device.deviceId, () => this.handleDisconnect());

      await Ble.startNotifications(device.deviceId, ELM327_SERVICE, ELM327_CHAR, (value: DataView) => {
        this.handleData(value);
      });

      this.emit({ state: 'connected', lastDataReceived: Date.now() });
      await this.initElm();
      this.startPolling();
    } catch (e: any) {
      this.emit({ state: 'error', error: e?.message || 'BLE connect failed' });
    }
  }

  private async initElm(): Promise<void> {
    const cmds = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
    for (const c of cmds) {
      await this.write(c);
      await new Promise(r => setTimeout(r, 150));
    }
  }

  private async write(cmd: string): Promise<void> {
    if (!this.BleClient || !this.deviceId) return;
    const enc = new TextEncoder();
    const bytes = enc.encode(cmd + '\r');
    const dv = new DataView(bytes.buffer);
    try {
      await this.BleClient.writeWithoutResponse(this.deviceId, ELM327_SERVICE, ELM327_CHAR, dv);
    } catch {
      try { await this.BleClient.write(this.deviceId, ELM327_SERVICE, ELM327_CHAR, dv); } catch { /* ignore */ }
    }
  }

  private startPolling(): void {
    if (this.pollHandle != null) return;
    const pids = ['010C', '010D', '0105', '010B', '0111', '012F'];
    let i = 0;
    this.pollHandle = window.setInterval(() => {
      if (this.status.state !== 'connected') { this.stopPolling(); return; }
      this.write(pids[i]).catch(() => { /* ignore */ });
      i = (i + 1) % pids.length;
    }, 50);
  }

  private stopPolling(): void {
    if (this.pollHandle != null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private handleData(value: DataView): void {
    try {
      const dec = new TextDecoder();
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const text = dec.decode(bytes);
      this.responseBuffer += text;
      if (this.responseBuffer.includes('>') || this.responseBuffer.includes('\r')) {
        this.parseResponse(this.responseBuffer);
        this.responseBuffer = '';
      }
    } catch { /* ignore */ }
  }

  private parseResponse(resp: string): void {
    const lines = resp.split('\r').filter(l => l.trim());
    for (const line of lines) {
      const clean = line.replace(/\s/g, '').toUpperCase();
      if (!clean.startsWith('41')) continue;
      const pid = clean.substring(2, 4);
      const data = clean.substring(4);
      switch (pid) {
        case '0C':
          if (data.length >= 4) {
            const a = parseInt(data.substring(0, 2), 16);
            const b = parseInt(data.substring(2, 4), 16);
            this.currentTelemetry.rpm = Math.round(((a * 256) + b) / 4);
          }
          break;
        case '0D':
          if (data.length >= 2) this.currentTelemetry.speed = parseInt(data.substring(0, 2), 16);
          break;
        case '05':
          if (data.length >= 2) this.currentTelemetry.coolantTemp = parseInt(data.substring(0, 2), 16) - 40;
          break;
        case '0B':
          if (data.length >= 2) this.currentTelemetry.map = parseInt(data.substring(0, 2), 16);
          break;
        case '11':
          if (data.length >= 2) this.currentTelemetry.throttlePosition = Math.round(parseInt(data.substring(0, 2), 16) * 100 / 255);
          break;
        case '2F':
          if (data.length >= 2) this.currentTelemetry.fuelLevel = Math.round(parseInt(data.substring(0, 2), 16) * 100 / 255);
          break;
      }
      this.emit({ lastDataReceived: Date.now() });
      this.emitTelemetry(this.currentTelemetry);
    }
  }

  private handleDisconnect(): void {
    this.stopPolling();
    this.emit({ state: 'idle', lastDataReceived: null });
    this.deviceId = null;
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.BleClient && this.deviceId) {
      try { await this.BleClient.disconnect(this.deviceId); } catch { /* ignore */ }
    }
    this.handleDisconnect();
  }
}

export const nativeBleService = new NativeBleService();
