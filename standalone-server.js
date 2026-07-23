const http = require('http');
const fs = require('fs');
const path = require('path');

let WebSocketServer, WebSocket;
try {
  const ws = require('ws');
  WebSocketServer = ws.WebSocketServer || ws.Server;
  WebSocket = ws.WebSocket || ws;
} catch (e) {
  WebSocketServer = null;
  WebSocket = null;
}

let usb;
try {
  usb = require('usb');
} catch (e) {
  usb = null;
}

let SerialPort;
try {
  SerialPort = require('serialport').SerialPort;
} catch (e) {
  try {
    const sp = require('serialport');
    SerialPort = sp.SerialPort || sp;
  } catch (e2) {
    SerialPort = null;
  }
}

const PORT = parseInt(process.env.PORT || '8080', 10);
const SERIAL_PORT = process.env.SERIAL_PORT || '';
const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD || '38400', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '0709281001';
const MASTER_BUNDLE_VERSION = '1.4';

const KPRO4_VENDOR_ID = 0x1C40;
const KPRO4_PRODUCT_ID = 0x0434;
const KPRO23_VENDOR_ID = 0x0403;
const KPRO23_PRODUCT_ID = 0xF5F8;

const KPRO4_ID = 4;
const KPRO23_ID = 23;

const KPRO4_DATA_MAP = {
  cmd60: { RPM1: 2, RPM2: 3, VSS: 4, TPS: 5, MAP: 6, CAM: 8, AFR1: 16, AFR2: 17, GEAR: 35, SWITCHES: 31 },
  cmd61: { ECT: 2, IAT: 3, BAT: 4 },
  cmd65: { MIL: 30, VTP: 30, VTS: 30, ETH: 98, FLT: 99 },
};

const KPRO23_DATA_MAP = {
  cmd60: { RPM1: 4, RPM2: 5, VSS: 6, TPS: 7, MAP: 8, CAM: 10, AFR1: 18, AFR2: 19, GEAR: 37, SWITCHES: 33 },
  cmd61: { ECT: 4, IAT: 5, BAT: 6 },
};

const KPRO_TEMP_TABLE = [
  [0, 215], [1, 210], [2, 205], [3, 200], [5, 195], [7, 190], [9, 185],
  [11, 180], [13, 175], [16, 170], [19, 165], [22, 160], [26, 155],
  [30, 150], [34, 145], [39, 140], [44, 135], [50, 130], [56, 125],
  [63, 120], [70, 115], [78, 110], [86, 105], [95, 100], [104, 95],
  [113, 90], [123, 85], [133, 80], [142, 75], [152, 70], [161, 65],
  [170, 60], [178, 55], [186, 50], [193, 45], [199, 40], [205, 35],
  [210, 30], [214, 25], [218, 20], [221, 15], [224, 10], [226, 5],
  [228, 0], [230, -5], [232, -10], [234, -15], [235, -20], [236, -25],
  [237, -30], [238, -35], [239, -40],
];

function kproTempConvert(rawValue) {
  if (rawValue === undefined || rawValue === null) return 0;
  for (let i = 0; i < KPRO_TEMP_TABLE.length - 1; i++) {
    const [raw0, temp0] = KPRO_TEMP_TABLE[i];
    const [raw1, temp1] = KPRO_TEMP_TABLE[i + 1];
    if (rawValue >= raw0 && rawValue <= raw1) {
      const ratio = (rawValue - raw0) / (raw1 - raw0);
      return Math.round(temp0 + ratio * (temp1 - temp0));
    }
  }
  if (rawValue < KPRO_TEMP_TABLE[0][0]) return KPRO_TEMP_TABLE[0][1];
  return KPRO_TEMP_TABLE[KPRO_TEMP_TABLE.length - 1][1];
}

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

