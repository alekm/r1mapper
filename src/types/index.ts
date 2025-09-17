// Ruckus One API Types
export interface RuckusAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface RuckusDevice {
  id: string;
  name: string;
  type: 'switch' | 'ap' | 'router' | 'unknown';
  model: string;
  serialNumber: string;
  macAddress: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'unknown';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  lastSeen: string;
  firmwareVersion?: string;
  uptime?: number;
}

export interface LLDPLink {
  id: string;
  localDeviceId: string;
  remoteDeviceId: string;
  localPort: string;
  remotePort: string;
  localPortDescription?: string;
  remotePortDescription?: string;
  lastUpdated: string;
}

export interface RFNeighbor {
  id: string;
  name: string;
  macAddress: string;
  ssid?: string;
  channel: number;
  frequency: number;
  band: '2.4GHz' | '5GHz' | '6GHz';
  rssi: number;
  signalStrength: number;
  lastSeen: string;
  security?: string;
  vendor?: string;
}

export interface NetworkTopology {
  devices: RuckusDevice[];
  links: LLDPLink[];
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

export interface DeviceFilter {
  type?: RuckusDevice['type'];
  status?: RuckusDevice['status'];
  search?: string;
}

// UI State Types
export interface AppState {
  devices: RuckusDevice[];
  links: LLDPLink[];
  selectedDevice: RuckusDevice | null;
  filter: DeviceFilter;
  loading: boolean;
  error: string | null;
  viewport: MapViewport;
}

// API Configuration
export type RuckusRegion = 'na' | 'eu' | 'asia';

export interface RuckusConfig {
  region: RuckusRegion;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

// Venue types
export interface Venue {
  id: string;
  name: string;
  description?: string;
  address?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}
