/// <reference types="web-bluetooth" />

import type { TelemetryData } from '@shared/schema';

export type BluetoothConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface DiscoveredDevice {
  id: string;
  name: string;
  device: BluetoothDevice | null;
}

export interface DiscoveredService {
  uuid: string;
  characteristics: { uuid: string; canWrite: boolean; canNotify: boolean }[];
}

export interface BluetoothServiceState {
  connectionState: BluetoothConnectionState;
  discoveredDevices: DiscoveredDevice[];
  connectedDevice: DiscoveredDevice | null;
  error: string | null;
  lastDataReceived: number | null;
  discoveredServices: DiscoveredService[];
}

const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_RX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const KPRO_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const KPRO_WRITE_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const KPRO_NOTIFY_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

const KPRO_V4_SERVICE_UUID = '14839ac4-7d7e-415c-9a42-167340cf2339';

const ELM327_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const ELM327_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

const SPP_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb';

const COMMON_BLE_SERVICES = [
  NORDIC_UART_SERVICE_UUID,
  KPRO_SERVICE_UUID,
  KPRO_V4_SERVICE_UUID,
  ELM327_SERVICE_UUID,
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000fef5-0000-1000-8000-00805f9b34fb',
];

type StateListener = (state: BluetoothServiceState) => void;
type TelemetryListener = (data: TelemetryData) => void;

class BluetoothService {
  private state: BluetoothServiceState = {
    connectionState: 'idle',
    discoveredDevices: [],
    connectedDevice: null,
    error: null,
    lastDataReceived: null,
    discoveredServices: [],
  };
  
  private stateListeners: Set<StateListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private pollingInterval: number | null = null;
  private responseBuffer: string = '';
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
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isSecureContext(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext;
  }

  getRequirements(): { supported: boolean; secure: boolean; message: string } {
    const supported = this.isSupported();
    const secure = this.isSecureContext();
    
    if (!secure) {
      return {
        supported,
        secure,
        message: 'Bluetooth requires HTTPS. Please access this app via a secure connection.',
      };
    }
    
    if (!supported) {
      return {
        supported,
        secure,
        message: 'Web Bluetooth is not supported in this browser. Please use Chrome or Edge.',
      };
    }
    
    return {
      supported: true,
      secure: true,
      message: 'Ready to connect',
    };
  }

  getState(): BluetoothServiceState {
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

  private updateState(partial: Partial<BluetoothServiceState>) {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  private emitTelemetry(data: TelemetryData) {
    this.telemetryListeners.forEach(listener => listener(data));
  }

  async scanAndConnect(): Promise<void> {
    const requirements = this.getRequirements();
    
    if (!requirements.secure) {
      this.updateState({
        connectionState: 'error',
        error: 'Bluetooth requires HTTPS. Please access via secure connection.',
      });
      return;
    }
    
    if (!requirements.supported) {
      this.updateState({
        connectionState: 'error',
        error: 'Bluetooth is not supported in this browser. Please use Chrome or Edge.',
      });
      return;
    }

    try {
      this.updateState({
        connectionState: 'scanning',
        error: null,
        discoveredDevices: [],
        discoveredServices: [],
      });

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          ...COMMON_BLE_SERVICES,
          'battery_service',
          'device_information',
        ],
      });

      if (!device) {
        this.updateState({
          connectionState: 'idle',
          error: 'No device selected',
        });
        return;
      }

      const discoveredDevice: DiscoveredDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        device,
      };

      this.updateState({
        discoveredDevices: [discoveredDevice],
      });