const defaultSettings = {"maxRpm":9000,"redlineRpm":8000,"shiftLightRpm":7800,"speedUnit":"mph","tempUnit":"fahrenheit","brightness":100,"coolantWarningTemp":105,"lowFuelWarning":15,"afrTargetLow":12.5,"afrTargetHigh":15.5,"mapWarningHigh":200,"mapUnit":"kpa","fuelTankCapacity":11.9,"themePreset":"green","gaugeColors":{"tachometer":"green","speedometer":"green","coolant":"green","fuel":"green","afr":"green","map":"green","trip":"green"}};
const defaultLayout = {"gauges":[{"id":"coolantTemp","x":16,"y":8,"width":160,"height":100,"visible":true,"scale":100},{"id":"tachometer","x":192,"y":8,"width":520,"height":100,"visible":true,"scale":100},{"id":"speedometer","x":728,"y":8,"width":200,"height":100,"visible":true,"scale":100},{"id":"fuelLevel","x":728,"y":120,"width":160,"height":100,"visible":true,"scale":100},{"id":"afr","x":16,"y":130,"width":160,"height":100,"visible":true,"scale":100},{"id":"map","x":192,"y":130,"width":160,"height":100,"visible":true,"scale":100},{"id":"tripMeter","x":368,"y":130,"width":320,"height":80,"visible":true,"scale":100}]};
const defaultTripData = {"odometer":0,"tripA":0,"tripB":0};

function generateDemoTelemetry(time) {
  const baseRpm = 2500;
  const rpmVariation = Math.sin(time * 0.5) * 2000 + Math.sin(time * 1.3) * 1000 + Math.sin(time * 0.2) * 500;
  const rpm = Math.max(800, Math.min(8500, baseRpm + rpmVariation));
  const speed = Math.max(0, (rpm - 1000) / 80 + Math.sin(time * 0.7) * 1.5);
  const coolantBase = 85 + Math.sin(time * 0.08) * 10 + Math.sin(time * 0.03) * 3;
  const fuelLevel = 75 - (time * 0.0008) % 65;
  const afr = 14.7 + Math.sin(time * 1.8) * 0.3 + Math.sin(time * 0.4) * 0.15 + (rpm > 6000 ? -0.5 : 0);
  const mapVal = 30 + (rpm / 9000) * 70 + Math.sin(time * 1.1) * 4;
  const throttle = Math.max(0, Math.min(100, (rpm - 800) / 77 + Math.sin(time * 0.9) * 3));
  const vtcDeg = parseFloat(((Math.sin(time * 0.3) * 15 + 20) + Math.sin(time * 0.8) * 3).toFixed(1));
  const timingAdv = parseFloat((15 + (rpm / 9000) * 20 + Math.sin(time * 0.6) * 4).toFixed(1));
  const injPw = parseFloat((1.5 + (rpm / 9000) * 6 + Math.sin(time * 0.4) * 0.5).toFixed(2));
  const injDuty = parseFloat(Math.min(95, Math.max(2, (injPw * rpm) / 1200)).toFixed(1));
  const iatVal = parseFloat((35 + Math.sin(time * 0.05) * 8 + Math.sin(time * 0.15) * 3).toFixed(1));
  const oilTempVal = parseFloat((90 + Math.sin(time * 0.04) * 12 + Math.sin(time * 0.1) * 4).toFixed(1));
  const oilPressVal = parseFloat((40 + (rpm / 9000) * 35 + Math.sin(time * 0.7) * 5).toFixed(1));
  const batVal = parseFloat((13.8 + Math.sin(time * 0.12) * 0.6).toFixed(1));
  const stftVal = parseFloat((Math.sin(time * 1.5) * 4 + Math.sin(time * 0.3) * 2).toFixed(1));
  const ltftVal = parseFloat((Math.sin(time * 0.05) * 3 + 1).toFixed(1));
  const knockVal = Math.sin(time * 0.01) > 0.95 ? Math.floor(Math.random() * 3) : 0;
  const gearVal = speed < 5 ? 0 : speed < 20 ? 1 : speed < 40 ? 2 : speed < 60 ? 3 : speed < 80 ? 4 : 5;
  return {
    rpm: parseFloat(rpm.toFixed(1)),
    speed: parseFloat(speed.toFixed(1)),
    coolantTemp: parseFloat(coolantBase.toFixed(1)),
    fuelLevel: Math.max(10, parseFloat(fuelLevel.toFixed(1))),
    afr: parseFloat(afr.toFixed(2)),
    map: parseFloat(mapVal.toFixed(1)),
    throttlePosition: parseFloat(throttle.toFixed(1)),
    oilPressure: oilPressVal,
    oilTemp: oilTempVal,
    batteryVoltage: batVal,
    iat: iatVal,
    gear: gearVal,
    vtcDegree: vtcDeg,
    timingAdvance: timingAdv,
    injectorPulseWidth: injPw,
    injectorDutyCycle: injDuty,
    stft: stftVal,
    ltft: ltftVal,
    knockCount: knockVal,
    dtcCodes: [],
    checkEngine: false,
    vtec: rpm > 5800,
  };
}

