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

  async getDevices(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const devices: RuckusDevice[] = [];
      
      // Get APs for the venue
      if (venueId) {
        try {
          // Use the correct endpoint: GET /venues/aps (like r1helper)
          const apsData = await apiGet(this.config, '/venues/aps') as any[];
          if (Array.isArray(apsData)) {
            // Filter APs by venue (like r1helper does)
            const venueAps = apsData.filter((ap: any) => 
              ap.venueId === venueId || ap.venue === venueId
            );
            
            devices.push(...venueAps.map((ap: any) => ({
              id: ap.macAddress || ap.serialNumber || ap.id || '',
              name: ap.name || ap.model || 'Unknown AP',
              type: 'ap' as const,
              status: (() => {
                const status = ap.status || '';
                console.log('AP status mapping:', { name: ap.name, originalStatus: status });
                if (status.includes('2_00_Operational') || status === 'online') return 'online';
                if (status.includes('needs_attention') || status === 'offline') return 'offline';
                return 'unknown';
              })(),
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
        } catch (error) {
          console.warn('Failed to fetch APs for venue:', error);
        }
      }

      // Get switches
      try {
        const switchesData = await apiGet(this.config, '/switches') as any[];
        if (Array.isArray(switchesData)) {
          devices.push(...switchesData.map((switchDevice: any) => ({
            id: switchDevice.macAddress || switchDevice.serialNumber || switchDevice.id || '',
            name: switchDevice.name || switchDevice.model || 'Unknown Switch',
            type: 'switch' as const,
            status: (() => {
              const status = switchDevice.status || '';
              console.log('Switch status mapping:', { name: switchDevice.name, originalStatus: status });
              if (status.includes('2_00_Operational') || status === 'online') return 'online';
              if (status.includes('needs_attention') || status === 'offline') return 'offline';
              return 'unknown';
            })(),
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
      } catch (error) {
        console.warn('Failed to fetch switches:', error);
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
}

export default RuckusApiService;