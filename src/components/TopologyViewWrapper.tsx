import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';
import { Venue, RuckusDevice, LLDPLink, RFNeighbor, DeviceFilter } from '../types';
import TopologyView from './TopologyView';
import VenueSelector from './VenueSelector';

interface TopologyViewWrapperProps {
  venues: Venue[];
  devices: RuckusDevice[];
  links: LLDPLink[];
  selectedVenueId: string | null;
  onVenueSelect: (venueId: string | null) => void;
  selectedDevice: RuckusDevice | null;
  rfNeighbors: RFNeighbor[];
  onDeviceSelect: (device: RuckusDevice) => void;
  onLoadRFNeighbors: () => void;
  onTriggerRFScan: () => void;
  loading: boolean;
  demoMode: boolean;
  filter: DeviceFilter;
  onFilterChange: (filter: DeviceFilter) => void;
}

const TopologyViewWrapper: React.FC<TopologyViewWrapperProps> = ({
  venues,
  devices,
  links,
  selectedVenueId,
  onVenueSelect,
  selectedDevice,
  rfNeighbors,
  onDeviceSelect,
  onLoadRFNeighbors,
  onTriggerRFScan,
  loading,
  demoMode,
  filter,
  onFilterChange
}) => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col">
      {/* Header with back button */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/map')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Map</span>
            </button>
            <div className="h-4 w-px bg-gray-300"></div>
            <h2 className="text-lg font-semibold text-gray-900">Network Topology</h2>
          </div>
        </div>
      </div>

      {/* Venue Selector */}
      {!demoMode && (
        <VenueSelector
          venues={venues}
          selectedVenueId={selectedVenueId}
          onVenueSelect={onVenueSelect}
          loading={loading}
        />
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 bg-white shadow-sm border-r border-gray-200 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {/* Device Details */}
              {selectedDevice ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Device Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {selectedDevice.name}</div>
                    <div><span className="font-medium">Type:</span> {selectedDevice.type.toUpperCase()}</div>
                    <div><span className="font-medium">Model:</span> {selectedDevice.model}</div>
                    <div><span className="font-medium">IP:</span> {selectedDevice.ipAddress}</div>
                    <div><span className="font-medium">MAC:</span> {selectedDevice.macAddress}</div>
                    <div><span className="font-medium">Status:</span> 
                      <span className={`ml-1 px-2 py-1 rounded text-xs ${
                        selectedDevice.status === 'online' ? 'bg-green-100 text-green-800' : 
                        selectedDevice.status === 'offline' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedDevice.status}
                      </span>
                    </div>
                  </div>
                  
    {/* RF Neighbors Controls for APs */}
    {selectedDevice.type === 'ap' && (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">RF Neighbors</h4>
        <div className="space-y-2">
          <button
            onClick={() => {
              onTriggerRFScan();
            }}
            className="w-full px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
          >
            Trigger RF Scan
          </button>
          <button
            onClick={() => {
              onLoadRFNeighbors();
            }}
            className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
          >
            Query RF Neighbors
          </button>
        </div>
      </div>
    )}
                  
                  {/* RF Neighbors Table for APs */}
                  {selectedDevice.type === 'ap' && rfNeighbors.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">RF Neighbors</h4>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1 font-medium text-gray-700">Name</th>
                              <th className="text-left py-1 font-medium text-gray-700">Channel</th>
                              <th className="text-left py-1 font-medium text-gray-700">RSSI</th>
                              <th className="text-left py-1 font-medium text-gray-700">Band</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rfNeighbors.map((neighbor, index) => (
                              <tr key={neighbor.id || index} className="border-b border-gray-100">
                                <td className="py-1 text-gray-600 truncate" title={neighbor.name}>
                                  {neighbor.name || neighbor.ssid || 'Unknown'}
                                </td>
                                <td className="py-1 text-gray-600">{neighbor.channel || '-'}</td>
                                <td className="py-1 text-gray-600">
                                  <span className={`px-1 py-0.5 rounded text-xs ${
                                    neighbor.rssi && neighbor.rssi.includes('dB') ? 
                                      (parseInt(neighbor.rssi) > 30 ? 'bg-green-100 text-green-800' :
                                       parseInt(neighbor.rssi) > 20 ? 'bg-yellow-100 text-yellow-800' :
                                       'bg-red-100 text-red-800') :
                                      'bg-gray-100 text-gray-800'
                                  }`}>
                                    {neighbor.rssi || neighbor.signalStrength || '-'}
                                  </span>
                                </td>
                                <td className="py-1 text-gray-600">{neighbor.band || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* No RF Neighbors message for APs */}
                  {selectedDevice.type === 'ap' && rfNeighbors.length === 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">RF Neighbors</h4>
                      <p className="text-xs text-gray-500">Click "Load RF Neighbors" to discover nearby wireless networks</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Device Types</h3>
                  <div className="space-y-2 text-xs mb-4">
                    <button
                      className={`flex items-center justify-between w-full px-2 py-1 rounded ${filter.type === 'ap' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                      onClick={() => onFilterChange({ ...filter, type: filter.type === 'ap' ? undefined : 'ap' })}
                    >
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>Access Points</span>
                      </span>
                      {filter.type === 'ap' && <span className="text-[10px]">selected</span>}
                    </button>
                    <button
                      className={`flex items-center justify-between w-full px-2 py-1 rounded ${filter.type === 'switch' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                      onClick={() => onFilterChange({ ...filter, type: filter.type === 'switch' ? undefined : 'switch' })}
                    >
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Switches</span>
                      </span>
                      {filter.type === 'switch' && <span className="text-[10px]">selected</span>}
                    </button>
                    <button
                      className={`flex items-center justify-between w-full px-2 py-1 rounded ${filter.type === 'router' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                      onClick={() => onFilterChange({ ...filter, type: filter.type === 'router' ? undefined : 'router' })}
                    >
                      <span className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span>Routers</span>
                      </span>
                      {filter.type === 'router' && <span className="text-[10px]">selected</span>}
                    </button>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Status</h4>
                    <div className="space-y-1 text-xs">
                      <button
                        className={`flex items-center justify-between w-full px-2 py-1 rounded ${filter.status === 'online' ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50'}`}
                        onClick={() => onFilterChange({ ...filter, status: filter.status === 'online' ? undefined : 'online' })}
                      >
                        <span className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>Online</span>
                        </span>
                        {filter.status === 'online' && <span className="text-[10px]">selected</span>}
                      </button>
                      <button
                        className={`flex items-center justify-between w-full px-2 py-1 rounded ${filter.status === 'offline' ? 'bg-red-50 text-red-700' : 'hover:bg-gray-50'}`}
                        onClick={() => onFilterChange({ ...filter, status: filter.status === 'offline' ? undefined : 'offline' })}
                      >
                        <span className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span>Offline</span>
                        </span>
                        {filter.status === 'offline' && <span className="text-[10px]">selected</span>}
                      </button>
                      <button
                        className={`flex items-center justify-between w-full px-2 py-1 rounded ${filter.status === 'unknown' ? 'bg-yellow-50 text-yellow-700' : 'hover:bg-gray-50'}`}
                        onClick={() => onFilterChange({ ...filter, status: filter.status === 'unknown' ? undefined : 'unknown' })}
                      >
                        <span className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <span>Unknown</span>
                        </span>
                        {filter.status === 'unknown' && <span className="text-[10px]">selected</span>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Network Stats */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Network Stats</h3>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>Devices: {devices.length}</div>
                  <div>Connections: {links.length}</div>
                  <div>Online: {devices.filter(d => d.status === 'online').length}</div>
                  <div>Offline: {devices.filter(d => d.status === 'offline').length}</div>
                </div>
                {links.length === 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-amber-600">
                      <div className="font-medium">No connections shown</div>
                      <div>LLDP discovery requires write API access</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Topology View */}
        <div className="flex-1 relative">
          {!demoMode && !selectedVenueId && (
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
                <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Venue</h3>
                <p className="text-gray-600 mb-4">
                  Choose a venue from the dropdown above to view its network devices and topology.
                </p>
                <p className="text-sm text-gray-500">
                  This prevents loading all devices across all venues, which could be thousands of devices.
                </p>
              </div>
            </div>
          )}


          <TopologyView
            devices={devices}
            links={links}
            selectedDevice={selectedDevice}
            onDeviceSelect={onDeviceSelect}
            venueId={selectedVenueId || undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default TopologyViewWrapper;