let ecuTelemetry = null;
let ecuConnected = false;
let ecuConnectionMode = null;
let ecuDeviceName = null;
let ecuVersion = null;

let kproDevice = null;
let kproInterface = null;
let kproEndpointOut = null;
let kproEndpointIn = null;
let kproUpdateInterval = null;
let kproReconnectTimer = null;

let serialPortInstance = null;
let serialConnected = false;
let responseBuffer = '';
let serialPollInterval = null;

let currentTelemetry = {
  rpm: 0, speed: 0, coolantTemp: 0, fuelLevel: 0,
  afr: 14.7, map: 0, throttlePosition: 0,
  checkEngine: false, vtec: false,
  oilPressure: null, oilTemp: null, batteryVoltage: null,
  iat: null, gear: null, vtcDegree: null, timingAdvance: null,
  injectorPulseWidth: null, injectorDutyCycle: null,
  stft: null, ltft: null, knockCount: null, dtcCodes: [],
};

function listUsbDevices() {
  const devices = [];
  if (usb) {
    try {
      const deviceList = usb.getDeviceList();
      for (const dev of deviceList) {
        const desc = dev.deviceDescriptor;
        let name = `USB Device ${desc.idVendor.toString(16)}:${desc.idProduct.toString(16)}`;
        let isKpro = false;
        let kproVersion = null;

        if (desc.idVendor === KPRO4_VENDOR_ID && desc.idProduct === KPRO4_PRODUCT_ID) {
          name = 'Hondata KPro V4';
          isKpro = true;
          kproVersion = 'v4';
        } else if (desc.idVendor === KPRO23_VENDOR_ID && desc.idProduct === KPRO23_PRODUCT_ID) {
          name = 'Hondata KPro V2/V3';
          isKpro = true;
          kproVersion = 'v2/v3';
        }

        devices.push({
          vendorId: desc.idVendor,
          productId: desc.idProduct,
          name: name,
          isKpro: isKpro,
          kproVersion: kproVersion,
          busNumber: dev.busNumber,
          deviceAddress: dev.deviceAddress,
        });
      }
    } catch (e) {
      console.error('Error listing USB devices:', e.message);
    }
  }

  const serialCandidates = [
    '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2',
    '/dev/ttyACM0', '/dev/ttyACM1',
    '/dev/ttyAMA0', '/dev/serial0',
  ];
  for (const p of serialCandidates) {
    if (fs.existsSync(p)) {
      devices.push({
        vendorId: 0,
        productId: 0,
        name: `Serial Port: ${p}`,
        isKpro: false,
        kproVersion: null,
        serialPort: p,
        type: 'serial',
      });
    }
  }

  return devices;
}

function disconnectKpro() {
  if (kproUpdateInterval) { clearInterval(kproUpdateInterval); kproUpdateInterval = null; }
  if (kproReconnectTimer) { clearTimeout(kproReconnectTimer); kproReconnectTimer = null; }
  if (kproInterface) {
    try { kproInterface.release(true, () => {}); } catch (e) {}
    kproInterface = null;
  }
  if (kproDevice) {
    try { kproDevice.close(); } catch (e) {}
    kproDevice = null;
  }
  kproEndpointOut = null;
  kproEndpointIn = null;
  if (ecuConnectionMode === 'kpro-usb') {
    ecuConnected = false;
    ecuConnectionMode = null;
    ecuDeviceName = null;
    ecuVersion = null;
    ecuTelemetry = null;
  }
}

function disconnectSerial() {
  if (serialPollInterval) { clearInterval(serialPollInterval); serialPollInterval = null; }
  if (serialPortInstance) {
    try { serialPortInstance.close(); } catch (e) {}
    serialPortInstance = null;
  }
  serialConnected = false;
  responseBuffer = '';
  if (ecuConnectionMode === 'serial') {
    ecuConnected = false;
    ecuConnectionMode = null;
    ecuDeviceName = null;
    ecuTelemetry = null;
  }
}

