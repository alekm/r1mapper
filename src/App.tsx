import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { 
  Wifi, 
  Router, 
  Server, 
  MapPin, 
  RefreshCw, 
  Search, 
  Filter,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { RuckusDevice, LLDPLink, DeviceFilter, RuckusConfig } from './types';
import RuckusApiService from './services/ruckusApi';
import { DemoApiService } from './services/demoData';
import DeviceDetails from './components/DeviceDetails';
import FilterPanel from './components/FilterPanel';
import ConfigModal from './components/ConfigModal';
import TopologyView from './components/TopologyView';
import { clsx } from 'clsx';

// Custom icons for different device types
const createDeviceIcon = (type: RuckusDevice['type'], status: RuckusDevice['status']) => {
  const color = status === 'online' ? '#10b981' : status === 'offline' ? '#ef4444' : '#6b7280';
  
  let iconSvg = '';
  switch (type) {
    case 'ap':
      iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      </svg>`;
      break;
    case 'switch':
      iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="${color}" stroke-width="2"/>
        <path d="M9 9H15V15H9V9Z" fill="${color}"/>
        <path d="M3 9H6" stroke="${color}" stroke-width="2"/>
        <path d="M18 9H21" stroke="${color}" stroke-width="2"/>
        <path d="M3 15H6" stroke="${color}" stroke-width="2"/>
        <path d="M18 15H21" stroke="${color}" stroke-width="2"/>
      </svg>`;
      break;
    case 'router':
      iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="${color}" stroke-width="2"/>
        <path d="M6 8H18" stroke="${color}" stroke-width="2"/>
        <path d="M6 12H18" stroke="${color}" stroke-width="2"/>
        <path d="M6 16H14" stroke="${color}" stroke-width="2"/>
      </svg>`;
      break;
    default:
      iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2"/>
        <path d="M12 6V12L16 14" stroke="${color}" stroke-width="2"/>
      </svg>`;
  }

  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(iconSvg)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

function App() {
  const [devices, setDevices] = useState<RuckusDevice[]>([]);
  const [links, setLinks] = useState<LLDPLink[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RuckusDevice | null>(null);
  const [filter, setFilter] = useState<DeviceFilter>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'topology'>('map');
  const [apiService, setApiService] = useState<RuckusApiService | DemoApiService | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Load configuration from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('ruckus-config');
    const savedDemoMode = localStorage.getItem('demo-mode') === 'true';
    
    if (savedDemoMode) {
      setDemoMode(true);
      setApiService(new DemoApiService());
    } else if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setApiService(new RuckusApiService(config));
      } catch (error) {
        console.error('Failed to load saved configuration:', error);
        setShowConfig(true);
      }
    } else {
      setShowConfig(true);
    }
  }, []);

  const loadNetworkData = async () => {
    if (!apiService) return;

    setLoading(true);
    setError(null);

    try {
      const topology = await apiService.getNetworkTopology();
      setDevices(topology.devices);
      setLinks(topology.links);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load network data');
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = devices.filter(device => {
    if (filter.type && device.type !== filter.type) return false;
    if (filter.status && device.status !== filter.status) return false;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      return (
        device.name.toLowerCase().includes(searchLower) ||
        device.model.toLowerCase().includes(searchLower) ||
        device.ipAddress.toLowerCase().includes(searchLower) ||
        device.macAddress.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const handleConfigSave = (config: RuckusConfig) => {
    localStorage.setItem('ruckus-config', JSON.stringify(config));
    localStorage.setItem('demo-mode', 'false');
    setDemoMode(false);
    setApiService(new RuckusApiService(config));
    setShowConfig(false);
  };

  const handleDemoMode = () => {
    localStorage.setItem('demo-mode', 'true');
    setDemoMode(true);
    setApiService(new DemoApiService());
    setShowConfig(false);
  };

  if (showConfig) {
    return <ConfigModal onSave={handleConfigSave} onDemoMode={handleDemoMode} />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Wifi className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">r1mapper</h1>
            </div>
            <div className="text-sm text-gray-500">
              Network Topology Visualizer
              {demoMode && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  Demo Mode
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('map')}
                className={clsx(
                  'btn btn-secondary',
                  viewMode === 'map' && 'bg-primary-100 text-primary-700'
                )}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Map View
              </button>
              <button
                onClick={() => setViewMode('topology')}
                className={clsx(
                  'btn btn-secondary',
                  viewMode === 'topology' && 'bg-primary-100 text-primary-700'
                )}
              >
                <Router className="h-4 w-4 mr-2" />
                Topology
              </button>
            </div>
            
            <button
              onClick={loadNetworkData}
              disabled={loading}
              className="btn btn-primary"
            >
              <RefreshCw className={clsx('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </button>
            
            <button
              onClick={() => setShowConfig(true)}
              className="btn btn-secondary"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 bg-white shadow-sm border-r border-gray-200 flex flex-col">
          <FilterPanel
            filter={filter}
            onFilterChange={setFilter}
            deviceCount={filteredDevices.length}
            totalDevices={devices.length}
          />
          
          {selectedDevice && (
            <div className="flex-1 overflow-y-auto">
              <DeviceDetails device={selectedDevice} />
            </div>
          )}
        </div>

        {/* Main View */}
        <div className="flex-1 relative">
          {error && (
            <div className="absolute top-4 left-4 right-4 z-50">
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="text-sm text-red-700">{error}</div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40">
              <div className="text-center">
                <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
                <div className="text-gray-600">Loading network data...</div>
              </div>
            </div>
          )}

          {viewMode === 'map' ? (
            <MapContainer
              center={[37.7749, -122.4194]} // Default to San Francisco
              zoom={13}
              className="h-full w-full"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {filteredDevices.map((device) => {
                if (!device.location) return null;
                
                return (
                  <Marker
                    key={device.id}
                    position={[device.location.latitude, device.location.longitude]}
                    icon={createDeviceIcon(device.type, device.status)}
                    eventHandlers={{
                      click: () => setSelectedDevice(device),
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold text-gray-900">{device.name}</h3>
                        <p className="text-sm text-gray-600">{device.model}</p>
                        <p className="text-sm text-gray-600">{device.ipAddress}</p>
                        <div className="flex items-center mt-2">
                          {device.status === 'online' ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                          )}
                          <span className="text-sm capitalize">{device.status}</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <TopologyView
              devices={filteredDevices}
              links={links}
              selectedDevice={selectedDevice}
              onDeviceSelect={setSelectedDevice}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
