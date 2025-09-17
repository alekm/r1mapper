import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Wifi, 
  MapPin, 
  RefreshCw, 
  Settings,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { RuckusDevice, LLDPLink, DeviceFilter, Venue, RFNeighbor } from './types';
import { RuckusCredentials } from './lib/ruckusApi';
import RuckusApiService from './services/ruckusApi';
import { DemoApiService } from './services/demoData';
import ConfigModal from './components/ConfigModal';
import MapView from './components/MapView';
import TopologyViewWrapper from './components/TopologyViewWrapper';
import { clsx } from 'clsx';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [devices, setDevices] = useState<RuckusDevice[]>([]);
  const [links, setLinks] = useState<LLDPLink[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<RuckusDevice | null>(null);
  const [rfNeighbors, setRfNeighbors] = useState<RFNeighbor[]>([]);
  const [filter, setFilter] = useState<DeviceFilter>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
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
        setShowConfig(true);
      }
    } else {
      setShowConfig(true);
    }
  }, []);

  // Auto-load data when API service is ready
  useEffect(() => {
    if (apiService && demoMode) {
      loadNetworkData();
    } else if (apiService && !demoMode) {
      // For real API, load venues but not devices
      loadVenues();
    }
  }, [apiService, demoMode]);

  const loadVenues = async () => {
    if (!apiService || apiService instanceof DemoApiService) return;
    
    try {
      const loadedVenues = await (apiService as RuckusApiService).getVenues();
      setVenues(loadedVenues);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load venues');
    }
  };

  const loadNetworkData = async (venueId?: string) => {
    if (!apiService) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (apiService instanceof RuckusApiService) {
        // For real API, require venue selection to avoid loading all devices
        if (!venueId) {
          setDevices([]);
          setLinks([]);
          setLoading(false);
          return;
        }
        
        const topology = await apiService.getNetworkTopology(venueId);
        setDevices(topology.devices);
        setLinks(topology.links);
      } else {
        // Demo mode - can load without venue
        const topology = await apiService.getNetworkTopology();
        setDevices(topology.devices);
        setLinks(topology.links);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load network data');
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      if (filter.types && filter.types.length > 0 && !filter.types.includes(device.type)) return false;
      if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(device.status)) return false;
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        return (
          device.name.toLowerCase().includes(searchLower) ||
          device.model.toLowerCase().includes(searchLower) ||
          device.serialNumber.toLowerCase().includes(searchLower) ||
          device.ipAddress.toLowerCase().includes(searchLower) ||
          device.macAddress.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [devices, filter.types, filter.statuses, filter.search]);

  const handleConfigSave = (config: RuckusCredentials) => {
    localStorage.setItem('ruckus-config', JSON.stringify(config));
    localStorage.setItem('demo-mode', 'false');
    setDemoMode(false);
    setApiService(new RuckusApiService(config));
    setShowConfig(false);
  };

  const handleDemoMode = () => {
    localStorage.setItem('demo-mode', 'true');
    localStorage.removeItem('ruckus-config'); // Clear any existing config
    setDemoMode(true);
    setApiService(new DemoApiService());
    setShowConfig(false);
  };

  const handleVenueSelect = (venueId: string | null) => {
    setSelectedVenueId(venueId);
    if (venueId) {
      // Defer heavy network call to yield back to the browser
      setTimeout(() => {
        loadNetworkData(venueId);
      }, 0);
      // Navigate to topology view when a venue is selected
      navigate('/topology');
    }
  };

  const handleDeviceSelect = (device: RuckusDevice) => {
    setSelectedDevice(device);
    // Clear RF neighbors when selecting a new device
    setRfNeighbors([]);
  };

  const handleTriggerRFScan = async () => {
    if (selectedDevice && selectedDevice.type === 'ap' && apiService instanceof RuckusApiService && selectedVenueId) {
      try {
        await apiService.triggerAPRFScan(selectedVenueId, selectedDevice.serialNumber);
      } catch (error) {
      }
    }
  };

  const handleLoadRFNeighbors = async () => {
    if (selectedDevice && selectedDevice.type === 'ap' && apiService instanceof RuckusApiService && selectedVenueId) {
      try {
        const neighbors = await apiService.queryAPRFNeighbors(selectedVenueId, selectedDevice.serialNumber);
        setRfNeighbors(neighbors);
      } catch (error) {
        setRfNeighbors([]);
      }
    }
  };

  if (showConfig) {
    return <ConfigModal onSave={handleConfigSave} onDemoMode={handleDemoMode} />;
  }

  return (
    <div className="h-screen flex flex-col app-container">
      {/* Header */}
      <header className="navbar">
        <div className="navbar-container">
          <div className="flex items-center space-x-4">
            <div className="logo">
              <div className="logo-icon">
                <Wifi className="h-6 w-6" />
              </div>
              <div>
                <div className="logo-text">R1Mapper</div>
                <div className="logo-subtitle">Network Topology Visualizer</div>
              </div>
            </div>
            {demoMode && (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                Demo Mode
              </span>
            )}
          </div>
          
          <div className="nav-links">
            <button
              onClick={() => navigate('/map')}
              className={clsx(
                'nav-link',
                location.pathname === '/map' && 'active'
              )}
            >
              <MapPin className="h-4 w-4" />
              <span>Map View</span>
            </button>
            <button
              onClick={() => navigate('/topology')}
              className={clsx(
                'nav-link',
                location.pathname === '/topology' && 'active'
              )}
            >
              <Wifi className="h-4 w-4" />
              <span>Topology</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadNetworkData(selectedVenueId || undefined)}
              disabled={loading || (!demoMode && !selectedVenueId)}
              className="btn btn-primary"
            >
              <RefreshCw className={clsx('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </button>
            
            {!demoMode && (
              <button
                onClick={handleDemoMode}
                className="btn btn-secondary"
              >
                Try Demo Mode
              </button>
            )}
            
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
      <div className="main-container flex-1 flex flex-col relative">
        {error && (
          <div className="bg-red-50 border border-red-200 px-6 py-4">
            <div className="flex items-center space-x-3">
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

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40">
            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
              <div className="text-sm text-gray-600">Loading network data...</div>
            </div>
          </div>
        )}

        <Routes>
          <Route 
            path="/" 
            element={
              <MapView
                venues={venues}
                devices={filteredDevices}
                selectedVenueId={selectedVenueId}
                onVenueSelect={handleVenueSelect}
                demoMode={demoMode}
              />
            } 
          />
          <Route 
            path="/map" 
            element={
              <MapView
                venues={venues}
                devices={filteredDevices}
                selectedVenueId={selectedVenueId}
                onVenueSelect={handleVenueSelect}
                demoMode={demoMode}
              />
            } 
          />
          <Route 
            path="/topology" 
            element={
              <TopologyViewWrapper
                venues={venues}
                devices={filteredDevices}
                links={links}
                selectedVenueId={selectedVenueId}
                onVenueSelect={handleVenueSelect}
                selectedDevice={selectedDevice}
                rfNeighbors={rfNeighbors}
                onDeviceSelect={handleDeviceSelect}
                onLoadRFNeighbors={handleLoadRFNeighbors}
                onTriggerRFScan={handleTriggerRFScan}
                loading={loading}
                demoMode={demoMode}
                filter={filter}
                onFilterChange={setFilter}
              />
            } 
          />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;