function connectKproUsb(vendorId, productId) {
  if (!usb) {
    console.log('[KPro] usb module not available — run: npm install usb');
    return false;
  }

  disconnectKpro();

  try {
    console.log(`[KPro] Searching for device ${vendorId.toString(16).toUpperCase()}:${productId.toString(16).toUpperCase()}...`);
    const device = usb.findByIds(vendorId, productId);
    if (!device) {
      console.log('[KPro] Device not found. Check USB cable and that ignition is ON.');
      return false;
    }
    console.log('[KPro] Device found. Opening...');

    device.open();
    kproDevice = device;
    console.log('[KPro] Device opened.');

    // Set the active USB configuration (required — matches PyUSB device.set_configuration())
    try {
      device.setConfiguration(1, (err) => {
        if (err) console.log('[KPro] setConfiguration warning (non-fatal):', err.message);
      });
    } catch (e) {
      // Synchronous fallback — older node-usb versions
      console.log('[KPro] setConfiguration fallback (non-fatal):', e.message);
    }

    const cfg = device.interfaces[0];
    if (!cfg) {
      console.log('[KPro] No USB interface found on device.');
      device.close();
      kproDevice = null;
      return false;
    }

    if (cfg.isKernelDriverActive()) {
      console.log('[KPro] Detaching kernel driver...');
      try { cfg.detachKernelDriver(); } catch (e) {
        console.log('[KPro] detachKernelDriver warning (non-fatal):', e.message);
      }
    }

    cfg.claim();
    kproInterface = cfg;
    console.log('[KPro] Interface claimed.');

    let epOut = null;
    let epIn = null;
    for (const ep of cfg.endpoints) {
      if (ep.direction === 'out') epOut = ep;
      if (ep.direction === 'in') epIn = ep;
    }

    if (!epOut || !epIn) {
      console.log('[KPro] Could not find USB endpoints. Found:', cfg.endpoints.map(e => e.direction).join(', '));
      cfg.release(true, () => {});
      device.close();
      kproDevice = null;
      kproInterface = null;
      return false;
    }

    console.log(`[KPro] Endpoints: OUT=0x${epOut.address.toString(16)} IN=0x${epIn.address.toString(16)}`);

    kproEndpointOut = epOut;
    kproEndpointIn = epIn;

    const version = (vendorId === KPRO4_VENDOR_ID) ? KPRO4_ID : KPRO23_ID;
    ecuVersion = version;
    ecuConnectionMode = 'kpro-usb';
    ecuDeviceName = (version === KPRO4_ID) ? 'Hondata KPro V4' : 'Hondata KPro V2/V3';
    ecuConnected = true;

    console.log(`[KPro] ✓ Connected to ${ecuDeviceName} via USB. Starting data polling...`);

    startKproPolling(version);
    return true;

  } catch (e) {
    console.error('[KPro] Failed to connect:', e.message);
    if (e.message && e.message.includes('LIBUSB_ERROR_ACCESS')) {
      console.error('[KPro] ACCESS DENIED — udev rules may not be installed.');
      console.error('[KPro] Fix: run "sudo bash install.sh" which sets up udev rules,');
      console.error('[KPro]      or manually create /etc/udev/rules.d/99-kpro.rules');
      console.error('[KPro]      and run: sudo udevadm control --reload-rules && sudo udevadm trigger');
    }
    disconnectKpro();
    return false;
  }
}

function kproUsbTransfer(commandByte, readSize) {
  return new Promise((resolve, reject) => {
    if (!kproEndpointOut || !kproEndpointIn) {
      return reject(new Error('No USB endpoints'));
    }

    const cmdBuf = Buffer.from([commandByte]);
    kproEndpointOut.transfer(cmdBuf, (err) => {
      if (err) return reject(err);

      kproEndpointIn.transfer(readSize || 1000, (err2, data) => {
        if (err2) {
          if (err2.errno === -7) return resolve(Buffer.alloc(0));
          return reject(err2);
        }
        resolve(data || Buffer.alloc(0));
      });
    });
  });
}

