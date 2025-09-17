import { apiFetch } from '../lib/apiClient';
import { RuckusConfig, RuckusDevice, Venue, LLDPLink, RuckusRegion, RFNeighbor } from '../types';

export class RuckusApiService {
  private config: RuckusConfig;
  private accessToken: string | null = null;
  private rfNeighborsCache: Map<string, any[]> = new Map();

  constructor(config: RuckusConfig) {
    this.config = config;
  }

  async authenticate(): Promise<void> {
    const tokenUrl = `/oauth2/token/${this.config.tenantId}`;
    
    const authData = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'read write',
    });

    const response = await apiFetch(this.config.region, tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
      },
      body: authData,
    });

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {
        errorText = 'Unable to parse error response';
      }
      
      // Handle specific authentication errors
      if (response.status === 500 && errorText.includes('maximum redirect reached')) {
        throw new Error('Authentication failed - please check your credentials');
      }
      
      throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
  }

  private async makeApiCall(path: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    return apiFetch(this.config.region, path, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });
  }

  async getVenues(): Promise<Venue[]> {
    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      const response = await this.makeApiCall('/venues');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch venues: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((venue: any) => ({
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
      // Ensure we're authenticated first
      await this.authenticate();
      
      const devices: RuckusDevice[] = [];
      
      // Get APs for the venue
      if (venueId) {
        const apsResponse = await this.makeApiCall(`/venues/${venueId}/aps`);
        if (apsResponse.ok) {
          const apsData = await apsResponse.json();
          if (Array.isArray(apsData)) {
            devices.push(...apsData.map((ap: any) => ({
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
      }

      // Get switches
      const switchesResponse = await this.makeApiCall('/switches');
      if (switchesResponse.ok) {
        const switchesData = await switchesResponse.json();
        if (Array.isArray(switchesData)) {
          devices.push(...switchesData.map((switchDevice: any) => ({
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
      await this.makeApiCall(
        `/venues/${venueId}/aps/${serialNumber}/neighbors`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action: 'scan' }),
        }
      );

      // Wait a moment for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then query the results
      const response = await this.makeApiCall(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'query' }),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const neighbors: RFNeighbor[] = Array.isArray(data) ? data.map((neighbor: any) => ({
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
      const response = await this.makeApiCall(`/switches/${switchId}/ports`);
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        return [];
      }

      const neighbors: any[] = [];
      data.forEach((port: any) => {
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
      await this.makeApiCall(
        `/venues/${venueId}/aps/${serialNumber}/neighbors`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action: 'scan' }),
        }
      );
    } catch (error) {
      console.error('RuckusApiService: Failed to trigger RF scan:', error);
      throw new Error('Failed to trigger RF scan');
    }
  }

  async queryAPRFNeighbors(serialNumber: string, venueId?: string): Promise<RFNeighbor[]> {
    if (!venueId) return [];

    try {
      const response = await this.makeApiCall(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'query' }),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const neighbors: RFNeighbor[] = Array.isArray(data) ? data.map((neighbor: any) => ({
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