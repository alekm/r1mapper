export type RuckusRegion = 'na' | 'eu' | 'asia';

export interface RuckusCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  region?: RuckusRegion;
}