async function readKproData(version) {
  try {
    const data4 = await kproUsbTransfer(0x40, 1000);
    const data0 = await kproUsbTransfer(0x60, 1000);
    const data1 = await kproUsbTransfer(0x61, 1000);
    const data2 = await kproUsbTransfer(0x62, 1000);

    let data3 = Buffer.alloc(0);
    if (version === KPRO4_ID) {
      data3 = await kproUsbTransfer(0x65, 128);
    }

    const map = (version === KPRO4_ID) ? KPRO4_DATA_MAP : KPRO23_DATA_MAP;

    const safeGet = (buf, idx) => {
      if (!buf || idx >= buf.length || idx < 0) return 0;
      return buf[idx];
    };

    const rpmRaw = (256 * safeGet(data0, map.cmd60.RPM2) + safeGet(data0, map.cmd60.RPM1)) * 0.25;
    const vssKmh = safeGet(data0, map.cmd60.VSS);
    const tpsRaw = safeGet(data0, map.cmd60.TPS);
    const mapRaw = safeGet(data0, map.cmd60.MAP);
    const camRaw = safeGet(data0, map.cmd60.CAM);
    const gearRaw = safeGet(data0, map.cmd60.GEAR);
    const switchesRaw = safeGet(data0, map.cmd60.SWITCHES);

    const afr1 = safeGet(data0, map.cmd60.AFR1);
    const afr2 = safeGet(data0, map.cmd60.AFR2);
    let afrValue = 14.7;
    const afrDenom = 256 * afr2 + afr1;
    if (afrDenom > 0) {
      const lambda = 32768.0 / afrDenom;
      afrValue = parseFloat((lambda * 14.7).toFixed(2));
    }

    const ectRaw = safeGet(data1, map.cmd61.ECT);
    const iatRaw = safeGet(data1, map.cmd61.IAT);
    const batRaw = safeGet(data1, map.cmd61.BAT);

    const ectCelsius = kproTempConvert(ectRaw);
    const iatCelsius = kproTempConvert(iatRaw);
    const battery = batRaw * 0.1;

    const tps = Math.max(0, Math.min(100, Math.round(((tpsRaw - 21) / (229 - 21)) * 100)));
    const mapKpa = mapRaw;
    const speedMph = Math.round(vssKmh * 0.621371);
    const cam = (camRaw - 40) * 0.5;

    let mil = false;
    let vtpActive = false;
    let vtsActive = false;
    if (version === KPRO4_ID && data3.length > 30) {
      mil = !!(safeGet(data3, KPRO4_DATA_MAP.cmd65.MIL) & 0x20);
      vtpActive = !!(safeGet(data3, KPRO4_DATA_MAP.cmd65.VTP) & 0x01);
      vtsActive = !!(safeGet(data3, KPRO4_DATA_MAP.cmd65.VTS) & 0x02);
    }

    const vtec = vtpActive && vtsActive;
    const flr = !!(switchesRaw & 0x40);
    const fanc = !!(switchesRaw & 0x80);
    const bksw = !!(switchesRaw & 0x02);

    currentTelemetry = {
      rpm: Math.round(rpmRaw),
      speed: speedMph,
      coolantTemp: ectCelsius,
      fuelLevel: 50,
      afr: afrValue,
      map: mapKpa,
      throttlePosition: tps,
      checkEngine: mil,
      vtec: vtec,
      gear: gearRaw,
      iat: iatCelsius,
      batteryVoltage: parseFloat(battery.toFixed(1)),
      vtcDegree: parseFloat(cam.toFixed(1)),
      oilPressure: null,
      oilTemp: null,
      timingAdvance: null,
      injectorPulseWidth: null,
      injectorDutyCycle: null,
      stft: null,
      ltft: null,
      knockCount: null,
      dtcCodes: null,
    };

    ecuTelemetry = { ...currentTelemetry };
    return true;

  } catch (e) {
    if (e.message && (e.message.includes('LIBUSB') || e.message.includes('No USB'))) {
      console.error('KPro USB read error:', e.message);
      return false;
    }
    console.error('KPro data read error:', e.message);
    return false;
  }
}

function startKproPolling(version) {
  if (kproUpdateInterval) clearInterval(kproUpdateInterval);

  let consecutiveErrors = 0;
  const MAX_ERRORS = 10;

  kproUpdateInterval = setInterval(async () => {
    if (!kproDevice || !kproEndpointOut || !kproEndpointIn) {
      clearInterval(kproUpdateInterval);
      kproUpdateInterval = null;
      return;
    }

    const success = await readKproData(version);
    if (success) {
      consecutiveErrors = 0;
    } else {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_ERRORS) {
        console.log('Too many KPro USB errors, reconnecting...');
        disconnectKpro();
        scheduleKproReconnect();
      }
    }
  }, 50);
}

function scheduleKproReconnect() {
  if (kproReconnectTimer) return;
  kproReconnectTimer = setTimeout(() => {
    kproReconnectTimer = null;
    autoConnectKpro();
  }, 5000);
}

function autoConnectKpro() {
  if (ecuConnected) return;
  if (!usb) return;

  const kpro4 = usb.findByIds(KPRO4_VENDOR_ID, KPRO4_PRODUCT_ID);
  if (kpro4) {
    console.log('KPro V4 detected, connecting...');
    connectKproUsb(KPRO4_VENDOR_ID, KPRO4_PRODUCT_ID);
    return;
  }

  const kpro23 = usb.findByIds(KPRO23_VENDOR_ID, KPRO23_PRODUCT_ID);
  if (kpro23) {
    console.log('KPro V2/V3 detected, connecting...');
    connectKproUsb(KPRO23_VENDOR_ID, KPRO23_PRODUCT_ID);
    return;
  }
}

