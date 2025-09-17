import { RuckusDevice, LLDPLink } from '../types';

// Demo data for testing the application without API access
export const demoDevices: RuckusDevice[] = [
  {
    id: 'ap-001',
    name: 'Main Office AP-01',
    type: 'ap',
    model: 'R750',
    serialNumber: 'SN123456789',
    macAddress: '00:11:22:33:44:55',
    ipAddress: '192.168.1.10',
    status: 'online',
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '5.1.2.0.1234',
    uptime: 86400, // 1 day
    venueId: 'venue-001'
  },
  {
    id: 'ap-002',
    name: 'Conference Room AP-02',
    type: 'ap',
    model: 'R750',
    serialNumber: 'SN123456790',
    macAddress: '00:11:22:33:44:56',
    ipAddress: '192.168.1.11',
    status: 'online',
    location: {
      latitude: 37.7750,
      longitude: -122.4195,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '5.1.2.0.1234',
    uptime: 172800, // 2 days
    venueId: 'venue-001'
  },
  {
    id: 'switch-001',
    name: 'Core Switch-01',
    type: 'switch',
    model: 'ICX 7150-C12P',
    serialNumber: 'SN987654321',
    macAddress: '00:AA:BB:CC:DD:EE',
    ipAddress: '192.168.1.1',
    status: 'online',
    location: {
      latitude: 37.7748,
      longitude: -122.4193,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '08.0.95a',
    uptime: 2592000, // 30 days
  },
  {
    id: 'switch-002',
    name: 'Access Switch-02',
    type: 'switch',
    model: 'ICX 7150-C12P',
    serialNumber: 'SN987654322',
    macAddress: '00:AA:BB:CC:DD:FF',
    ipAddress: '192.168.1.2',
    status: 'online',
    location: {
      latitude: 37.7751,
      longitude: -122.4196,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '08.0.95a',
    uptime: 1209600, // 14 days
  },
  {
    id: 'router-001',
    name: 'Edge Router-01',
    type: 'router',
    model: 'Ruckus FastIron',
    serialNumber: 'SN555666777',
    macAddress: '00:FF:EE:DD:CC:BB',
    ipAddress: '192.168.1.254',
    status: 'online',
    location: {
      latitude: 37.7747,
      longitude: -122.4192,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '08.0.95a',
    uptime: 4320000, // 50 days
  },
  {
    id: 'ap-003',
    name: 'Lobby AP-03',
    type: 'ap',
    model: 'R650',
    serialNumber: 'SN123456791',
    macAddress: '00:11:22:33:44:57',
    ipAddress: '192.168.1.12',
    status: 'offline',
    location: {
      latitude: 37.7752,
      longitude: -122.4197,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    firmwareVersion: '5.1.1.0.1200',
    uptime: 0,
    venueId: 'venue-001'
  }
];

export const demoLinks: LLDPLink[] = [
  {
    id: 'link-001',
    localDeviceId: 'ap-001',
    remoteDeviceId: 'switch-001',
    localPort: 'eth0',
    remotePort: '1/1/1',
    localPortDescription: 'Ethernet Port',
    remotePortDescription: 'GigabitEthernet1/1/1',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'link-002',
    localDeviceId: 'ap-002',
    remoteDeviceId: 'switch-001',
    localPort: 'eth0',
    remotePort: '1/1/2',
    localPortDescription: 'Ethernet Port',
    remotePortDescription: 'GigabitEthernet1/1/2',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'link-003',
    localDeviceId: 'switch-001',
    remoteDeviceId: 'switch-002',
    localPort: '1/1/10',
    remotePort: '1/1/10',
    localPortDescription: 'GigabitEthernet1/1/10',
    remotePortDescription: 'GigabitEthernet1/1/10',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'link-004',
    localDeviceId: 'switch-001',
    remoteDeviceId: 'router-001',
    localPort: '1/1/12',
    remotePort: 'GigabitEthernet0/0/1',
    localPortDescription: 'GigabitEthernet1/1/12',
    remotePortDescription: 'GigabitEthernet0/0/1',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'link-005',
    localDeviceId: 'ap-003',
    remoteDeviceId: 'switch-002',
    localPort: 'eth0',
    remotePort: '1/1/1',
    localPortDescription: 'Ethernet Port',
    remotePortDescription: 'GigabitEthernet1/1/1',
    lastUpdated: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  }
];

// Demo API service that returns the demo data
export class DemoApiService {
  async getDevices(): Promise<RuckusDevice[]> {
    console.log('DemoApiService: Getting demo devices...');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('DemoApiService: Returning', demoDevices.length, 'devices');
    return demoDevices;
  }

  async getLLDPLinks(): Promise<LLDPLink[]> {
    console.log('DemoApiService: Getting demo links...');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('DemoApiService: Returning', demoLinks.length, 'links');
    return demoLinks;
  }

  async getNetworkTopology() {
    console.log('DemoApiService: Getting network topology...');
    const [devices, links] = await Promise.all([
      this.getDevices(),
      this.getLLDPLinks()
    ]);

    console.log('DemoApiService: Topology complete:', { devices: devices.length, links: links.length });
    return { devices, links };
  }
}
