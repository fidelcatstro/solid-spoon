// Native USB-OTG transport for the standalone Android APK.
//
// Listens for USB attach events on Android and tries to auto-connect to
// the first KPro V4 (vendor 0x1C40) or ELM327 USB-serial adapter that
// shows up. Falls back to "not available" on the web. The actual native
// plugin is loaded dynamically so the web build is unaffected.
//
// Expects a Capacitor plugin named "UsbSerial" exposing:
//   listDevices(): Promise<{ devices: Array<{ deviceId, vendorId, productId, manufacturerName, productName }> }>
//   requestPermission({ deviceId }): Promise<{ granted: boolean }>
//   open({ deviceId, baudRate, dataBits, stopBits, parity }): Promise<{ connectionId }>
//   write({ connectionId, data /* base64 */ }): Promise<void>
//   close({ connectionId }): Promise<void>
//   addListener('usbAttached' | 'usbDetached' | 'data', cb)
//
// Any community USB-serial plugin can be wired in; we register it via
// `registerPlugin` so the user only needs to install it on the Android
// build to enable USB-OTG support.

import type { TelemetryData } from '@shared/schema';
import { isStandaloneApp, getNativePlatform } from './runtime';

export type NativeUsbState = 'idle' | 'attached' | 'connecting' | 'connected' | 'error';

export interface NativeUsbStatus {
  state: NativeUsbState;
  deviceName: string | null;
  vendorId: number | null;
  productId: number | null;
  protocol: 'kpro' | 'elm327' | null;
  error: string | null;
  lastDataReceived: number | null;
}

type StateListener = (s: NativeUsbStatus) => void;
type TelemetryListener = (t: TelemetryData) => void;

// KPro V4 = 1C40:0434, KPro V2/V3 = 0403:F5F8.
const KPRO_V4_VENDOR = 0x1C40;
const FTDI_VENDOR = 0x0403;
// Common ELM327 USB-UART chips.
const ELM_USB_VENDORS = new Set<number>([0x1A86, 0x10C4, 0x067B, 0x0403, 0x2341, 0x0557, 0x04D8]);

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(s);
  return Buffer.from(bytes).toString('base64');
}

