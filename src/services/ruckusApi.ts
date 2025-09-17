import { apiFetch } from '../lib/apiClient';
import { RuckusConfig, RuckusDevice, Venue, LLDPLink, RuckusRegion, RFNeighbor } from '../types';

const TOKEN_COOKIE_PREFIX = 'r1tk_';

// Default to North America if no region specified
const DEFAULT_REGION: RuckusRegion = 'na';

function cookieKey(config: RuckusConfig): string {
  const region = config.region || DEFAULT_REGION;
  return `${TOKEN_COOKIE_PREFIX}${encodeURIComponent(config.tenantId)}_${encodeURIComponent(config.clientId)}_${region}`;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; Path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function requestToken(
  path: string,
  body: URLSearchParams,
  headers: Record<string, string>,
  region: RuckusRegion
): Promise<{ access_token: string; expires_in?: number }> {
  const res = await apiFetch(region, path, {
    method: 'POST',
    headers,
    body,
  });
  
  // Some deployments return the token in a header (login-token) with empty body
  const headerToken = res.headers.get('login-token') || res.headers.get('Login-Token');
  if (res.ok) {
    if (headerToken) {
      return { access_token: headerToken };
    }
    try {
      return await res.json();
    } catch {
      // Try to get response as text for debugging
      const responseText = await res.text();
      console.error('JSON parse error: Response:', responseText.substring(0, 200));
      throw new Error(`${res.status} ${res.statusText} (invalid JSON response)`);
    }
  }
  
  // Handle error responses
  let detail = '';
  try { 
    const errorResponse = await res.json();
    detail = JSON.stringify(errorResponse);
  } catch {
    // If JSON parsing fails, try to get as text
    try {
      const errorText = await res.text();
      detail = errorText.substring(0, 200); // Limit length for error message
    } catch {
      detail = 'Unable to parse error response';
    }
  }
  
  // Simplify authentication error messages
  if (res.status === 500 && detail.includes('maximum redirect reached')) {
    throw new Error('Authentication failed - please check your credentials');
  }
  
  throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
}

export async function getAccessToken(config: RuckusConfig): Promise<string> {
  const key = cookieKey(config);
  const fromCookie = getCookie(key);
  if (fromCookie) {
    return fromCookie;
  }

  const region = config.region || DEFAULT_REGION;

  // Use the tenant-scoped endpoint as the single source of truth
  const attempts: Array<() => Promise<{ access_token: string; expires_in?: number }>> = [
    // Preferred: client_id/client_secret in x-www-form-urlencoded body (per Postman flow)
    () => requestToken(
      `/oauth2/token/${encodeURIComponent(config.tenantId)}`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      region
    ),
    // Fallback: Basic auth to the same tenant-scoped path (some deployments allow this)
    () => requestToken(
      `/oauth2/token/${encodeURIComponent(config.tenantId)}`,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${config.clientId}:${config.clientSecret}`),
      },
      region
    ),
    // Alternative: Standard OAuth2 endpoint without tenant in path
    () => requestToken(
      `/oauth2/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      region
    ),
  ];

  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const data = await attempt();
      const token = data.access_token;
      const expiresIn = Math.max(60, Number(data.expires_in) || 3600);
      
      setCookie(key, token, expiresIn - 30);
      return token;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  
  // Simplify token request error messages
  if (lastErr instanceof Error) {
    if (lastErr.message.includes('maximum redirect reached')) {
      throw new Error('Authentication failed - please check your credentials');
    }
    if (lastErr.message.includes('500')) {
      throw new Error('Authentication failed - please check your credentials');
    }
    throw new Error(`Authentication failed: ${lastErr.message}`);
  }
  throw new Error('Authentication failed - unknown error');
}

export async function apiGet(config: RuckusConfig, resourcePath: string): Promise<unknown> {
  const token = await getAccessToken(config);
  const region = config.region || DEFAULT_REGION;
  
  const res = await apiFetch(region, resourcePath, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
  });
  
  if (!res.ok) {
    let detail = '';
    try { 
      detail = JSON.stringify(await res.json());
    } catch {
      // Ignore JSON parsing errors for error details
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  
  return await res.json();
}

export async function apiPost(config: RuckusConfig, resourcePath: string, body?: any): Promise<unknown> {
  const token = await getAccessToken(config);
  const region = config.region || DEFAULT_REGION;
  
  const res = await apiFetch(region, resourcePath, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    let detail = '';
    try { 
      detail = JSON.stringify(await res.json());
    } catch {
      // Ignore JSON parsing errors for error details
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  
  return await res.json();
}

export async function apiPatch(config: RuckusConfig, resourcePath: string, body?: any): Promise<unknown> {
  const token = await getAccessToken(config);
  const region = config.region || DEFAULT_REGION;
  
  const res = await apiFetch(region, resourcePath, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    let detail = '';
    try { 
      detail = JSON.stringify(await res.json());
    } catch {
      // Ignore JSON parsing errors for error details
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  
  return await res.json();
}

// Legacy class-based API service for backward compatibility
export class RuckusApiService {
  private config: RuckusConfig;
  private rfNeighborsCache: Map<string, any[]> = new Map();

  constructor(config: RuckusConfig) {
    this.config = config;
  }

  async authenticate(): Promise<void> {
    // This is now handled by getAccessToken
    await getAccessToken(this.config);
  }

  async getVenues(): Promise<Venue[]> {
    try {
      const data = await apiGet(this.config, '/venues') as any[];
      
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((venue: any) => ({
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
      const apsData = await apiGet(this.config, '/venues/aps') as any[];
      let aps = Array.isArray(apsData) ? apsData : [];
      
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
      const switchesData = await apiGet(this.config, '/switches') as any[];
      let switches = Array.isArray(switchesData) ? switchesData : [];
      
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
      // First trigger the RF scan
      await apiPatch(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors`, { status: "CURRENT", type: "RF_NEIGHBOR" });

      // Wait a moment for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then query the results
      const data = await apiPost(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors/query`, { page: 1, pageSize: 100, filters: [{ type: "RF_NEIGHBOR" }] }) as any[];

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
      const data = await apiGet(this.config, `/switches/${switchId}/ports`) as any[];
      
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
      await apiPatch(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors`, { status: "CURRENT", type: "RF_NEIGHBOR" });
    } catch (error) {
      console.error('RuckusApiService: Failed to trigger RF scan:', error);
      throw new Error('Failed to trigger RF scan');
    }
  }

  async queryAPRFNeighbors(serialNumber: string, venueId?: string): Promise<RFNeighbor[]> {
    if (!venueId) return [];

    try {
      const data = await apiPost(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors/query`, { page: 1, pageSize: 100, filters: [{ type: "RF_NEIGHBOR" }] }) as any[];

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

  async getAPNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    try {
      // Try to trigger LLDP neighbor collection first
      try {
        await apiPatch(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors`, {
          status: "CURRENT",
          type: "LLDP_NEIGHBOR"
        });
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
      
      const data = await apiPost(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors/query`, requestBody) as any[];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('RuckusApiService: Failed to get AP LLDP neighbors:', error);
      return [];
    }
  }

  async getSwitchPorts(venueId: string): Promise<any[]> {
    try {
      const requestBody = {
        page: 1,
        pageSize: 1000
      };
      
      const response = await apiPost(this.config, '/venues/switches/switchPorts/query', requestBody);
      return Array.isArray(response) ? response : [];
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
          console.error('RuckusApiService: Failed to fetch LLDP links:', error);
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