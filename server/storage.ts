import type { 
  GaugeSettings, 
  LayoutConfig, 
  TripData 
} from "@shared/schema";
import { 
  defaultSettings, 
  defaultLayout, 
  defaultTripData 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getSettings(userId: string): Promise<GaugeSettings>;
  saveSettings(userId: string, settings: GaugeSettings): Promise<GaugeSettings>;
  getLayout(userId: string): Promise<LayoutConfig>;
  saveLayout(userId: string, layout: LayoutConfig): Promise<LayoutConfig>;
  getTripData(userId: string): Promise<TripData>;
  saveTripData(userId: string, tripData: TripData): Promise<TripData>;
}

export class MemStorage implements IStorage {
  private settings: Map<string, GaugeSettings>;
  private layouts: Map<string, LayoutConfig>;
  private tripData: Map<string, TripData>;

  constructor() {
    this.settings = new Map();
    this.layouts = new Map();
    this.tripData = new Map();
  }

  async getSettings(userId: string): Promise<GaugeSettings> {
    return this.settings.get(userId) || { ...defaultSettings };
  }

  async saveSettings(userId: string, settings: GaugeSettings): Promise<GaugeSettings> {
    this.settings.set(userId, settings);
    return settings;
  }

  async getLayout(userId: string): Promise<LayoutConfig> {
    return this.layouts.get(userId) || { ...defaultLayout };
  }

  async saveLayout(userId: string, layout: LayoutConfig): Promise<LayoutConfig> {
    this.layouts.set(userId, layout);
    return layout;
  }

  async getTripData(userId: string): Promise<TripData> {
    return this.tripData.get(userId) || { ...defaultTripData };
  }

  async saveTripData(userId: string, tripData: TripData): Promise<TripData> {
    this.tripData.set(userId, tripData);
    return tripData;
  }
}

export const storage = new MemStorage();
