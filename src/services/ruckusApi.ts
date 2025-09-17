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
  _r1Type: R1Type,
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

async function apiSend(
  creds: RuckusCredentials,
  resourcePath: string,
  method: 'POST' | 'PATCH',
  data: unknown
): Promise<Response> {
  const token = await getAccessToken(creds);
  const region = creds.region || DEFAULT_REGION;
  return apiFetch(region, resourcePath, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    body: JSON.stringify(data)
  });
}

async function apiPost(
  creds: RuckusCredentials,
  resourcePath: string,
  data: unknown
): Promise<unknown> {
  const res = await apiSend(creds, resourcePath, 'POST', data);
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch {}
    throw new Error(`API request failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  try { return await res.json(); } catch { return null; }
}

async function apiPatch(
  creds: RuckusCredentials,
  resourcePath: string,
  data: unknown
): Promise<void> {
  const res = await apiSend(creds, resourcePath, 'PATCH', data);
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch {}
    throw new Error(`API request failed: ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
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
        } : undefined,
      }));
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch venues:', error);
      throw new Error('Failed to fetch venues');
    }
  }

  async getAPs(venueId?: string): Promise<RuckusDevice[]> {
    try {
      const response = await apiGet('regular', this.config, '/venues/aps') as any[];
      let aps = Array.isArray(response) ? response : [];
      if (venueId) {
        aps = aps.filter((ap: any) => ap.venueId === venueId || ap.venue === venueId);
      }
      return aps.map((ap: any) => {
        const rawStatus =
          ap.status ??
          ap.connectionStatus ??
          ap.state ??
          ap.connectionState ??
          ap.isOnline ??
          ap.online ??
          ap.connected ??
          ap.active;

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
          } : undefined,
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

  async getSwitches(): Promise<RuckusDevice[]> {
    try {
      const response = await apiGet('regular', this.config, '/switches') as any[];
      const switches = Array.isArray(response) ? response : [];
      // TEMP DEBUG: Inspect raw switch objects (limited sample)
      try {
        const sample = switches.slice(0, 5);
        console.log('RuckusApiService: switches sample count', switches.length);
        sample.forEach((sw, idx) => {
          const keys = Object.keys(sw || {});
          console.log(`RuckusApiService: switch[${idx}] keys`, keys);
          console.log(`RuckusApiService: switch[${idx}] sample`, {
            id: sw?.id,
            name: sw?.name || sw?.hostname,
            macAddress: sw?.macAddress || sw?.mac,
            serialNumber: sw?.serialNumber,
            model: sw?.model,
            ipAddress: sw?.ipAddress || sw?.ip,
            status: sw?.status || sw?.connectionStatus || sw?.state,
          });
        });
      } catch {}
      const base = switches.map((sw: any) => {
        const rawStatus = sw.status || sw.connectionStatus || sw.state || sw.connectionState || sw.isOnline || sw.online || sw.connected || sw.active;
        const finalStatus = rawStatus || (sw.ipAddress ? 'online' : 'unknown');
        const idOrMac = (sw.macAddress || sw.mac || sw.id || 'unknown').toLowerCase();
        return {
          id: idOrMac,
          name: sw.name || sw.hostname || 'Unknown Switch',
          type: 'switch' as const,
          model: sw.model || sw.productModel || sw.specifiedType || 'Unknown',
          serialNumber: sw.serialNumber || 'Unknown',
          macAddress: (sw.macAddress || sw.mac || sw.id || 'Unknown').toLowerCase(),
          ipAddress: sw.ipAddress || sw.ip || 'Unknown',
          status: this.mapDeviceStatus(finalStatus),
          location: sw.location ? {
            latitude: parseFloat(sw.location.latitude) || 0,
            longitude: parseFloat(sw.location.longitude) || 0,
          } : undefined,
          lastSeen: sw.lastSeen || new Date().toISOString(),
          firmwareVersion: sw.firmwareVersion,
          uptime: sw.uptime,
        };
      });

      // Enrich with per-switch details to discover proper model fields, but cap for performance
      const MAX_DETAIL = 10;
      const detailTargets = base.slice(0, MAX_DETAIL).map(s => s.id);
      const enriched = await Promise.all(
        detailTargets.map(async (id) => {
          try {
            const detail = await apiGet('regular', this.config, `/switches/${encodeURIComponent(id)}`) as any;
            // Debug keys to learn fields
            try {
              console.log('RuckusApiService: switch detail keys for', id, Object.keys(detail || {}));
            } catch {}
            return { id, detail };
          } catch (e) {
            return { id, detail: null };
          }
        })
      );

      const idToDetail: Record<string, any> = {};
      for (const d of enriched) {
        if (d && d.detail) idToDetail[d.id] = d.detail;
      }

      return base.map(sw => {
        const detail = idToDetail[sw.id];
        if (!detail) return sw;
        const model = detail.model || detail.productModel || detail.specifiedType || sw.model;
        const serial = detail.serialNumber || sw.serialNumber;
        return { ...sw, model, serialNumber: serial };
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
        this.getSwitches()
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
      const deviceIdSet = new Set(devices.map(d => d.id));
      const filteredLinks = links.filter(l => deviceIdSet.has(l.localDeviceId) && deviceIdSet.has(l.remoteDeviceId));
      return { devices, links: filteredLinks };
    } catch (error) {
      console.error('RuckusApiService: Failed to fetch network topology:', error);
      throw new Error('Failed to fetch network topology from Ruckus One API');
    }
  }

  async triggerAPRFScan(venueId: string, serialNumber: string): Promise<void> {
    await apiPatch(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors`, { status: 'CURRENT', type: 'RF_NEIGHBOR' });
  }

  async queryAPRFNeighbors(venueId: string, serialNumber: string): Promise<RFNeighbor[]> {
    const res = await apiPost(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors/query`, { page: 1, pageSize: 100, filters: [{ type: 'RF_NEIGHBOR' }] });
    const arr = Array.isArray(res) ? res : [];
    const now = new Date().toISOString();
    return arr.map((n: any, idx: number) => ({
      id: n.id || `${serialNumber}-rf-${idx}`,
      name: n.name || n.ssid || 'Unknown',
      macAddress: n.macAddress || '',
      ssid: n.ssid,
      channel: n.channel || 0,
      frequency: n.frequency || 0,
      band: n.band || (n.frequency >= 5900 ? '5GHz' : '2.4GHz'),
      rssi: n.rssi || 0,
      signalStrength: typeof n.rssi === 'number' ? n.rssi : 0,
      lastSeen: n.lastSeen || now,
      security: n.security,
      vendor: n.vendor,
    }));
  }

  private async getSwitchPorts(venueId: string): Promise<any[]> {
    const res = await apiPost(this.config, '/venues/switches/switchPorts/query', { page: 1, pageSize: 1000 });
    return Array.isArray(res) ? res : [];
  }

  private async getAPNeighbors(venueId: string, serialNumber: string): Promise<any[]> {
    // Trigger LLDP neighbor collection on the AP
    try {
      await apiPatch(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors`, {
        status: 'CURRENT',
        type: 'LLDP_NEIGHBOR'
      });
    } catch (e) {
      // Non-fatal: continue to query existing cache if trigger fails
      console.warn(`RuckusApiService: LLDP trigger PATCH failed for AP ${serialNumber}`, e);
    }

    // Poll for results for a short period (AP may need time to populate)
    const queryBody = { page: 1, pageSize: 100, filters: [{ type: 'LLDP_NEIGHBOR' }] };
    const maxAttempts = 6; // ~6-9 seconds total depending on backoff
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await apiPost(this.config, `/venues/${venueId}/aps/${serialNumber}/neighbors/query`, queryBody);
        const arr = Array.isArray(res) ? res : [];
        if (arr.length > 0) {
          return arr;
        }
      } catch (qErr) {
        // Log and continue retrying
        console.warn(`RuckusApiService: LLDP neighbors query failed (attempt ${attempt + 1}/${maxAttempts}) for AP ${serialNumber}`, qErr);
        const msg = qErr instanceof Error ? qErr.message : String(qErr);
        // If Ruckus API explicitly reports no neighbor data, stop retrying for this AP
        if (msg.includes('WIFI-10498') || msg.toLowerCase().includes('no detected neighbor data') || msg.startsWith('API request failed: 400')) {
          return [];
        }
      }
      // Backoff between attempts
      await new Promise(r => setTimeout(r, 1000 + attempt * 500));
    }
    return [];
  }

  async getLLDPLinks(venueId?: string): Promise<LLDPLink[]> {
    try {
      const allLinks: LLDPLink[] = [];
      if (!venueId) return allLinks;
      // Helper to normalize MAC strings for matching
      const normalizeMac = (mac?: string): string | undefined => {
        if (!mac || typeof mac !== 'string') return undefined;
        return mac.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
      };
      // Budgets to avoid long operations on large sites
      const MAX_APS_TO_CHECK = 20;
      const MAX_LINKS_TO_COLLECT = 200;
      const MAX_TOTAL_MS = 8000;
      const startMs = Date.now();

      try {
        const switchPorts = await this.getSwitchPorts(venueId);

        if (Array.isArray(switchPorts) && switchPorts.length > 0) {
          for (const port of switchPorts) {
            const neighborName = port.neighborName || port.systemName || port.remoteSystemName || port.lldpNeighborName;
            const neighborMacRaw = port.neighborMacAddress || port.neighborMac || port.chassisId || port.remoteChassisId || port.lldpNeighborMac;
            const neighborPort = port.remotePortId || port.portId || port.neighborPortMacAddress || port.neighborPortMac;

            const localDeviceMacNorm = normalizeMac(port.switchMac || port.portMac || port.deviceMac);
            const remoteDeviceMacNorm = normalizeMac(neighborMacRaw);

            if (neighborName && localDeviceMacNorm && remoteDeviceMacNorm) {
              const link: LLDPLink = {
                id: `${localDeviceMacNorm}-${port.portIdentifier || port.portId || 'p'}-${remoteDeviceMacNorm}`,
                localDeviceId: localDeviceMacNorm,
                remoteDeviceId: remoteDeviceMacNorm,
                localPort: port.portIdentifier || port.portId || 'Unknown',
                remotePort: neighborPort || 'Unknown',
                localPortDescription: port.name || port.tags || 'Switch Port',
                remotePortDescription: neighborName || 'Unknown Device',
                lastUpdated: new Date().toISOString(),
              };
              allLinks.push(link);
            }
            if (allLinks.length >= MAX_LINKS_TO_COLLECT || Date.now() - startMs > MAX_TOTAL_MS) {
              break;
            }
          }
        } else {
          // No switch-port data returned, fall back to AP-based LLDP discovery
          console.info('RuckusApiService: No switch-port data; attempting AP-based LLDP discovery');
          const aps = await this.getAPs(venueId);
          const apsToCheck = aps.filter(a => a.serialNumber && a.serialNumber !== 'Unknown').slice(0, MAX_APS_TO_CHECK);
          for (const ap of apsToCheck) {
            const neighbors = await this.getAPNeighbors(venueId, ap.serialNumber);
            for (const neighbor of neighbors) {
              const neighMacNorm = normalizeMac(neighbor.neighborMacAddress);
              const apMacNorm = normalizeMac(ap.macAddress);
              if (neighMacNorm && apMacNorm && neighbor.neighborName) {
                const link: LLDPLink = {
                  id: `${apMacNorm}-${neighMacNorm}`,
                  localDeviceId: apMacNorm,
                  remoteDeviceId: neighMacNorm,
                  localPort: 'Wireless',
                  remotePort: neighbor.neighborPort || 'Unknown',
                  localPortDescription: 'AP Wireless Interface',
                  remotePortDescription: neighbor.neighborName || 'Unknown Device',
                  lastUpdated: new Date().toISOString(),
                };
                allLinks.push(link);
              }
              if (allLinks.length >= MAX_LINKS_TO_COLLECT || Date.now() - startMs > MAX_TOTAL_MS) {
                break;
              }
            }
            if (allLinks.length >= MAX_LINKS_TO_COLLECT || Date.now() - startMs > MAX_TOTAL_MS) {
              break;
            }
          }
        }
      } catch (e) {
        // If switch-port query hard-failed, also try AP-based LLDP discovery
        console.warn('RuckusApiService: Switch-port LLDP query failed; falling back to AP-based LLDP discovery', e);
        const aps = await this.getAPs(venueId);
        const apsToCheck = aps.filter(a => a.serialNumber && a.serialNumber !== 'Unknown').slice(0, MAX_APS_TO_CHECK);
        for (const ap of apsToCheck) {
          const neighbors = await this.getAPNeighbors(venueId, ap.serialNumber);
          for (const neighbor of neighbors) {
            const neighMacNorm = normalizeMac(neighbor.neighborMacAddress);
            const apMacNorm = normalizeMac(ap.macAddress);
            if (neighMacNorm && apMacNorm && neighbor.neighborName) {
              const link: LLDPLink = {
                id: `${apMacNorm}-${neighMacNorm}`,
                localDeviceId: apMacNorm,
                remoteDeviceId: neighMacNorm,
                localPort: 'Wireless',
                remotePort: neighbor.neighborPort || 'Unknown',
                localPortDescription: 'AP Wireless Interface',
                remotePortDescription: neighbor.neighborName || 'Unknown Device',
                lastUpdated: new Date().toISOString(),
              };
              allLinks.push(link);
            }
            if (allLinks.length >= MAX_LINKS_TO_COLLECT || Date.now() - startMs > MAX_TOTAL_MS) {
              break;
            }
          }
          if (allLinks.length >= MAX_LINKS_TO_COLLECT || Date.now() - startMs > MAX_TOTAL_MS) {
            break;
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
    
    if (typeof status === 'string') {
      const lowerStatus = status.toLowerCase();
      // Treat "Operational" as online (device reachable)
      if (
        lowerStatus.includes('online') ||
        lowerStatus.includes('operational') ||
        lowerStatus.includes('up') ||
        lowerStatus.includes('active')
      ) {
        return 'online';
      }
      if (
        lowerStatus.includes('offline') ||
        lowerStatus.includes('down') ||
        lowerStatus.includes('inactive') ||
        lowerStatus.includes('disconnectedfromcloud') ||
        lowerStatus.includes('disconnected_from_cloud') ||
        lowerStatus.includes('requires attention') ||
        lowerStatus.includes('requires_attention') ||
        lowerStatus.includes('requiresattention') ||
        lowerStatus.includes('needs attention') ||
        lowerStatus.includes('needs_attention') ||
        lowerStatus.includes('needsattention')
      ) {
        return 'offline';
      }
    }
    
    return 'unknown';
  }
}

export default RuckusApiService;