function b64decode(b64: string): Uint8Array {
  const s = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

class NativeUsbService {
  private status: NativeUsbStatus = {
    state: 'idle', deviceName: null, vendorId: null, productId: null,
    protocol: null, error: null, lastDataReceived: null,
  };
  private stateListeners = new Set<StateListener>();
  private telemetryListeners = new Set<TelemetryListener>();
  private currentTelemetry: TelemetryData = {
    rpm: 0, speed: 0, coolantTemp: 0, fuelLevel: 0, afr: 14.7,
    map: 0, throttlePosition: 0, checkEngine: false, vtec: false,
  };
  private UsbPlugin: any = null;
  private connectionId: string | number | null = null;
  private responseBuffer = '';
  private pollHandle: number | null = null;
  private autoConnectInstalled = false;

  isAvailable(): boolean {
    return isStandaloneApp() && getNativePlatform() === 'android';
  }

  getStatus(): NativeUsbStatus {
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

  private emit(partial: Partial<NativeUsbStatus>) {
    this.status = { ...this.status, ...partial };
    this.stateListeners.forEach(fn => fn(this.status));
  }

  private emitTelemetry(t: TelemetryData) {
    this.telemetryListeners.forEach(fn => fn(t));
  }

  private async loadPlugin(): Promise<any> {
    if (this.UsbPlugin) return this.UsbPlugin;
    try {
      // Indirection so Vite doesn't try to resolve this literal at build time.
      const spec = '@capacitor/core';
      const core: any = await import(/* @vite-ignore */ spec);
      // The user installs whichever community USB-serial plugin they prefer
      // and exposes it under the name 'UsbSerial'. Any plugin matching the
      // shape documented at the top of this file works.
      this.UsbPlugin = core.registerPlugin('UsbSerial');
      return this.UsbPlugin;
    } catch (e: any) {
      throw new Error('USB-OTG plugin unavailable. Install a Capacitor USB-serial plugin and expose it as "UsbSerial".');
    }
  }

  /** Install the global USB attach listener so we auto-connect when the cable is plugged in. */
  async installAutoConnect(): Promise<void> {
    if (this.autoConnectInstalled) return;
    if (!this.isAvailable()) return;
    try {
      const plugin = await this.loadPlugin();
      this.autoConnectInstalled = true;
      try {
        plugin.addListener?.('usbAttached', () => {
          this.tryAutoConnect().catch(() => { /* ignore */ });
        });
        plugin.addListener?.('usbDetached', () => {
          this.handleDisconnect();
        });
        plugin.addListener?.('data', (evt: any) => {
          if (evt?.data) this.handleIncoming(b64decode(evt.data));
        });
      } catch { /* listener API may be unavailable on the user's plugin */ }

      // Also attempt an initial connect in case a device is already plugged in.
      this.tryAutoConnect().catch(() => { /* ignore */ });
    } catch (e: any) {
      // Plugin not installed — that's fine, the rest of the app keeps working.
      this.emit({ state: 'idle', error: null });
    }
  }

  private classifyDevice(d: { vendorId: number; productId: number }): 'kpro' | 'elm327' | null {
    if (d.vendorId === KPRO_V4_VENDOR) return 'kpro';
    if (d.vendorId === FTDI_VENDOR) return 'kpro'; // KPro V2/V3 also FTDI; treat as KPro
    if (ELM_USB_VENDORS.has(d.vendorId)) return 'elm327';
    return null;
  }

  async tryAutoConnect(): Promise<void> {
    if (this.connectionId != null) return;
    if (!this.isAvailable()) return;
    let plugin: any;
    try { plugin = await this.loadPlugin(); } catch { return; }

    let devices: any[] = [];
    try {
      const res = await plugin.listDevices?.();
      devices = res?.devices || [];
    } catch {
      return;
    }

    // Prefer KPro over ELM327 if both are plugged in.
    const sorted = [...devices].sort((a, b) => {
      const ra = a.vendorId === KPRO_V4_VENDOR ? 0 : a.vendorId === FTDI_VENDOR ? 1 : 2;
      const rb = b.vendorId === KPRO_V4_VENDOR ? 0 : b.vendorId === FTDI_VENDOR ? 1 : 2;
      return ra - rb;
    });

    for (const d of sorted) {
      const proto = this.classifyDevice(d);
      if (!proto) continue;
      try {
        await this.connect(d, proto, plugin);
        return;
      } catch (e: any) {
        this.emit({ state: 'error', error: e?.message || 'USB connect failed' });
      }
    }
  }

  private async connect(device: any, proto: 'kpro' | 'elm327', plugin: any): Promise<void> {
    this.emit({
      state: 'connecting',
      deviceName: device.productName || device.manufacturerName || 'USB Device',
      vendorId: device.vendorId,
      productId: device.productId,
      protocol: proto,
      error: null,
    });

    try {
      const perm = await plugin.requestPermission?.({ deviceId: device.deviceId });
      if (perm && perm.granted === false) throw new Error('USB permission denied');
    } catch { /* some plugins don't expose permission step */ }

    const opened = await plugin.open({
      deviceId: device.deviceId,
      baudRate: 38400,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });
    this.connectionId = opened?.connectionId ?? device.deviceId;

    this.emit({ state: 'connected', lastDataReceived: Date.now() });

    if (proto === 'elm327') {
      await this.initElm();
      this.startElmPolling();
    }
    // For KPro the server-side path handles the proprietary protocol; the
    // ELM327 fallback is what the on-device transport supports today.
  }

  private async write(bytes: Uint8Array): Promise<void> {
    if (this.connectionId == null || !this.UsbPlugin) return;
    try {
      await this.UsbPlugin.write({ connectionId: this.connectionId, data: b64encode(bytes) });
    } catch { /* ignore */ }
  }

  private async writeText(text: string): Promise<void> {
    return this.write(new TextEncoder().encode(text + '\r'));
  }

  private async initElm(): Promise<void> {
    const cmds = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
    for (const c of cmds) {
      await this.writeText(c);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  private startElmPolling(): void {
    if (this.pollHandle != null) return;
    const pids = ['010C', '010D', '0105', '010B', '0111', '012F'];
    let i = 0;
    this.pollHandle = window.setInterval(() => {
      if (this.status.state !== 'connected') { this.stopPolling(); return; }
      this.writeText(pids[i]).catch(() => { /* ignore */ });
      i = (i + 1) % pids.length;
    }, 50);
  }

  private stopPolling(): void {
    if (this.pollHandle != null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private handleIncoming(bytes: Uint8Array): void {
    if (this.status.protocol === 'kpro') {
      this.parseKProBinary(bytes);
    } else {
      const text = new TextDecoder().decode(bytes);
      this.responseBuffer += text;
      if (this.responseBuffer.includes('>') || this.responseBuffer.includes('\r')) {
        this.parseElmResponse(this.responseBuffer);
        this.responseBuffer = '';
      }
    }
  }

  private parseElmResponse(resp: string): void {
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

  // Mirrors the byte-offset KPro V4 parsing in client/src/lib/bluetooth.ts.
  private parseKProBinary(bytes: Uint8Array): void {
    if (bytes.byteLength < 10) return;
    try {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const rpm = dv.getUint16(0, true);
      const speed = dv.getUint8(2);
      const coolantTemp = dv.getInt8(3);
      const throttlePosition = dv.getUint8(4);
      const map = dv.getUint16(5, true);
      const afr = dv.getUint8(7) / 10;
      const fuelLevel = dv.getUint8(8);
      const flags = dv.byteLength > 9 ? dv.getUint8(9) : 0;
      this.currentTelemetry = {
        ...this.currentTelemetry,
        rpm: Math.min(rpm, 12000),
        speed: Math.min(speed, 300),
        coolantTemp: Math.max(-40, Math.min(coolantTemp, 150)),
        fuelLevel: Math.min(fuelLevel, 100),
        afr: Math.max(8, Math.min(afr, 20)),
        map: Math.min(map, 300),
        throttlePosition: Math.min(throttlePosition, 100),
        checkEngine: (flags & 0x01) !== 0,
        vtec: (flags & 0x02) !== 0,
      };
      this.emit({ lastDataReceived: Date.now() });
      this.emitTelemetry(this.currentTelemetry);
    } catch { /* ignore */ }
  }

  private handleDisconnect(): void {
    this.stopPolling();
    this.connectionId = null;
    this.responseBuffer = '';
    this.emit({
      state: 'idle',
      deviceName: null,
      vendorId: null,
      productId: null,
      protocol: null,
      lastDataReceived: null,
    });
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.UsbPlugin && this.connectionId != null) {
      try { await this.UsbPlugin.close({ connectionId: this.connectionId }); } catch { /* ignore */ }
    }
    this.handleDisconnect();
  }
}

export const nativeUsbService = new NativeUsbService();
