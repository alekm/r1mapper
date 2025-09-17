import axios, { AxiosInstance } from 'axios';
import { RuckusConfig, RuckusDevice, Venue, LLDPLink, RuckusRegion, RFNeighbor } from '../types';

// Determine if we're in development or production
const isDevelopment = import.meta.env.DEV;

// Base URL for API calls
function getApiBaseUrl(region: RuckusRegion): string {
  // Handle legacy region format and convert to new format
  let safeRegion: RuckusRegion;
  if (region === 'api.ruckus.cloud' || region === 'na') {
    safeRegion = 'na';
  } else if (region === 'api.eu.ruckus.cloud' || region === 'eu') {
    safeRegion = 'eu';
  } else if (region === 'api.asia.ruckus.cloud' || region === 'asia') {
    safeRegion = 'asia';
  } else {
    safeRegion = 'na'; // Default fallback
  }
  
  if (isDevelopment) {
    // Use Vite proxy in development
    const proxyPaths = {
      na: '/r1',
      eu: '/r1-eu',
      asia: '/r1-asia'
    };
    return proxyPaths[safeRegion];
  } else {
    // Use Netlify functions proxy in production
    return '/api';
  }
}

export class RuckusApiService {
  private api: AxiosInstance;
  private config: RuckusConfig;
  private rfNeighborsCache: Map<string, any[]> = new Map();

