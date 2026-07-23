import { z } from "zod";

export const telemetryDataSchema = z.object({
  rpm: z.number().min(0).max(12000),
  speed: z.number().min(0).max(300),
  coolantTemp: z.number().min(-40).max(150),
  fuelLevel: z.number().min(0).max(100),
  afr: z.number().min(8).max(20),
  map: z.number().min(0).max(300),
  throttlePosition: z.number().min(0).max(100),
  oilPressure: z.number().min(0).max(150).optional(),
  oilTemp: z.number().min(-40).max(200).optional(),
  batteryVoltage: z.number().min(0).max(20).optional(),
  iat: z.number().min(-40).max(100).optional(),
  gear: z.number().min(0).max(6).optional(),
  vtcDegree: z.number().min(-50).max(50).optional(),
  timingAdvance: z.number().min(-10).max(60).optional(),
  injectorPulseWidth: z.number().min(0).max(30).optional(),
  injectorDutyCycle: z.number().min(0).max(100).optional(),
  stft: z.number().min(-50).max(50).optional(),
  ltft: z.number().min(-50).max(50).optional(),
  knockCount: z.number().min(0).max(255).optional(),
  dtcCodes: z.array(z.string()).optional(),
  checkEngine: z.boolean().default(false),
  vtec: z.boolean().default(false),
});

export type TelemetryData = z.infer<typeof telemetryDataSchema>;

export const gaugePositionSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  visible: z.boolean().default(true),
  scale: z.number().min(50).max(300).default(100),
});

export type GaugePosition = z.infer<typeof gaugePositionSchema>;

export const layoutConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  gauges: z.array(gaugePositionSchema),
});

export type LayoutConfig = z.infer<typeof layoutConfigSchema>;

export const gaugeColorValues = ["red", "yellow", "blue", "orange", "green", "white"] as const;
export type GaugeColor = typeof gaugeColorValues[number];

export const themePresetValues = ["white", "blue", "red", "green", "yellow", "multicolor", "custom"] as const;
export type ThemePreset = typeof themePresetValues[number];

export const gaugeColorsSchema = z.object({
  tachometer: z.enum(gaugeColorValues).default("green"),
  speedometer: z.enum(gaugeColorValues).default("green"),
  coolant: z.enum(gaugeColorValues).default("green"),
  fuel: z.enum(gaugeColorValues).default("green"),
  afr: z.enum(gaugeColorValues).default("green"),
  map: z.enum(gaugeColorValues).default("green"),
  trip: z.enum(gaugeColorValues).default("green"),
});

export type GaugeColors = z.infer<typeof gaugeColorsSchema>;

export const gaugeSettingsSchema = z.object({
  redlineRpm: z.number().min(5000).max(11000).default(8000),
  shiftLightRpm: z.number().min(4000).max(10500).default(7500),
  maxRpm: z.number().min(8000).max(12000).default(9000),
  speedUnit: z.enum(["mph", "kmh"]).default("mph"),
  tempUnit: z.enum(["celsius", "fahrenheit"]).default("fahrenheit"),
  mapUnit: z.enum(["kpa", "psi", "inhg", "bar"]).default("kpa"),
  fuelTankCapacity: z.number().min(5).max(100).default(13.2),
  coolantWarningTemp: z.number().min(80).max(130).default(104),
  lowFuelWarning: z.number().min(5).max(30).default(15),
  afrTargetLow: z.number().min(10).max(14).default(12.5),
  afrTargetHigh: z.number().min(14).max(18).default(14.7),
  mapWarningHigh: z.number().min(100).max(300).default(200),
  brightness: z.number().min(20).max(100).default(100),
  themePreset: z.enum(themePresetValues).default("green"),
  gaugeColors: gaugeColorsSchema.default({}),
});

export type GaugeSettings = z.infer<typeof gaugeSettingsSchema>;

export const tripDataSchema = z.object({
  odometer: z.number().min(0).default(0),
  tripA: z.number().min(0).default(0),
  tripB: z.number().min(0).default(0),
  lastSpeed: z.number().min(0).default(0),
  lastUpdateTime: z.number().default(Date.now),
});

export type TripData = z.infer<typeof tripDataSchema>;

export const bluetoothConnectionStateSchema = z.enum(['idle', 'scanning', 'connecting', 'connected', 'error']);
export type BluetoothConnectionState = z.infer<typeof bluetoothConnectionStateSchema>;

export const discoveredServiceSchema = z.object({
  uuid: z.string(),
  characteristics: z.array(z.object({
    uuid: z.string(),
    canWrite: z.boolean(),
    canNotify: z.boolean(),
  })),
});

