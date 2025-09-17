import React from 'react';
import { 
  Wifi, 
  Router, 
  Server, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  Activity,
  HardDrive,
  Cpu
} from 'lucide-react';
import { RuckusDevice } from '../types';
import { clsx } from 'clsx';

interface DeviceDetailsProps {
  device: RuckusDevice;
}

const DeviceDetails: React.FC<DeviceDetailsProps> = ({ device }) => {
  const getDeviceIcon = (type: RuckusDevice['type']) => {
    switch (type) {
      case 'ap':
        return <Wifi className="h-5 w-5" />;
      case 'switch':
        return <Router className="h-5 w-5" />;
      case 'router':
        return <Server className="h-5 w-5" />;
      default:
        return <HardDrive className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: RuckusDevice['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const formatUptime = (uptime?: number) => {
    if (!uptime) return 'Unknown';
    
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center space-x-3 mb-4">
        <div className={clsx(
          'p-2 rounded-lg',
          device.type === 'ap' && 'bg-blue-100 text-blue-600',
          device.type === 'switch' && 'bg-green-100 text-green-600',
          device.type === 'router' && 'bg-purple-100 text-purple-600',
          device.type === 'unknown' && 'bg-gray-100 text-gray-600'
        )}>
          {getDeviceIcon(device.type)}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{device.name}</h3>
          <p className="text-sm text-gray-600 capitalize">{device.type}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(device.status)}
            <span className={clsx(
              'text-sm font-medium capitalize',
              device.status === 'online' && 'text-green-600',
              device.status === 'offline' && 'text-red-600',
              device.status === 'unknown' && 'text-yellow-600'
            )}>
              {device.status}
            </span>
          </div>
        </div>

        {/* Model */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Model</span>
          <span className="text-sm text-gray-900">{device.model}</span>
        </div>

        {/* IP Address */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">IP Address</span>
          <span className="text-sm text-gray-900 font-mono">{device.ipAddress}</span>
        </div>

        {/* MAC Address */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">MAC Address</span>
          <span className="text-sm text-gray-900 font-mono">{device.macAddress}</span>
        </div>

        {/* Serial Number */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Serial Number</span>
          <span className="text-sm text-gray-900 font-mono">{device.serialNumber}</span>
        </div>

        {/* Firmware Version */}
        {device.firmwareVersion && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Firmware</span>
            <span className="text-sm text-gray-900">{device.firmwareVersion}</span>
          </div>
        )}

        {/* Uptime */}
        {device.uptime && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Uptime</span>
            <div className="flex items-center space-x-1">
              <Activity className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">{formatUptime(device.uptime)}</span>
            </div>
          </div>
        )}

        {/* Last Seen */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Last Seen</span>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900">{formatLastSeen(device.lastSeen)}</span>
          </div>
        </div>

        {/* Location */}
        {device.location && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Location</span>
            <div className="flex items-center space-x-1">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">
                {device.location.latitude.toFixed(4)}, {device.location.longitude.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        {/* Venue ID (for APs) */}
        {'venueId' in device && device.venueId && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Venue ID</span>
            <span className="text-sm text-gray-900 font-mono">{device.venueId}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetails;
