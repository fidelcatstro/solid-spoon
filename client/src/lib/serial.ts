import type { TelemetryData } from '@shared/schema';

export type SerialConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface SerialServiceState {
  connectionState: SerialConnectionState;
  portName: string | null;
  error: string | null;
  lastDataReceived: number | null;
}

type StateListener = (state: SerialServiceState) => void;
type TelemetryListener = (data: TelemetryData) => void;

class SerialService {
  private state: SerialServiceState = {
    connectionState: 'idle',
    portName: null,
    error: null,
    lastDataReceived: null,
  };

  private stateListeners: Set<StateListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private keepReading = false;
  private responseBuffer: string = '';
  private pollingInterval: number | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private currentTelemetry: TelemetryData = {
    rpm: 0,
    speed: 0,
    coolantTemp: 0,
    fuelLevel: 0,
    afr: 14.7,
    map: 0,
    throttlePosition: 0,
    checkEngine: false,
    vtec: false,
  };

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  getState(): SerialServiceState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  private updateState(partial: Partial<SerialServiceState>) {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  private emitTelemetry(data: TelemetryData) {
    this.telemetryListeners.forEach(listener => listener(data));
  }

  async connect(): Promise<void> {
    if (!this.isSupported()) {
      this.updateState({
        connectionState: 'error',
        error: 'Web Serial API not supported. Use Chrome or Chromium.',
      });
      return;
    }

    try {
      this.updateState({ connectionState: 'connecting', error: null });

      let port: SerialPort;
      try {
        port = await navigator.serial.requestPort({
          filters: [
            { usbVendorId: 0x0403 },
            { usbVendorId: 0x067B },
            { usbVendorId: 0x10C4 },
            { usbVendorId: 0x1A86 },
            { usbVendorId: 0x2341 },
            { usbVendorId: 0x0557 },
            { usbVendorId: 0x04D8 },
          ],
        });
      } catch (filterErr: any) {
        if (filterErr.name === 'NotFoundError') {
          port = await navigator.serial.requestPort();
        } else {
          throw filterErr;
        }
      }

      await port.open({
        baudRate: 38400,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      this.port = port;

      const info = port.getInfo();
      const portName = `USB Device (${info.usbVendorId ? '0x' + info.usbVendorId.toString(16) : 'unknown'})`;

      this.updateState({
        connectionState: 'connected',
        portName,
        lastDataReceived: Date.now(),
      });

      if (port.writable) {
        this.writer = port.writable.getWriter();
      }

      this.keepReading = true;
      this.readLoop();
      await this.initializeELM327();
      this.startPolling();

    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.name === 'AbortError') {
        this.updateState({ connectionState: 'idle', error: null });
        return;
      }
      let errorMessage = 'Failed to connect to USB device';
      if (error.message) {
        errorMessage = error.message;
      }
      this.updateState({ connectionState: 'error', error: errorMessage });
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;

    while (this.keepReading && this.port.readable) {
      try {
        this.reader = this.port.readable.getReader();
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            const decoder = new TextDecoder();
            const text = decoder.decode(value);
            this.responseBuffer += text;
            if (this.responseBuffer.includes('>') || this.responseBuffer.includes('\r\r')) {
              this.parseELMResponse(this.responseBuffer);
              this.responseBuffer = '';
            }
          }
        }
      } catch (e) {
        if (this.keepReading) {
          console.error('Serial read error:', e);
        }
      } finally {
        if (this.reader) {
          try { this.reader.releaseLock(); } catch {}
          this.reader = null;
        }
      }
    }
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.writer) return;
    const encoder = new TextEncoder();
    try {
      await this.writer.write(encoder.encode(command + '\r'));
    } catch (e) {
      console.error('Serial write error:', e);
    }
  }

  private async initializeELM327(): Promise<void> {
    const initCommands = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
    for (const cmd of initCommands) {
      await this.sendCommand(cmd);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    const allPIDs = ['010C', '010D', '0105', '010B', '0111', '012F'];
    let cmdIndex = 0;

    this.pollingInterval = window.setInterval(async () => {
      if (this.state.connectionState !== 'connected') {
        this.stopPolling();
        return;
      }
      try {
        await this.sendCommand(allPIDs[cmdIndex]);
        cmdIndex = (cmdIndex + 1) % allPIDs.length;
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 50);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private parseELMResponse(response: string): void {
    const lines = response.split('\r').filter(l => l.trim());
    for (const line of lines) {
      const clean = line.replace(/\s/g, '').toUpperCase();
      if (clean.startsWith('41')) {
        const pid = clean.substring(2, 4);
        const dataBytes = clean.substring(4);

        switch (pid) {
          case '0C': {
            if (dataBytes.length >= 4) {
              const a = parseInt(dataBytes.substring(0, 2), 16);
              const b = parseInt(dataBytes.substring(2, 4), 16);
              this.currentTelemetry.rpm = Math.round(((a * 256) + b) / 4);
            }
            break;
          }
          case '0D':
            if (dataBytes.length >= 2)
              this.currentTelemetry.speed = parseInt(dataBytes.substring(0, 2), 16);
            break;
          case '05':
            if (dataBytes.length >= 2)
              this.currentTelemetry.coolantTemp = parseInt(dataBytes.substring(0, 2), 16) - 40;
            break;
          case '0B':
            if (dataBytes.length >= 2)
              this.currentTelemetry.map = parseInt(dataBytes.substring(0, 2), 16);
            break;
          case '11':
            if (dataBytes.length >= 2)
              this.currentTelemetry.throttlePosition = Math.round(parseInt(dataBytes.substring(0, 2), 16) * 100 / 255);
            break;
          case '2F':
            if (dataBytes.length >= 2)
              this.currentTelemetry.fuelLevel = Math.round(parseInt(dataBytes.substring(0, 2), 16) * 100 / 255);
            break;
        }

        this.updateState({ lastDataReceived: Date.now() });
        this.emitTelemetry(this.currentTelemetry);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.keepReading = false;
    this.stopPolling();

    if (this.writer) {
      try { this.writer.releaseLock(); } catch {}
      this.writer = null;
    }
    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
      try { this.reader.releaseLock(); } catch {}
      this.reader = null;
    }
    if (this.port) {
      try { await this.port.close(); } catch {}
      this.port = null;
    }

    this.updateState({
      connectionState: 'idle',
      portName: null,
      error: null,
      lastDataReceived: null,
    });
    this.responseBuffer = '';
  }
}

export const serialService = new SerialService();
