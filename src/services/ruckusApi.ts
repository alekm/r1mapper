import axios, { AxiosInstance } from 'axios';
import { 
  RuckusAuthResponse, 
  RuckusDevice, 
  LLDPLink, 
  NetworkTopology,
  RuckusConfig 
} from '../types';

class RuckusApiService {
  private api: AxiosInstance;
  private config: RuckusConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: RuckusConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: `https://${config.region}.ruckus.cloud`,
      timeout: 30000,
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<RuckusAuthResponse>(
        `https://${this.config.region}.ruckus.cloud/oauth2/token/${this.config.tenantId}`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: this.config.scope,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Ruckus One API');
    }
  }

  async getVenues(): Promise<any[]> {
    try {
      const response = await this.api.get('/venues');
      return response.data.items || [];
    } catch (error) {
      console.error('Failed to fetch venues:', error);
      throw new Error('Failed to fetch venues from Ruckus One API');
    }
  }

  async getAPs(venueId: string): Promise<RuckusDevice[]> {
    try {
      const response = await this.api.get(`/venues/${venueId}/aps`);
      
      return response.data.items?.map((ap: any) => ({
        id: ap.id || ap.serialNumber,
        name: ap.name || ap.hostname || 'Unknown AP',
        type: 'ap' as const,
        model: ap.model || ap.productModel || 'Unknown',
        serialNumber: ap.serialNumber || 'Unknown',
        macAddress: ap.macAddress || ap.mac || 'Unknown',
        ipAddress: ap.ipAddress || ap.ip || 'Unknown',
        status: this.mapDeviceStatus(ap.status || ap.connectionStatus),
        location: ap.location ? {
          latitude: ap.location.latitude,
          longitude: ap.location.longitude,
          address: ap.location.address
        } : undefined,
        lastSeen: ap.lastSeen || ap.lastUpdate || new Date().toISOString(),
        firmwareVersion: ap.firmwareVersion || ap.version,
        uptime: ap.uptime,
        venueId: venueId
      })) || [];
    } catch (error) {
      console.error('Failed to fetch APs:', error);
      throw new Error('Failed to fetch APs from Ruckus One API');
    }
  }

  async getSwitches(): Promise<RuckusDevice[]> {
    try {
      const response = await this.api.get('/switches');
      
      return response.data.items?.map((switch_: any) => ({
        id: switch_.id || switch_.serialNumber,
        name: switch_.name || switch_.hostname || 'Unknown Switch',
        type: 'switch' as const,
        model: switch_.model || switch_.productModel || 'Unknown',
        serialNumber: switch_.serialNumber || 'Unknown',
        macAddress: switch_.macAddress || switch_.mac || 'Unknown',
        ipAddress: switch_.ipAddress || switch_.ip || 'Unknown',
        status: this.mapDeviceStatus(switch_.status || switch_.connectionStatus),
        location: switch_.location ? {
          latitude: switch_.location.latitude,
          longitude: switch_.location.longitude,
          address: switch_.location.address
        } : undefined,
        lastSeen: switch_.lastSeen || switch_.lastUpdate || new Date().toISOString(),
        firmwareVersion: switch_.firmwareVersion || switch_.version,
        uptime: switch_.uptime
      })) || [];
    } catch (error) {
      console.error('Failed to fetch switches:', error);
      throw new Error('Failed to fetch switches from Ruckus One API');
    }
  }

  async getDevices(): Promise<RuckusDevice[]> {
    try {
      const [venues, switches] = await Promise.all([
        this.getVenues(),
        this.getSwitches()
      ]);

      const allDevices: RuckusDevice[] = [...switches];

      // Get APs for each venue
      for (const venue of venues) {
        try {
          const aps = await this.getAPs(venue.id);
          allDevices.push(...aps);
        } catch (error) {
          console.warn(`Failed to fetch APs for venue ${venue.id}:`, error);
        }
      }

      return allDevices;
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      throw new Error('Failed to fetch devices from Ruckus One API');
    }
  }

  async getAPNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      // First trigger neighbor collection
      await this.api.patch(`/venues/${venueId}/aps/${serialNumber}/neighbors`);
      
      // Then query the neighbors
      const response = await this.api.post(`/venues/${venueId}/aps/${serialNumber}/neighbors/query`);
      return response.data.items || [];
    } catch (error) {
      console.error(`Failed to fetch neighbors for AP ${serialNumber}:`, error);
      return [];
    }
  }

  async getLLDPLinks(): Promise<LLDPLink[]> {
    try {
      const venues = await this.getVenues();
      const allLinks: LLDPLink[] = [];

      for (const venue of venues) {
        try {
          const aps = await this.getAPs(venue.id);
          
          for (const ap of aps) {
            const neighbors = await this.getAPNeighbors(venue.id, ap.serialNumber);
            
            for (const neighbor of neighbors) {
              if (neighbor.type === 'LLDP_NEIGHBOR' && neighbor.lldpNeighbor) {
                const lldp = neighbor.lldpNeighbor;
                allLinks.push({
                  id: `${ap.id}-${lldp.lldpChassisID || neighbor.neighborSerialNumber}`,
                  localDeviceId: ap.id,
                  remoteDeviceId: lldp.lldpChassisID || neighbor.neighborSerialNumber,
                  localPort: lldp.lldpPortID || 'Unknown',
                  remotePort: lldp.lldpInterface || 'Unknown',
                  localPortDescription: lldp.lldpPortDesc,
                  remotePortDescription: lldp.lldpSysDesc,
                  lastUpdated: lldp.lldpTime || new Date().toISOString()
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch LLDP links for venue ${venue.id}:`, error);
        }
      }

      return allLinks;
    } catch (error) {
      console.error('Failed to fetch LLDP links:', error);
      throw new Error('Failed to fetch LLDP links from Ruckus One API');
    }
  }

  async getNetworkTopology(): Promise<NetworkTopology> {
    try {
      const [devices, links] = await Promise.all([
        this.getDevices(),
        this.getLLDPLinks()
      ]);

      return { devices, links };
    } catch (error) {
      console.error('Failed to fetch network topology:', error);
      throw new Error('Failed to fetch network topology from Ruckus One API');
    }
  }

  private mapDeviceType(apiType: string): RuckusDevice['type'] {
    const typeMap: Record<string, RuckusDevice['type']> = {
      'switch': 'switch',
      'access_point': 'ap',
      'ap': 'ap',
      'router': 'router',
      'gateway': 'router',
    };
    
    return typeMap[apiType?.toLowerCase()] || 'unknown';
  }

  private mapDeviceStatus(apiStatus: string): RuckusDevice['status'] {
    const statusMap: Record<string, RuckusDevice['status']> = {
      'online': 'online',
      'connected': 'online',
      'active': 'online',
      'offline': 'offline',
      'disconnected': 'offline',
      'inactive': 'offline',
    };
    
    return statusMap[apiStatus?.toLowerCase()] || 'unknown';
  }
}

export default RuckusApiService;