  constructor(config: RuckusConfig) {
    this.config = config;
    const baseUrl = getApiBaseUrl(config.region);
    
    this.api = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
    });
  }

  async authenticate(): Promise<void> {
    const tokenUrl = `/oauth2/token/${this.config.tenantId}`;
    
    const authData = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'read write',
    });

    const response = await this.api.post(tokenUrl, authData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
      },
    });

    // Store the token for future requests
    this.api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
  }

  async getVenues(): Promise<Venue[]> {
    try {
      const response = await this.api.get('/venues', {
        params: { region: this.config.region }
      });
      
      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((venue: any) => ({
        id: venue.id || venue.venueId || '',
        name: venue.name || 'Unnamed Venue',
        address: venue.address || '',
        location: venue.location ? {
          latitude: parseFloat(venue.location.latitude) || 0,
          longitude: parseFloat(venue.location.longitude) || 0,
        } : null,
      }));
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch venues:', error);
      throw new Error('Failed to fetch venues');
    }
  }

  async getDevices(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const devices: RuckusDevice[] = [];
      
      // Get APs for the venue
      if (venueId) {
        const apsResponse = await this.api.get(`/venues/${venueId}/aps`, {
          params: { region: this.config.region }
        });
        if (Array.isArray(apsResponse.data)) {
          devices.push(...apsResponse.data.map((ap: any) => ({
            id: ap.macAddress || ap.serialNumber || ap.id || '',
            name: ap.name || ap.model || 'Unknown AP',
            type: 'ap' as const,
            status: ap.status || 'unknown',
            model: ap.model || 'Unknown',
            serialNumber: ap.serialNumber || '',
            macAddress: ap.macAddress || '',
            ipAddress: ap.ipAddress || '',
            location: ap.location ? {
              latitude: parseFloat(ap.location.latitude) || 0,
              longitude: parseFloat(ap.location.longitude) || 0,
            } : null,
          })));
        }
      }

      // Get switches
      const switchesResponse = await this.api.get('/switches', {
        params: { region: this.config.region }
      });
      if (Array.isArray(switchesResponse.data)) {
        devices.push(...switchesResponse.data.map((switchDevice: any) => ({
          id: switchDevice.macAddress || switchDevice.serialNumber || switchDevice.id || '',
          name: switchDevice.name || switchDevice.model || 'Unknown Switch',
          type: 'switch' as const,
          status: switchDevice.status || 'unknown',
          model: switchDevice.model || 'Unknown',
          serialNumber: switchDevice.serialNumber || '',
          macAddress: switchDevice.macAddress || '',
          ipAddress: switchDevice.ipAddress || '',
          location: switchDevice.location ? {
            latitude: parseFloat(switchDevice.location.latitude) || 0,
            longitude: parseFloat(switchDevice.location.longitude) || 0,
          } : null,
        })));
      }

      return devices;
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch devices:', error);
      throw new Error('Failed to fetch devices');
    }
  }

  async getNetworkTopology(venueId?: string): Promise<{ devices: RuckusDevice[]; links: LLDPLink[] }> {
    const devices = await this.getDevices(venueId);
    const links: LLDPLink[] = [];

    // Get LLDP neighbors for each device
    for (const device of devices) {
      try {
        if (device.type === 'ap') {
          // For APs, get RF neighbors
          const rfNeighbors = await this.getAPRFNeighbors(device.serialNumber, venueId);
          rfNeighbors.forEach(neighbor => {
            const targetDevice = devices.find(d => d.macAddress === neighbor.macAddress);
            if (targetDevice) {
              links.push({
                id: `${device.id}-${targetDevice.id}`,
                source: device.id,
                target: targetDevice.id,
                sourcePort: 'RF',
                targetPort: 'RF',
                type: 'rf',
              });
            }
          });
        } else if (device.type === 'switch') {
          // For switches, get LLDP neighbors
          const lldpNeighbors = await this.getSwitchNeighbors(device.id);
          lldpNeighbors.forEach(neighbor => {
            const targetDevice = devices.find(d => d.macAddress === neighbor.macAddress);
            if (targetDevice) {
              links.push({
                id: `${device.id}-${targetDevice.id}`,
                source: device.id,
                target: targetDevice.id,
                sourcePort: neighbor.localPort || 'Unknown',
                targetPort: neighbor.remotePort || 'Unknown',
                type: 'lldp',
              });
            }
          });
        }
      } catch (error) {
        // Continue with other devices if one fails
        console.warn(`Failed to get neighbors for device ${device.id}:`, error);
      }
    }

    return { devices, links };
  }

  async getAPRFNeighbors(serialNumber: string, venueId?: string): Promise<RFNeighbor[]> {
    if (!venueId) return [];

    const cacheKey = `${venueId}-${serialNumber}`;
    if (this.rfNeighborsCache.has(cacheKey)) {
      return this.rfNeighborsCache.get(cacheKey)!;
    }

    try {
      // First trigger the RF scan
      await this.api.patch(
        `/venues/${venueId}/aps/${serialNumber}/neighbors`,
        { action: 'scan' },
        { params: { region: this.config.region } }
      );

      // Wait a moment for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then query the results
      const response = await this.api.post(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        { action: 'query' },
        { params: { region: this.config.region } }
      );

      const neighbors: RFNeighbor[] = Array.isArray(response.data) ? response.data.map((neighbor: any) => ({
        macAddress: neighbor.macAddress || '',
        rssi: neighbor.rssi || 0,
        channel: neighbor.channel || 0,
        frequency: neighbor.frequency || 0,
      })) : [];

      this.rfNeighborsCache.set(cacheKey, neighbors);
      return neighbors;
    } catch (error) {
      console.error('RuckusApiService: Failed to get RF neighbors:', error);
      return [];
    }
  }

  async getSwitchNeighbors(switchId: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/switches/${switchId}/ports`, {
        params: { region: this.config.region }
      });
      
      if (!Array.isArray(response.data)) {
        return [];
      }

      const neighbors: any[] = [];
      response.data.forEach((port: any) => {
        if (port.lldpNeighbor) {
          neighbors.push({
            localPort: port.portName || port.portId,
            remotePort: port.lldpNeighbor.portId || 'Unknown',
            macAddress: port.lldpNeighbor.macAddress || '',
            systemName: port.lldpNeighbor.systemName || '',
          });
        }
      });

      return neighbors;
    } catch (error) {
      console.error('RuckusApiService: Failed to get switch neighbors:', error);
      return [];
    }
  }

  async triggerAPRFScan(serialNumber: string, venueId?: string): Promise<void> {
    if (!venueId) return;

    try {
      await this.api.patch(
        `/venues/${venueId}/aps/${serialNumber}/neighbors`,
        { action: 'scan' },
        { params: { region: this.config.region } }
      );
    } catch (error) {
      console.error('RuckusApiService: Failed to trigger RF scan:', error);
      throw new Error('Failed to trigger RF scan');
    }
  }

  async queryAPRFNeighbors(serialNumber: string, venueId?: string): Promise<RFNeighbor[]> {
    if (!venueId) return [];

    try {
      const response = await this.api.post(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        { action: 'query' },
        { params: { region: this.config.region } }
      );

      const neighbors: RFNeighbor[] = Array.isArray(response.data) ? response.data.map((neighbor: any) => ({
        macAddress: neighbor.macAddress || '',
        rssi: neighbor.rssi || 0,
        channel: neighbor.channel || 0,
        frequency: neighbor.frequency || 0,
      })) : [];

      return neighbors;
    } catch (error) {
      console.error('RuckusApiService: Failed to query RF neighbors:', error);
      return [];
    }
  }
}

export default RuckusApiService;