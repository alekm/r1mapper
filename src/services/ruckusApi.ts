import axios, { AxiosInstance } from 'axios';
import { RuckusConfig, RuckusDevice, Venue, LLDPLink, RuckusRegion } from '../types';

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
    // Use direct API URLs in production
    const apiUrls = {
      na: 'https://api.ruckus.cloud',
      eu: 'https://api.eu.ruckus.cloud',
      asia: 'https://api.asia.ruckus.cloud'
    };
    return apiUrls[safeRegion];
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.api.interceptors.request.use(async (config) => {
      await this.authenticate();
      return config;
    });
  }

  private async authenticate(): Promise<void> {
    try {
      const baseUrl = getApiBaseUrl(this.config.region);
      
      const attempts = [
        // Method 1: Tenant-scoped endpoint with form-urlencoded
        async () => {
          const url = `${baseUrl}/oauth2/token/${this.config.tenantId}`;
          const data = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret
          });
          return await axios.post(url, data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
        },
        // Method 2: Basic auth to tenant-scoped endpoint
        async () => {
          const url = `${baseUrl}/oauth2/token/${this.config.tenantId}`;
          const auth = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
          return await axios.post(url, new URLSearchParams({ grant_type: 'client_credentials' }), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${auth}`
            }
          });
        },
        // Method 3: Standard OAuth2 endpoint
        async () => {
          const url = `${baseUrl}/oauth2/token`;
          const auth = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
          return await axios.post(url, new URLSearchParams({ grant_type: 'client_credentials' }), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${auth}`
            }
          });
        }
      ];

      for (let i = 0; i < attempts.length; i++) {
        try {
          const response = await attempts[i]();
          const token = response.data.access_token;
          this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          return;
        } catch (error) {
          if (i === attempts.length - 1) {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('RuckusApiService: Authentication failed:', error);
      throw new Error('Failed to authenticate with Ruckus One API');
    }
  }

  async getVenues(): Promise<Venue[]> {
    try {
      const response = await this.api.get('/venues');
      let venues = response.data.items || response.data || [];
      
      if (!Array.isArray(venues)) {
        venues = [];
      }

      const mappedVenues = venues.map((venue: any) => {
        return {
          id: venue.id,
          name: venue.name,
          address: venue.address?.addressLine || venue.address,
          location: venue.address ? {
            latitude: venue.address.latitude,
            longitude: venue.address.longitude
          } : undefined
        };
      });

      return mappedVenues;
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch venues:', error);
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch venues: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
      throw new Error('Failed to fetch venues from Ruckus One API');
    }
  }

  async getAPs(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const response = await this.api.get('/venues/aps');
      let aps = response.data.items || response.data || [];
      
      if (venueId) {
        aps = aps.filter((ap: any) => ap.venueId === venueId || ap.venue === venueId);
      }
      
      return aps.map((ap: any) => {
        const rawStatus = ap.status || ap.connectionStatus || ap.state || ap.connectionState || ap.isOnline || ap.online || ap.connected || ap.active;
        
        return {
          id: (ap.macAddress || ap.mac || ap.id || ap.serialNumber)?.toLowerCase(),
          name: ap.name || ap.hostname || 'Unknown AP',
          type: 'ap' as const,
          model: ap.model || ap.productModel || 'Unknown',
          serialNumber: ap.serialNumber || 'Unknown',
          macAddress: (ap.macAddress || ap.mac || 'Unknown')?.toLowerCase(),
          ipAddress: ap.ipAddress || ap.ip || 'Unknown',
          status: this.mapDeviceStatus(rawStatus),
          location: ap.location ? {
            latitude: ap.location.latitude,
            longitude: ap.location.longitude,
            address: ap.location.address
          } : undefined,
          lastSeen: ap.lastContacted || ap.lastSeen,
          firmware: ap.firmware,
          clientCount: ap.clientCount || 0,
          venueId: ap.venueId || ap.venue || venueId
        };
      }) || [];
    } catch (error) {
      console.error('Failed to fetch APs:', error);
      throw new Error('Failed to fetch APs from Ruckus One API');
    }
  }

  async getSwitches(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const endpoint = venueId ? `/venues/${venueId}/switches` : '/switches';
      const response = await this.api.get(endpoint);
      
      let switches = response.data.items || response.data || [];
      
      return switches.map((switch_: any) => {
        const rawStatus = switch_.status || switch_.connectionStatus || switch_.state || switch_.connectionState || switch_.isOnline || switch_.online || switch_.connected || switch_.active;
        const finalStatus = rawStatus || (switch_.ipAddress ? 'online' : 'unknown');
        
        return {
          id: (switch_.macAddress || switch_.mac || switch_.id || switch_.serialNumber || 'unknown')?.toLowerCase(),
          name: switch_.name || switch_.hostname || 'Unknown Switch',
          type: 'switch' as const,
          model: switch_.model || switch_.productModel || 'Unknown',
          serialNumber: switch_.serialNumber || switch_.id || switch_.macAddress || 'unknown',
          macAddress: (switch_.macAddress || switch_.mac || 'Unknown')?.toLowerCase(),
          ipAddress: switch_.ipAddress || switch_.ip || 'Unknown',
          status: this.mapDeviceStatus(finalStatus),
          location: switch_.location ? {
            latitude: switch_.location.latitude,
            longitude: switch_.location.longitude,
            address: switch_.location.address
          } : undefined,
          lastSeen: switch_.lastSeen || switch_.lastUpdate || new Date().toISOString(),
          firmwareVersion: switch_.firmwareVersion || switch_.version,
          uptime: switch_.uptime,
          venueId: switch_.venueId || switch_.venue || venueId
        };
      }) || [];
    } catch (error) {
      console.error('Failed to fetch switches:', error);
      throw new Error('Failed to fetch switches from Ruckus One API');
    }
  }

  async getDevices(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const allDevices: RuckusDevice[] = [];
      
      try {
        const switches = await this.getSwitches(venueId);
        allDevices.push(...switches);
      } catch (error) {
        // Continue if switches fail
      }
      
      try {
        const aps = await this.getAPs(venueId);
        allDevices.push(...aps);
      } catch (error) {
        // Continue if APs fail
      }

      return allDevices;
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      throw new Error('Failed to fetch devices from Ruckus One API');
    }
  }

  async triggerAPRFScan(venueId: string, serialNumber: string): Promise<void> {
    try {
      const patchBody = {
        status: "CURRENT",
        type: "RF_NEIGHBOR"
      };
      
      await this.api.patch(`/venues/${venueId}/aps/${serialNumber}/neighbors`, patchBody);
    } catch (error) {
      console.error('Failed to trigger RF scan:', error.response?.data?.message || error.message);
      throw error;
    }
  }

  async queryAPRFNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      const queryBody = {
        page: 1,
        pageSize: 100,
        filters: [
          {
            type: "RF_NEIGHBOR"
          }
        ]
      };
      
      const queryResponse = await this.api.post(`/venues/${venueId}/aps/${serialNumber}/neighbors/query`, queryBody);
      const rawNeighbors = queryResponse.data?.neighbors || queryResponse.data?.items || [];
      
      // Map the API response to our expected format
      const neighbors = rawNeighbors.map((neighbor: any, index: number) => {
        // Determine the best channel and SNR to display
        let bestChannel = '-';
        let bestSnr = '-';
        let band = '-';
        
        // Prefer 5GHz, then 6GHz, then 2.4GHz
        if (neighbor.channel5G && neighbor.snr5G) {
          bestChannel = neighbor.channel5G;
          bestSnr = neighbor.snr5G;
          band = '5GHz';
        } else if (neighbor.channel6G && neighbor.snr6G) {
          bestChannel = neighbor.channel6G;
          bestSnr = neighbor.snr6G;
          band = '6GHz';
        } else if (neighbor.channel24G && neighbor.snr24G) {
          bestChannel = neighbor.channel24G;
          bestSnr = neighbor.snr24G;
          band = '2.4GHz';
        }
        
        return {
          id: neighbor.apMac || `neighbor-${index}`,
          name: neighbor.deviceName || 'Unknown',
          macAddress: neighbor.apMac,
          channel: bestChannel,
          rssi: bestSnr,
          signalStrength: bestSnr,
          band: band,
          model: neighbor.model,
          ip: neighbor.ip,
          status: neighbor.status,
          detectedTime: neighbor.detectedTime,
          venueName: neighbor.venueName
        };
      });
      
      return neighbors;
    } catch (error) {
      console.error('Failed to query RF neighbors:', error.response?.data?.message || error.message);
      return [];
    }
  }

  async getAPRFNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      const cacheKey = `${venueId}-${serialNumber}`;
      
      if (this.rfNeighborsCache.has(cacheKey)) {
        return this.rfNeighborsCache.get(cacheKey)!;
      }
      
      // Try to trigger collection first
      try {
        const patchBody = {
          status: "CURRENT",
          type: "RF_NEIGHBOR"
        };
        
        await this.api.patch(`/venues/${venueId}/aps/${serialNumber}/neighbors`, patchBody);
        
        // Wait for collection
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Query the results
        const queryBody = {
          page: 1,
          pageSize: 100,
          filters: [
            {
              type: "RF_NEIGHBOR"
            }
          ]
        };
        
        const queryResponse = await this.api.post(`/venues/${venueId}/aps/${serialNumber}/neighbors/query`, queryBody);
        const neighbors = queryResponse.data?.neighbors || queryResponse.data?.items || [];
        
        this.rfNeighborsCache.set(cacheKey, neighbors);
        return neighbors;
        
      } catch (error) {
        // Fallback: try to get neighbors from AP details
        try {
          const apResponse = await this.api.get(`/venues/${venueId}/aps/${serialNumber}`);
          if (apResponse.data.neighbors) {
            const neighbors = Array.isArray(apResponse.data.neighbors) ? apResponse.data.neighbors : [];
            this.rfNeighborsCache.set(cacheKey, neighbors);
            return neighbors;
          }
        } catch (apError) {
          // Ignore fallback errors
        }
      }
      
      const result: any[] = [];
      this.rfNeighborsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Failed to fetch RF neighbors for AP ${serialNumber}:`, error);
      return [];
    }
  }

  async getAPNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      // Try to trigger neighbor collection first
      try {
        const triggerResponse = await this.api.patch(`/venues/${venueId}/aps/${serialNumber}/neighbors`, {
          status: "CURRENT",
          type: "LLDP_NEIGHBOR"
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (triggerError) {
        // Continue if trigger fails
      }
      
      // Query existing neighbor data
      const requestBody = {
        filters: [
          {
            type: "LLDP_NEIGHBOR"
          }
        ],
        page: 1,
        pageSize: 100
      };
      
      let response;
      try {
        response = await this.api.get(`/venues/${venueId}/aps/${serialNumber}/neighbors`);
      } catch (getError) {
        try {
          response = await this.api.get(`/aps/${serialNumber}/neighbors`);
        } catch (getError2) {
          response = await this.api.post(`/venues/${venueId}/aps/${serialNumber}/neighbors/query`, requestBody, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
      }
      
      let neighbors = [];
      if (response.data.neighbors) {
        neighbors = response.data.neighbors;
      } else if (response.data.items) {
        neighbors = response.data.items;
      } else if (Array.isArray(response.data)) {
        neighbors = response.data;
      }
      
      return neighbors;
    } catch (error) {
      console.error(`Failed to fetch neighbors for AP ${serialNumber}:`, error);
      return [];
    }
  }

  async getSwitchNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      // Try to trigger neighbor collection first
      try {
        const triggerResponse = await this.api.patch(`/venues/${venueId}/switches/${serialNumber}/neighbors`, {
          status: "CURRENT",
          type: "LLDP_NEIGHBOR"
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (triggerError) {
        // Continue if trigger fails
      }
      
      // Query existing neighbor data
      const requestBody = {
        filters: [
          {
            type: "LLDP_NEIGHBOR"
          }
        ],
        page: 1,
        pageSize: 100
      };
      
      let response;
      try {
        response = await this.api.get(`/venues/${venueId}/switches/${serialNumber}/neighbors`);
      } catch (getError) {
        try {
          response = await this.api.get(`/switches/${serialNumber}/neighbors`);
        } catch (getError2) {
          response = await this.api.post(`/venues/${venueId}/switches/${serialNumber}/neighbors/query`, requestBody, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
      }
      
      let neighbors = [];
      if (response.data.neighbors) {
        neighbors = response.data.neighbors;
      } else if (response.data.items) {
        neighbors = response.data.items;
      } else if (Array.isArray(response.data)) {
        neighbors = response.data;
      }
      
      return neighbors;
    } catch (error) {
      console.error(`Failed to fetch neighbors for switch ${serialNumber}:`, error);
      return [];
    }
  }

  async getSwitchPorts(venueId: string): Promise<any[]> {
    try {
      const requestBody = {
        page: 1,
        pageSize: 1000
      };
      
      const response = await this.api.post('/venues/switches/switchPorts/query', requestBody);
      return response.data.items || response.data || [];
    } catch (error) {
      console.error('Failed to fetch switch ports:', error);
      return [];
    }
  }

  async getLLDPLinks(venueId?: string): Promise<LLDPLink[]> {
    try {
      const allLinks: LLDPLink[] = [];

      if (venueId) {
        try {
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
          // Fallback: Try AP-based LLDP discovery
          try {
            const aps = await this.getAPs(venueId);
            const apsToCheck = aps.slice(0, 10);
            
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
                } catch (neighborError) {
                  // Continue if neighbor discovery fails for this AP
                }
              }
            }
          } catch (apError) {
            // Continue if AP discovery fails
          }
        }
      }

      return allLinks;
    } catch (error) {
      console.error('Failed to fetch LLDP links:', error);
      return [];
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
      console.error('Failed to fetch network topology:', error);
      throw new Error('Failed to fetch network topology from Ruckus One API');
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