      await this.connectToDevice(discoveredDevice);
    } catch (error: any) {
      let errorMessage = 'Failed to scan for devices';
      
      if (error.name === 'NotFoundError') {
        this.updateState({
          connectionState: 'idle',
          error: 'No device selected',
        });
        return;
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Bluetooth access denied. Please allow Bluetooth permissions in your browser settings.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Bluetooth scanning not supported. On Android, ensure Location is enabled.';
      } else if (error.message?.includes('User denied')) {
        errorMessage = 'Permission denied. Please allow Bluetooth and Location access.';
      } else if (error.message?.includes('adapter')) {
        errorMessage = 'Bluetooth is turned off. Please enable Bluetooth on your device.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.updateState({
        connectionState: 'error',
        error: errorMessage,
      });
    }
  }

  async connectToDevice(discoveredDevice: DiscoveredDevice): Promise<void> {
    try {
      this.updateState({
        connectionState: 'connecting',
        error: null,
        discoveredServices: [],
      });

      this.device = discoveredDevice.device;
      
      if (!this.device) {
        throw new Error('No device available');
      }
      
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      this.server = await this.device.gatt?.connect() ?? null;
      
      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      let serviceFound = false;

      try {
        const service = await this.server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
        this.writeCharacteristic = await service.getCharacteristic(NORDIC_UART_TX_UUID);
        this.notifyCharacteristic = await service.getCharacteristic(NORDIC_UART_RX_UUID);
        serviceFound = true;
        console.log('Connected via Nordic UART Service');
      } catch (e) {
        console.log('Nordic UART not available, trying KPro service...');
      }

      if (!serviceFound) {
        try {
          const service = await this.server.getPrimaryService(KPRO_SERVICE_UUID);
          this.writeCharacteristic = await service.getCharacteristic(KPRO_WRITE_UUID);
          try {
            this.notifyCharacteristic = await service.getCharacteristic(KPRO_NOTIFY_UUID);
          } catch {
            this.notifyCharacteristic = this.writeCharacteristic;
          }
          serviceFound = true;
          console.log('Connected via KPro Service');
        } catch (e) {
          console.log('KPro service not available');
        }
      }

      if (!serviceFound) {
        try {
          const service = await this.server.getPrimaryService(KPRO_V4_SERVICE_UUID);
          console.log('Found KPro V4 service, discovering characteristics...');
          const characteristics = await service.getCharacteristics();
          console.log('KPro V4 characteristics:', characteristics.map(c => ({
            uuid: c.uuid,
            write: c.properties.write || c.properties.writeWithoutResponse,
            notify: c.properties.notify || c.properties.indicate,
            read: c.properties.read,
          })));
          
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.writeCharacteristic = char;
            }
            if (char.properties.notify || char.properties.indicate) {
              this.notifyCharacteristic = char;
            }
          }
          
          if (this.writeCharacteristic || this.notifyCharacteristic) {
            serviceFound = true;
            console.log('Connected via KPro V4 Service');
          }
        } catch (e) {
          console.log('KPro V4 service not available');
        }
      }

      if (!serviceFound) {
        try {
          const service = await this.server.getPrimaryService(ELM327_SERVICE_UUID);
          const char = await service.getCharacteristic(ELM327_CHAR_UUID);
          this.writeCharacteristic = char;
          this.notifyCharacteristic = char;
          serviceFound = true;
          console.log('Connected via ELM327 Service');
        } catch (e) {
          console.log('ELM327 service not available');
        }
      }

      if (!serviceFound) {
        let services: BluetoothRemoteGATTService[] = [];
        const discoveredServices: DiscoveredService[] = [];
        
        try {
          services = await this.server.getPrimaryServices();
          console.log('Available services:', services.map(s => s.uuid));
        } catch (e) {
          console.log('Could not enumerate services:', e);
        }
        
        if (services.length === 0) {
          throw new Error(
            'No BLE services found. Your KPro may use Classic Bluetooth (SPP) which browsers cannot access. ' +
            'Try: 1) Use nRF Connect app to scan your KPro and report the Service UUIDs, ' +
            '2) Use a BLE ELM327 OBD-II adapter, or 3) Check for KPro firmware with BLE support.'
          );
        }
        
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            const serviceInfo: DiscoveredService = {
              uuid: service.uuid,
              characteristics: characteristics.map(c => ({
                uuid: c.uuid,
                canWrite: c.properties.write || c.properties.writeWithoutResponse,
                canNotify: c.properties.notify || c.properties.indicate,
              })),
            };
            discoveredServices.push(serviceInfo);
            
            console.log(`Service ${service.uuid}:`, serviceInfo.characteristics);
            
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                this.writeCharacteristic = char;
              }
              if (char.properties.notify || char.properties.indicate) {
                this.notifyCharacteristic = char;
              }
            }
            
            if (this.writeCharacteristic && this.notifyCharacteristic) {
              serviceFound = true;
              console.log('Connected via discovered service:', service.uuid);
              break;
            }
          } catch (e) {
            console.log(`Failed to get characteristics for service ${service.uuid}:`, e);
            continue;
          }
        }
        
        this.updateState({ discoveredServices });
        
        if (!serviceFound && services.length > 0) {
          const serviceList = discoveredServices.map(s => 
            `${s.uuid} (${s.characteristics.length} chars)`
          ).join(', ');
          throw new Error(
            `Found ${services.length} BLE service(s) but none have compatible characteristics for data communication. ` +
            `Services found: ${serviceList}. ` +
            `Use nRF Connect app to inspect your device and share the service details.`
          );
        }
      }

      if (this.notifyCharacteristic) {
        try {
          await this.notifyCharacteristic.startNotifications();
          this.notifyCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
            this.handleDataReceived(event);
          });
        } catch (e) {
          console.log('Could not start notifications, will poll for data');
        }
      }

      this.updateState({
        connectionState: 'connected',
        connectedDevice: discoveredDevice,
        lastDataReceived: Date.now(),
      });

      await this.initializeConnection();
      this.startPolling();

    } catch (error: any) {
      this.updateState({
        connectionState: 'error',
        error: error.message || 'Failed to connect to device',
        connectedDevice: null,
      });
    }
  }

  private async initializeConnection(): Promise<void> {
    if (!this.writeCharacteristic) return;

    const initCommands = [
      'ATZ',
      'ATE0',
      'ATL0',
      'ATS0',
      'ATH0',
      'ATSP0',
    ];

    for (const cmd of initCommands) {
      try {
        await this.sendCommand(cmd);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.log(`Init command ${cmd} failed:`, e);
      }
    }
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.writeCharacteristic) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(command + '\r');
    
    try {
      if (this.writeCharacteristic.properties.writeWithoutResponse) {
        await this.writeCharacteristic.writeValueWithoutResponse(data);
      } else {
        await this.writeCharacteristic.writeValue(data);
      }
    } catch (e) {
      console.error('Failed to send command:', command, e);
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

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
    }, 15);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private handleDataReceived = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    
    if (!value) return;

    try {
      const decoder = new TextDecoder();
      const text = decoder.decode(value);
      
      const isAscii = /^[\x00-\x7F]*$/.test(text) && text.length > 0;
      
      if (isAscii) {
        this.responseBuffer += text;
        if (this.responseBuffer.includes('>') || this.responseBuffer.includes('\r')) {
          this.parseELMResponse(this.responseBuffer);
          this.responseBuffer = '';
        }
      } else if (value.byteLength >= 10) {
        const telemetry = this.parseBinaryKProData(value);
        if (telemetry.rpm !== undefined && telemetry.rpm > 0) {
          this.currentTelemetry = { ...this.currentTelemetry, ...telemetry };
          this.updateState({ lastDataReceived: Date.now() });
          this.emitTelemetry(this.currentTelemetry);
        }
      }
    } catch (error) {
      console.error('Failed to parse data:', error);
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
          case '0C':
            this.currentTelemetry.rpm = this.parseRPM(dataBytes);
            break;
          case '0D':
            this.currentTelemetry.speed = this.parseSpeed(dataBytes);
            break;
          case '05':
            this.currentTelemetry.coolantTemp = this.parseCoolantTemp(dataBytes);
            break;
          case '0B':
            this.currentTelemetry.map = this.parseMAP(dataBytes);
            break;
          case '11':
            this.currentTelemetry.throttlePosition = this.parseTPS(dataBytes);
            break;
          case '2F':
            this.currentTelemetry.fuelLevel = this.parseFuelLevel(dataBytes);
            break;
        }

        this.updateState({ lastDataReceived: Date.now() });
        this.emitTelemetry(this.currentTelemetry);
      }
    }
  }

  private parseRPM(data: string): number {
    if (data.length >= 4) {
      const a = parseInt(data.substring(0, 2), 16);
      const b = parseInt(data.substring(2, 4), 16);
      return Math.round(((a * 256) + b) / 4);
    }
    return this.currentTelemetry.rpm;
  }

  private parseSpeed(data: string): number {
    if (data.length >= 2) {
      return parseInt(data.substring(0, 2), 16);
    }
    return this.currentTelemetry.speed;
  }

  private parseCoolantTemp(data: string): number {
    if (data.length >= 2) {
      return parseInt(data.substring(0, 2), 16) - 40;
    }
    return this.currentTelemetry.coolantTemp;
  }

  private parseMAP(data: string): number {
    if (data.length >= 2) {
      return parseInt(data.substring(0, 2), 16);
    }
    return this.currentTelemetry.map;
  }

  private parseTPS(data: string): number {
    if (data.length >= 2) {
      return Math.round(parseInt(data.substring(0, 2), 16) * 100 / 255);
    }
    return this.currentTelemetry.throttlePosition;
  }

  private parseFuelLevel(data: string): number {
    if (data.length >= 2) {
      return Math.round(parseInt(data.substring(0, 2), 16) * 100 / 255);
    }
    return this.currentTelemetry.fuelLevel;
  }

  private parseBinaryKProData(data: DataView): Partial<TelemetryData> {
    try {
      const rpm = data.getUint16(0, true);
      const speed = data.getUint8(2);
      const coolantTemp = data.getInt8(3);
      const throttlePosition = data.getUint8(4);
      const map = data.getUint16(5, true);
      const afr = data.getUint8(7) / 10;
      const fuelLevel = data.getUint8(8);
      const flags = data.byteLength > 9 ? data.getUint8(9) : 0;
      
      return {
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
    } catch (e) {
      return {};
    }
  }

  private handleDisconnect() {
    this.stopPolling();
    this.updateState({
      connectionState: 'idle',
      connectedDevice: null,
      lastDataReceived: null,
    });
    this.device = null;
    this.server = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.responseBuffer = '';
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.handleDisconnect();
  }
}

export const bluetoothService = new BluetoothService();
