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
      params: { region: this.config.region }
    });

    // Store the token for future requests
    this.api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
  }

  async getVenues(): Promise<Venue[]> {
    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      const response = await this.api.get('/venues', {
        params: { region: this.config.region }
      });
      
      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((venue: any) => ({
        id: venue.id || venue.venueId || '',
        name: venue.name || 'Unnamed Venue',
        address: (() => {
          if (!venue.address) return '';
          if (typeof venue.address === 'string') return venue.address;
          if (typeof venue.address === 'object') {
            // Convert address object to string
            const addr = venue.address;
            return addr.addressLine || addr.city || addr.country || '';
          }
          return '';
        })(),
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

  async getAPs(venueId?: string): Promise<RuckusDevice[]> {
    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      const response = await this.api.get('/venues/aps', {
        params: { region: this.config.region }
      });
      
      let aps = Array.isArray(response.data) ? response.data : [];
      
      if (venueId) {
        aps = aps.filter((ap: any) => ap.venueId === venueId || ap.venue === venueId);
      }
      
      return aps.map((ap: any) => {
        const rawStatus = ap.status || ap.connectionStatus || ap.state || ap.connectionState || ap.isOnline || ap.online || ap.connected || ap.active;
        
        return {
          id: (ap.macAddress || ap.mac || ap.id || ap.serialNumber)?.toLowerCase() || '',
          name: ap.name || ap.hostname || 'Unknown AP',
          type: 'ap' as const,
          model: ap.model || ap.productModel || 'Unknown',
          serialNumber: ap.serialNumber || 'Unknown',
          macAddress: (ap.macAddress || ap.mac || 'Unknown')?.toLowerCase() || '',
          ipAddress: ap.ipAddress || ap.ip || 'Unknown',
          status: this.mapDeviceStatus(rawStatus),
          location: ap.location ? {
            latitude: parseFloat(ap.location.latitude) || 0,
            longitude: parseFloat(ap.location.longitude) || 0,
          } : null,
          lastSeen: ap.lastSeen || new Date().toISOString(),
          firmwareVersion: ap.firmwareVersion,
          uptime: ap.uptime,
          venueId: venueId,
        };
      });
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch APs:', error);
      return [];
    }
  }

  async getSwitches(venueId?: string): Promise<RuckusDevice[]> {
    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      const response = await this.api.get('/switches', {
        params: { region: this.config.region }
      });
      
      let switches = Array.isArray(response.data) ? response.data : [];
      
      return switches.map((switch_: any) => {
        const rawStatus = switch_.status || switch_.connectionStatus || switch_.state || switch_.connectionState || switch_.isOnline || switch_.online || switch_.connected || switch_.active;
        const finalStatus = rawStatus || (switch_.ipAddress ? 'online' : 'unknown');
        
        return {
          id: (switch_.macAddress || switch_.mac || switch_.id || switch_.serialNumber || 'unknown')?.toLowerCase() || '',
          name: switch_.name || switch_.hostname || 'Unknown Switch',
          type: 'switch' as const,
          model: switch_.model || switch_.productModel || 'Unknown',
          serialNumber: switch_.serialNumber || switch_.id || switch_.macAddress || 'unknown',
          macAddress: (switch_.macAddress || switch_.mac || 'Unknown')?.toLowerCase() || '',
          ipAddress: switch_.ipAddress || switch_.ip || 'Unknown',
          status: this.mapDeviceStatus(finalStatus),
          location: switch_.location ? {
            latitude: parseFloat(switch_.location.latitude) || 0,
            longitude: parseFloat(switch_.location.longitude) || 0,
          } : null,
          lastSeen: switch_.lastSeen || new Date().toISOString(),
          firmwareVersion: switch_.firmwareVersion,
          uptime: switch_.uptime,
        };
      });
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch switches:', error);
      return [];
    }
  }

  async getDevices(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const [aps, switches] = await Promise.all([
        this.getAPs(venueId),
        this.getSwitches(venueId)
      ]);

      return [...aps, ...switches];
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch devices:', error);
      throw new Error('Failed to fetch devices');
    }
  }

  async getNetworkTopology(venueId?: string): Promise<{ devices: RuckusDevice[]; links: LLDPLink[] }> {
    try {
      const [devices, links] = await Promise.all([
        this.getDevices(venueId),
        this.getLLDPLinks(venueId)
      ]);

      return { devices, links };
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch network topology:', error);
      throw new Error('Failed to fetch network topology from Ruckus One API');
    }
  }

  async getAPRFNeighbors(serialNumber: string, venueId?: string): Promise<RFNeighbor[]> {
    if (!venueId) return [];

    const cacheKey = `${venueId}-${serialNumber}`;
    if (this.rfNeighborsCache.has(cacheKey)) {
      return this.rfNeighborsCache.get(cacheKey)!;
    }

    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      // First trigger the RF scan
      await this.api.patch(
        `/venues/${venueId}/aps/${serialNumber}/neighbors`,
        { status: "CURRENT", type: "RF_NEIGHBOR" },
        { params: { region: this.config.region } }
      );

      // Wait a moment for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then query the results
      const response = await this.api.post(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        { page: 1, pageSize: 100, filters: [{ type: "RF_NEIGHBOR" }] },
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
      // Ensure we're authenticated first
      await this.authenticate();
      
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
      // Ensure we're authenticated first
      await this.authenticate();
      
      await this.api.patch(
        `/venues/${venueId}/aps/${serialNumber}/neighbors`,
        { status: "CURRENT", type: "RF_NEIGHBOR" },
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
      // Ensure we're authenticated first
      await this.authenticate();
      
      const response = await this.api.post(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        { page: 1, pageSize: 100, filters: [{ type: "RF_NEIGHBOR" }] },
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

  async getAPNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      // Try to trigger LLDP neighbor collection first
      try {
        await this.api.patch(
          `/venues/${venueId}/aps/${serialNumber}/neighbors`,
          { status: "CURRENT", type: "LLDP_NEIGHBOR" },
          { params: { region: this.config.region } }
        );
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (triggerError) {
        // Continue if trigger fails
      }
      
      // Query existing LLDP neighbor data
      const requestBody = {
        page: 1,
        pageSize: 100,
        filters: [{ type: "LLDP_NEIGHBOR" }]
      };
      
      const response = await this.api.post(
        `/venues/${venueId}/aps/${serialNumber}/neighbors/query`,
        requestBody,
        { params: { region: this.config.region } }
      );
      
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('RuckusApiService: Failed to get AP LLDP neighbors:', error);
      return [];
    }
  }

  async getSwitchPorts(venueId: string): Promise<any[]> {
    try {
      // Ensure we're authenticated first
      await this.authenticate();
      
      const requestBody = {
        page: 1,
        pageSize: 1000
      };
      
      const response = await this.api.post(
        '/venues/switches/switchPorts/query',
        requestBody,
        { params: { region: this.config.region } }
      );
      
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch switch ports:', error);
      return [];
    }
  }

  async getLLDPLinks(venueId?: string): Promise<LLDPLink[]> {
    try {
      const allLinks: LLDPLink[] = [];

      if (venueId) {
        try {
          // Try to get switch ports first
          const switchPorts = await this.getSwitchPorts(venueId);
          
          for (const port of switchPorts) {
            const neighborName = port.neighborName || port.systemName || port.remoteSystemName || port.lldpNeighborName;
            const neighborMac = port.neighborMacAddress || port.neighborMac || port.chassisId || port.remoteChassisId || port.lldpNeighborMac;
            const neighborPort = port.remotePortId || port.portId || port.neighborPortMacAddress || port.neighborPortMac;
            
            if (neighborName && neighborMac) {
              const localDeviceMac = (port.switchMac || port.portMac || port.deviceMac)?.toLowerCase();
              const remoteDeviceMac = neighborMac?.toLowerCase();
              
              const link: LLDPLink = {
                id: `${localDeviceMac}-${port.portIdentifier || port.portId}-${remoteDeviceMac}`,
                localDeviceId: localDeviceMac,
                remoteDeviceId: remoteDeviceMac,
                localPort: port.portIdentifier || port.portId || 'Unknown',
                remotePort: neighborPort || 'Unknown',
                localPortDescription: port.name || port.tags || 'Switch Port',
                remotePortDescription: neighborName || 'Unknown Device',
                lastUpdated: new Date().toISOString()
              };
              
              allLinks.push(link);
            }
          }
        } catch (error) {
          console.warn('RuckusApiService: Switch ports query failed, trying AP-based LLDP discovery:', error);
          
          // Fallback: Try AP-based LLDP discovery
          try {
            const aps = await this.getAPs(venueId);
            const apsToCheck = aps.slice(0, 10); // Limit to first 10 APs to avoid too many requests
            
            for (const ap of apsToCheck) {
              if (ap.serialNumber && ap.serialNumber !== 'Unknown') {
                try {
                  const neighbors = await this.getAPNeighbors(venueId, ap.serialNumber);
                  
                  for (const neighbor of neighbors) {
                    if (neighbor.neighborMacAddress && neighbor.neighborName) {
                      const link: LLDPLink = {
                        id: `${ap.macAddress?.toLowerCase()}-${neighbor.neighborMacAddress?.toLowerCase()}`,
                        localDeviceId: ap.macAddress?.toLowerCase(),
                        remoteDeviceId: neighbor.neighborMacAddress?.toLowerCase(),
                        localPort: 'Wireless',
                        remotePort: neighbor.neighborPort || 'Unknown',
                        localPortDescription: 'AP Wireless Interface',
                        remotePortDescription: neighbor.neighborName || 'Unknown Device',
                        lastUpdated: new Date().toISOString()
                      };
                      
                      allLinks.push(link);
                    }
                  }
                } catch (apError) {
                  console.warn(`RuckusApiService: Failed to get neighbors for AP ${ap.serialNumber}:`, apError);
                }
              }
            }
          } catch (fallbackError) {
            console.error('RuckusApiService: AP-based LLDP discovery also failed:', fallbackError);
          }
        }
      }

      return allLinks;
    } catch (error) {
      console.error('RuckusApiService: Failed to get LLDP links:', error);
      return [];
    }
  }

  private mapDeviceStatus(status: any): 'online' | 'offline' | 'unknown' {
    if (!status) return 'unknown';
    
    if (typeof status === 'boolean') {
      return status ? 'online' : 'offline';
    }
    
    if (typeof status === 'number') {
      return status > 0 ? 'online' : 'offline';
    }
    
    if (typeof status === 'string') {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus.includes('online') || lowerStatus.includes('operational') || lowerStatus.includes('up') || lowerStatus.includes('active')) {
        return 'online';
      }
      if (lowerStatus.includes('offline') || lowerStatus.includes('down') || lowerStatus.includes('inactive') || lowerStatus.includes('requiresattention') || lowerStatus.includes('disconnectedfromcloud')) {
        return 'offline';
      }
    }
    
    return 'unknown';
  }
}

export default RuckusApiService;