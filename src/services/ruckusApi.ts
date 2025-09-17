import { apiFetch } from '../lib/apiClient';
import { RuckusCredentials, RuckusRegion } from '../lib/ruckusApi';
import { RuckusDevice, Venue, LLDPLink, RFNeighbor } from '../types';

type R1Type = 'regular' | 'msp';

const TOKEN_COOKIE_PREFIX = 'r1tk_';
const DEFAULT_REGION: RuckusRegion = 'na';

function cookieKey(creds: RuckusCredentials): string {
  const region = creds.region || DEFAULT_REGION;
  return `${TOKEN_COOKIE_PREFIX}${encodeURIComponent(creds.tenantId)}_${encodeURIComponent(creds.clientId)}_${region}`;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; Path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\\/+^])/g, '\\$1') + '=([^;]*)'));
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
  
  const headerToken = res.headers.get('login-token') || res.headers.get('Login-Token');
  if (res.ok) {
    if (headerToken) {
      return { access_token: headerToken };
    }
    try {
      return await res.json();
    } catch {
      const responseText = await res.text();
      console.error('JSON parse error: Response:', responseText.substring(0, 200));
      throw new Error(`${res.status} ${res.statusText} (invalid JSON response)`); 
    }
  }
  
  let detail = '';
  try { 
    const errorResponse = await res.json();
    detail = JSON.stringify(errorResponse);
  } catch {
    try {
      const errorText = await res.text();
      detail = errorText.substring(0, 200);
    } catch {
      detail = 'Unable to parse error response';
    }
  }
  
  if (res.status === 500 && detail.includes('maximum redirect reached')) {
    throw new Error('Authentication failed - please check your credentials');
  }
  
  throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
}

export async function getAccessToken(creds: RuckusCredentials): Promise<string> {
  const key = cookieKey(creds);
  const fromCookie = getCookie(key);
  if (fromCookie) {
    return fromCookie;
  }

  const region = creds.region || DEFAULT_REGION;

  const attempts: Array<() => Promise<{ access_token: string; expires_in?: number }>> = [
    () => requestToken(
      `/oauth2/token/${encodeURIComponent(creds.tenantId)}`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      region
    ),
    () => requestToken(
      `/oauth2/token/${encodeURIComponent(creds.tenantId)}`,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${creds.clientId}:${creds.clientSecret}`),
      },
      region
    ),
    () => requestToken(
      `/oauth2/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      region
    ),
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const data = await attempt();
      const token = data.access_token;
      const expiresIn = Math.max(60, Number(data.expires_in) || 3600);
      
      setCookie(key, token, expiresIn - 30);
      return token;
    } catch (e) {
      lastErr = e;
    }
  }
  
  if (lastErr instanceof Error) {
    if (lastErr.message.includes('maximum redirect reached') || lastErr.message.includes('500')) {
      throw new Error('Authentication failed - please check your credentials');
    }
    throw new Error(`Authentication failed: ${lastErr.message}`);
  }
  throw new Error('Authentication failed - unknown error');
}

async function apiGet(
  r1Type: R1Type,
  creds: RuckusCredentials,
  resourcePath: string
): Promise<unknown> {
  const token = await getAccessToken(creds);
  const region = creds.region || DEFAULT_REGION;
  
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
      // Ignore
    }
    throw new Error(`API request failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  
  return await res.json();
}

export class RuckusApiService {
  private config: RuckusCredentials;

  constructor(config: RuckusCredentials) {
    this.config = config;
  }

  async getVenues(): Promise<Venue[]> {
    try {
      const response = await apiGet('regular', this.config, '/venues') as any[];
      
      if (!Array.isArray(response)) {
        return [];
      }

      return response.map((venue: any) => ({
        id: venue.id || venue.venueId || '',
        name: venue.name || 'Unnamed Venue',
        address: (() => {
          if (!venue.address) return '';
          if (typeof venue.address === 'string') return venue.address;
          if (typeof venue.address === 'object') {
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
      const response = await apiGet('regular', this.config, '/venues/aps') as any[];
      
      let aps = Array.isArray(response) ? response : [];
      
      if (venueId) {
        aps = aps.filter((ap: any) => ap.venueId === venueId || ap.venue === venueId);
      }
      
      return aps.map((ap: any) => ({
        id: (ap.macAddress || ap.mac || ap.id || ap.serialNumber)?.toLowerCase() || '',
        name: ap.name || ap.hostname || 'Unknown AP',
        type: 'ap' as const,
        model: ap.model || ap.productModel || 'Unknown',
        serialNumber: ap.serialNumber || 'Unknown',
        macAddress: (ap.macAddress || ap.mac || 'Unknown')?.toLowerCase() || '',
        ipAddress: ap.ipAddress || ap.ip || 'Unknown',
        status: this.mapDeviceStatus(ap.status || ap.connectionStatus),
        location: ap.location ? {
          latitude: parseFloat(ap.location.latitude) || 0,
          longitude: parseFloat(ap.location.longitude) || 0,
        } : null,
        lastSeen: ap.lastSeen || new Date().toISOString(),
        firmwareVersion: ap.firmwareVersion,
        uptime: ap.uptime,
        venueId: venueId,
      }));
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch devices:', error);
      return [];
    }
  }

  async getNetworkTopology(venueId?: string): Promise<{ devices: RuckusDevice[]; links: LLDPLink[] }> {
    try {
      const devices = await this.getDevices(venueId);
      return { devices, links: [] };
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch network topology:', error);
      throw new Error('Failed to fetch network topology from Ruckus One API');
    }
  }

  async triggerAPRFScan(): Promise<void> {
    // Placeholder
  }

  async queryAPRFNeighbors(): Promise<RFNeighbor[]> {
    return [];
  }

  private mapDeviceStatus(status: any): 'online' | 'offline' | 'unknown' {
    if (!status) return 'unknown';
    
    if (typeof status === 'boolean') {
      return status ? 'online' : 'offline';
    }
    
    if (typeof status === 'string') {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus.includes('online') || lowerStatus.includes('operational') || lowerStatus.includes('up') || lowerStatus.includes('active')) {
        return 'online';
      }
      if (lowerStatus.includes('offline') || lowerStatus.includes('down') || lowerStatus.includes('inactive')) {
        return 'offline';
      }
    }
    
    return 'unknown';
  }
}

export default RuckusApiService;