function parseELMResponse(response) {
  const lines = response.split('\r').filter(l => l.trim());
  for (const line of lines) {
    const clean = line.replace(/\s/g, '').toUpperCase();
    if (clean.startsWith('41')) {
      const pid = clean.substring(2, 4);
      const dataBytes = clean.substring(4);
      switch (pid) {
        case '0C':
          if (dataBytes.length >= 4) {
            const a = parseInt(dataBytes.substring(0, 2), 16);
            const b = parseInt(dataBytes.substring(2, 4), 16);
            currentTelemetry.rpm = Math.round(((a * 256) + b) / 4);
          }
          break;
        case '0D':
          if (dataBytes.length >= 2)
            currentTelemetry.speed = parseInt(dataBytes.substring(0, 2), 16);
          break;
        case '05':
          if (dataBytes.length >= 2)
            currentTelemetry.coolantTemp = parseInt(dataBytes.substring(0, 2), 16) - 40;
          break;
        case '0B':
          if (dataBytes.length >= 2)
            currentTelemetry.map = parseInt(dataBytes.substring(0, 2), 16);
          break;
        case '11':
          if (dataBytes.length >= 2)
            currentTelemetry.throttlePosition = Math.round(parseInt(dataBytes.substring(0, 2), 16) * 100 / 255);
          break;
        case '2F':
          if (dataBytes.length >= 2)
            currentTelemetry.fuelLevel = Math.round(parseInt(dataBytes.substring(0, 2), 16) * 100 / 255);
          break;
      }
      ecuTelemetry = { ...currentTelemetry };
    }
  }
}

function connectSerialPort(portPath) {
  if (!SerialPort) {
    console.log('serialport module not found. Install: npm install serialport');
    return false;
  }

  disconnectSerial();

  if (!portPath) {
    const candidates = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyAMA0', '/dev/serial0'];
    portPath = SERIAL_PORT || candidates.find(p => fs.existsSync(p));
  }

  if (!portPath) {
    console.log('No serial port detected.');
    return false;
  }

  console.log(`Connecting to serial port: ${portPath} at ${SERIAL_BAUD} baud...`);

  try {
    serialPortInstance = new SerialPort({
      path: portPath,
      baudRate: SERIAL_BAUD,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });

    serialPortInstance.on('open', () => {
      console.log(`Serial port ${portPath} opened successfully`);
      serialConnected = true;
      ecuConnected = true;
      ecuConnectionMode = 'serial';
      ecuDeviceName = `Serial: ${portPath}`;

      const initCmds = ['ATZ\r', 'ATE0\r', 'ATL0\r', 'ATS0\r', 'ATH0\r', 'ATSP0\r'];
      let i = 0;
      const sendInit = () => {
        if (i < initCmds.length) {
          serialPortInstance.write(initCmds[i]);
          i++;
          setTimeout(sendInit, 200);
        } else {
          startSerialPolling();
        }
      };
      setTimeout(sendInit, 500);
    });

    serialPortInstance.on('data', (data) => {
      responseBuffer += data.toString();
      if (responseBuffer.includes('>') || responseBuffer.includes('\r\r')) {
        parseELMResponse(responseBuffer);
        responseBuffer = '';
      }
    });

    serialPortInstance.on('error', (err) => {
      console.error('Serial port error:', err.message);
      disconnectSerial();
    });

    serialPortInstance.on('close', () => {
      console.log('Serial port closed.');
      disconnectSerial();
    });

    return true;
  } catch (err) {
    console.error('Failed to open serial port:', err.message);
    return false;
  }
}

function startSerialPolling() {
  if (serialPollInterval) clearInterval(serialPollInterval);
  const pids = ['010C\r', '010D\r', '0105\r', '010B\r', '0111\r', '012F\r'];
  let idx = 0;
  serialPollInterval = setInterval(() => {
    if (serialPortInstance && serialConnected) {
      serialPortInstance.write(pids[idx]);
      idx = (idx + 1) % pids.length;
    }
  }, 50);
}