export type DiscoveredService = z.infer<typeof discoveredServiceSchema>;

export const bluetoothStatusSchema = z.object({
  connectionState: bluetoothConnectionStateSchema.default('idle'),
  connected: z.boolean().default(false),
  deviceName: z.string().optional(),
  deviceId: z.string().optional(),
  signalStrength: z.number().min(0).max(100).optional(),
  lastDataReceived: z.number().optional(),
  error: z.string().optional(),
  isSupported: z.boolean().default(true),
  discoveredServices: z.array(discoveredServiceSchema).optional(),
});

export type BluetoothStatus = z.infer<typeof bluetoothStatusSchema>;

export const warningStateSchema = z.object({
  checkEngine: z.boolean().default(false),
  lowFuel: z.boolean().default(false),
  highTemp: z.boolean().default(false),
  lowOilPressure: z.boolean().default(false),
  abs: z.boolean().default(false),
  srs: z.boolean().default(false),
  maintenance: z.boolean().default(false),
});

export type WarningState = z.infer<typeof warningStateSchema>;

export const defaultTelemetry: TelemetryData = {
  rpm: 0,
  speed: 0,
  coolantTemp: 70,
  fuelLevel: 75,
  afr: 14.7,
  map: 101,
  throttlePosition: 0,
  checkEngine: false,
  vtec: false,
  oilPressure: undefined,
  oilTemp: undefined,
  batteryVoltage: undefined,
  iat: undefined,
  gear: undefined,
  vtcDegree: undefined,
  timingAdvance: undefined,
  injectorPulseWidth: undefined,
  injectorDutyCycle: undefined,
  stft: undefined,
  ltft: undefined,
  knockCount: undefined,
  dtcCodes: undefined,
};

export const defaultSettings: GaugeSettings = {
  redlineRpm: 8000,
  shiftLightRpm: 7500,
  maxRpm: 9000,
  speedUnit: "mph",
  tempUnit: "fahrenheit",
  mapUnit: "kpa",
  fuelTankCapacity: 13.2,
  coolantWarningTemp: 104,
  lowFuelWarning: 15,
  afrTargetLow: 12.5,
  afrTargetHigh: 14.7,
  mapWarningHigh: 200,
  brightness: 100,
  themePreset: "green",
  gaugeColors: {
    tachometer: "green",
    speedometer: "green",
    coolant: "green",
    fuel: "green",
    afr: "green",
    map: "green",
    trip: "green",
  },
};

export const defaultTripData: TripData = {
  odometer: 0,
  tripA: 0,
  tripB: 0,
  lastSpeed: 0,
  lastUpdateTime: Date.now(),
};

export const defaultLayout: LayoutConfig = {
  id: "default",
  name: "S2000 Classic",
  gauges: [
    { id: "coolantTemp", x: 16, y: 8, width: 160, height: 100, visible: true, scale: 100 },
    { id: "tachometer", x: 192, y: 8, width: 520, height: 100, visible: true, scale: 100 },
    { id: "speedometer", x: 728, y: 8, width: 200, height: 100, visible: true, scale: 100 },
    { id: "fuelLevel", x: 728, y: 120, width: 160, height: 100, visible: true, scale: 100 },
    { id: "afr", x: 16, y: 130, width: 160, height: 100, visible: true, scale: 100 },
    { id: "map", x: 192, y: 130, width: 160, height: 100, visible: true, scale: 100 },
    { id: "tripMeter", x: 368, y: 130, width: 320, height: 80, visible: true, scale: 100 },
  ],
};

export const portraitLayout: LayoutConfig = {
  id: "portrait",
  name: "Portrait Mode",
  gauges: [
    { id: "tachometer", x: 8, y: 8, width: 380, height: 120, visible: true, scale: 100 },
    { id: "speedometer", x: 8, y: 140, width: 180, height: 100, visible: true, scale: 100 },
    { id: "coolantTemp", x: 200, y: 140, width: 180, height: 100, visible: true, scale: 100 },
    { id: "fuelLevel", x: 8, y: 250, width: 180, height: 100, visible: true, scale: 100 },
    { id: "afr", x: 200, y: 250, width: 180, height: 100, visible: true, scale: 100 },
    { id: "map", x: 8, y: 360, width: 180, height: 100, visible: true, scale: 100 },
    { id: "tripMeter", x: 200, y: 360, width: 180, height: 80, visible: true, scale: 100 },
  ],
};

export const users = {} as any;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
