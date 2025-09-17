import { RuckusDevice, LLDPLink, Venue } from '../types';

// Demo venues for testing venue selection
export const demoVenues: Venue[] = [
  {
    id: 'venue-001',
    name: 'Main Office',
    address: 'San Francisco, CA',
    location: {
      latitude: 37.7749,
      longitude: -122.4194
    }
  },
  {
    id: 'venue-002', 
    name: 'Branch Office',
    address: 'New York, NY',
    location: {
      latitude: 40.7128,
      longitude: -74.0060
    }
  }
];

// Demo data for testing the application without API access
export const demoDevices: RuckusDevice[] = [
  {
    id: 'ap-001',
    name: 'Main Office AP-01',
    type: 'ap',
    model: 'R770',
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
    model: 'R770',
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
    id: 'ap-003',
    name: 'Lobby AP-03',
    type: 'ap',
    model: 'R670',
    serialNumber: 'SN123456791',
    macAddress: '00:11:22:33:44:57',
    ipAddress: '192.168.1.12',
    status: 'online',
    location: {
      latitude: 37.7748,
      longitude: -122.4193,
      address: 'San Francisco, CA'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '5.1.2.0.1234',
    uptime: 259200, // 3 days
    venueId: 'venue-001'
  },
  {
    id: 'switch-001',
    name: 'Core Switch-01',
    type: 'switch',
    model: 'ICX 8200-24FX',
    serialNumber: 'N/A',
    macAddress: '00:aa:bb:cc:dd:ee',
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
    venueId: 'venue-001'
  },
  {
    id: 'switch-002',
    name: 'Access Switch-02',
    type: 'switch',
    model: 'ICX 8100-24PF-X',
    serialNumber: 'N/A',
    macAddress: '00:aa:bb:cc:dd:ff',
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
    venueId: 'venue-001'
  },
  {
    id: 'router-001',
    name: 'Edge Router-01',
    type: 'router',
    model: 'FastIron SX 1600',
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
    venueId: 'venue-001'
  },
  // Branch Office devices (venue-002) - Smaller, simpler equipment
  {
    id: 'ap-004',
    name: 'Branch Office AP-01',
    type: 'ap',
    model: 'R575',
    serialNumber: 'SN987654321',
    macAddress: '00:11:22:33:44:58',
    ipAddress: '192.168.2.10',
    status: 'online',
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '5.1.1.0.1200',
    uptime: 43200, // 12 hours
    venueId: 'venue-002'
  },
  {
    id: 'ap-005',
    name: 'Branch Office AP-02',
    type: 'ap',
    model: 'R575',
    serialNumber: 'SN987654322',
    macAddress: '00:11:22:33:44:59',
    ipAddress: '192.168.2.11',
    status: 'offline',
    location: {
      latitude: 40.7129,
      longitude: -74.0061,
      address: 'New York, NY'
    },
    lastSeen: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    firmwareVersion: '5.1.1.0.1200',
    uptime: 0,
    venueId: 'venue-002'
  },
  {
    id: 'switch-003',
    name: 'Branch Switch-01',
    type: 'switch',
    model: 'ICX 8100-24PF-X',
    serialNumber: 'N/A',
    macAddress: '00:aa:bb:cc:dd:ff',
    ipAddress: '192.168.2.1',
    status: 'online',
    location: {
      latitude: 40.7129,
      longitude: -74.0061,
      address: 'New York, NY'
    },
    lastSeen: new Date().toISOString(),
    firmwareVersion: '8.0.95a',
    uptime: 129600, // 1.5 days
    venueId: 'venue-002'
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
  },
  // Branch Office links (venue-002)
  {
    id: 'link-006',
    localDeviceId: 'ap-004',
    remoteDeviceId: 'switch-003',
    localPort: 'eth0',
    remotePort: '1/1/1',
    localPortDescription: 'Ethernet Port',
    remotePortDescription: 'GigabitEthernet1/1/1',
    lastUpdated: new Date().toISOString()
  }
];

// Demo API service that returns the demo data
export class DemoApiService {
  async getVenues(): Promise<Venue[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return demoVenues;
  }

  async getDevices(): Promise<RuckusDevice[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return demoDevices;
  }

  async getLLDPLinks(): Promise<LLDPLink[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return demoLinks;
  }

  async getNetworkTopology() {
    const [devices, links] = await Promise.all([
      this.getDevices(),
      this.getLLDPLinks()
    ]);

    return { devices, links };
  }
}