function handleApiRequest(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (url === '/api/settings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(defaultSettings));
  }
  if (url === '/api/layout') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(defaultLayout));
  }
  if (url === '/api/trip-data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(defaultTripData));
  }

  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      connectedClients: clients.size,
      ecuConnected: ecuConnected,
      ecuConnectionMode: ecuConnectionMode,
      ecuDeviceName: ecuDeviceName,
      ecuVersion: ecuVersion,
      demoMode: !ecuConnected,
      usbLibAvailable: !!usb,
      serialLibAvailable: !!SerialPort,
      timestamp: Date.now(),
    }));
  }

  if (url === '/api/usb/devices') {
    const devices = listUsbDevices();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      devices: devices,
      ecuConnected: ecuConnected,
      ecuConnectionMode: ecuConnectionMode,
      ecuDeviceName: ecuDeviceName,
      usbLibAvailable: !!usb,
      serialLibAvailable: !!SerialPort,
    }));
  }

  if (url === '/api/usb/connect' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        let success = false;

        if (data.type === 'serial' && data.serialPort) {
          success = connectSerialPort(data.serialPort);
        } else if (data.vendorId && data.productId) {
          success = connectKproUsb(data.vendorId, data.productId);
        } else if (data.type === 'auto') {
          autoConnectKpro();
          if (!ecuConnected) {
            connectSerialPort();
          }
          success = ecuConnected;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: success,
          ecuConnected: ecuConnected,
          ecuConnectionMode: ecuConnectionMode,
          ecuDeviceName: ecuDeviceName,
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url === '/api/usb/disconnect' && req.method === 'POST') {
    disconnectKpro();
    disconnectSerial();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, ecuConnected: false }));
  }

  if (url === '/api/download-master') {
    const headerPass = req.headers['x-master-password'] || '';
    let queryPass = '';
    try {
      const u = new URL(req.url, 'http://localhost');
      queryPass = u.searchParams.get('key') || '';
    } catch (e) {}
    const provided = headerPass || queryPass;
    if (!provided || provided !== MASTER_PASSWORD) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Incorrect password.' }));
    }
    const candidates = [
      path.join(__dirname, `kpro-gauges-self-host-v${MASTER_BUNDLE_VERSION}.zip`),
      path.join(PUBLIC_DIR, 'downloads', `kpro-gauges-self-host-v${MASTER_BUNDLE_VERSION}.zip`),
    ];
    let filePath = candidates.find(p => fs.existsSync(p));
    if (!filePath) {
      // Try to build it on demand using the bundled pure-Node script.
      const builderScript = path.join(__dirname, 'tools', 'build-master-bundle.mjs');
      if (fs.existsSync(builderScript)) {
        try {
          const { spawnSync } = require('child_process');
          const r = spawnSync(process.execPath, [builderScript], { cwd: __dirname, encoding: 'utf8' });
          if (r.status === 0) {
            filePath = candidates.find(p => fs.existsSync(p));
          } else {
            console.error('[master-bundle] builder failed:', r.stderr || r.stdout);
          }
        } catch (e) {
          console.error('[master-bundle] builder error:', e.message);
        }
      }
    }
    if (!filePath) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Bundle not built',
        hint: `Run: node tools/build-master-bundle.mjs  (creates kpro-gauges-self-host-v${MASTER_BUNDLE_VERSION}.zip next to server.js).`,
      }));
    }
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="kpro-gauges-self-host-v${MASTER_BUNDLE_VERSION}.zip"`,
      'Content-Length': fs.statSync(filePath).size,
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  if (url === '/api/serial/ports') {
    const candidates = ['/dev/ttyUSB0','/dev/ttyUSB1','/dev/ttyACM0','/dev/ttyACM1','/dev/ttyAMA0','/dev/serial0'];
    const available = candidates.filter(p => fs.existsSync(p));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ports: available, connected: ecuConnected, currentPort: serialPortInstance ? serialPortInstance.path : null }));
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url.startsWith('/api/')) {
    const handled = handleApiRequest(req, res, url);
    if (handled !== false) return;
  }

  let filePath = path.join(PUBLIC_DIR, url === '/' ? 'index.html' : url);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    const content = fs.readFileSync(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const clients = new Set();
let demoTime = 0;
let demoInterval = null;

function broadcastTelemetry(telemetry) {
  const msg = JSON.stringify(telemetry);
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

if (WebSocketServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const startBroadcast = () => {
    if (demoInterval) return;
    demoInterval = setInterval(() => {
      if (ecuConnected && ecuTelemetry) {
        const payload = { ...ecuTelemetry, _source: 'ecu' };
        broadcastTelemetry(payload);
      } else {
        demoTime += 0.033;
        const payload = { ...generateDemoTelemetry(demoTime), _source: 'demo' };
        broadcastTelemetry(payload);
      }
    }, 33);
  };

  wss.on('connection', (ws) => {
    clients.add(ws);
    if (clients.size === 1) startBroadcast();
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'KPro Gauge Cluster v1.4',
      ecuConnected: ecuConnected,
      ecuConnectionMode: ecuConnectionMode,
      ecuDeviceName: ecuDeviceName,
      usbLibAvailable: !!usb,
      serialLibAvailable: !!SerialPort,
      timestamp: Date.now(),
    }));
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'connect_device') {
          if (data.vendorId && data.productId) {
            connectKproUsb(data.vendorId, data.productId);
          } else if (data.serialPort) {
            connectSerialPort(data.serialPort);
          } else {
            autoConnectKpro();
            if (!ecuConnected) connectSerialPort();
          }
          ws.send(JSON.stringify({
            type: 'connection_status',
            ecuConnected: ecuConnected,
            ecuConnectionMode: ecuConnectionMode,
            ecuDeviceName: ecuDeviceName,
          }));
        } else if (data.type === 'disconnect_device') {
          disconnectKpro();
          disconnectSerial();
          ws.send(JSON.stringify({
            type: 'connection_status',
            ecuConnected: false,
            ecuConnectionMode: null,
            ecuDeviceName: null,
          }));
        } else if (data.type === 'list_devices') {
          const devices = listUsbDevices();
          ws.send(JSON.stringify({
            type: 'device_list',
            devices: devices,
            ecuConnected: ecuConnected,
            ecuConnectionMode: ecuConnectionMode,
            ecuDeviceName: ecuDeviceName,
          }));
        } else if (data.type === 'settings_sync' || data.type === 'layout_sync') {
          clients.forEach(client => {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify({ type: data.type, payload: data.payload }));
            }
          });
        }
      } catch (_e) {}
    });
    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0 && demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
      }
    });
  });
} else {
  console.log('[WARN] ws module not found. Install: npm install ws');
}

autoConnectKpro();
if (!ecuConnected) {
  connectSerialPort();
}

setInterval(() => {
  if (!ecuConnected) {
    autoConnectKpro();
    if (!ecuConnected && SerialPort) {
      const candidates = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0', '/dev/ttyACM1'];
      const portPath = candidates.find(p => fs.existsSync(p));
      if (portPath) {
        console.log(`USB device detected at ${portPath}, attempting serial connection...`);
        connectSerialPort(portPath);
      }
    }
  }
}, 10000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=====================================================');
  console.log('  S2000 KPro Gauge Cluster - Standalone Server');
  console.log('  Version: v1.4');
  console.log('=====================================================');
  console.log(`  Web UI:       http://localhost:${PORT}`);
  console.log(`  ECU Status:   ${ecuConnected ? 'Connected (' + ecuDeviceName + ')' : 'Not connected'}`);
  console.log(`  USB Library:  ${usb ? 'Available (KPro native protocol)' : 'Not installed (npm install usb)'}`);
  console.log(`  Serial Lib:   ${SerialPort ? 'Available (ELM327 fallback)' : 'Not installed (npm install serialport)'}`);
  console.log('');
  console.log('  Connection Methods (in priority order):');
  console.log('    1. KPro USB: Native protocol - plug KPro USB-B into Pi USB-A');
  console.log('       Vendor 0x1C40:0x0434 (V4) or 0x0403:0xF5F8 (V2/V3)');
  console.log('       Auto-detected. Works in any browser (surf, midori, etc.)');
  console.log('    2. ELM327 Serial: Fallback for OBD-II adapters');
  console.log('       Set SERIAL_PORT=/dev/ttyUSBx if not auto-detected');
  console.log('    3. Demo Mode: Simulated data when no ECU connected');
  console.log('');
  console.log('  USB Device Selection:');
  console.log('    Open the web UI and use the ECU Connection menu');
  console.log('    to see available devices and connect manually.');
  console.log('');
  console.log('  Phone Remote Control:');
  console.log('    Connect phone to Pi hotspot WiFi, then open');
  console.log(`    http://192.168.4.1:${PORT} in phone browser`);
  console.log('    (see setup-hotspot.sh to enable WiFi hotspot)');
  console.log('=====================================================');
  console.log('');
});
