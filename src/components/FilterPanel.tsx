import React from 'react';
import { Search, Filter, Wifi, Router, Server, HardDrive } from 'lucide-react';
import { DeviceFilter, RuckusDevice } from '../types';
import { clsx } from 'clsx';

interface FilterPanelProps {
  filter: DeviceFilter;
  onFilterChange: (filter: DeviceFilter) => void;
  deviceCount: number;
  totalDevices: number;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filter,
  onFilterChange,
  deviceCount,
  totalDevices
}) => {
  const deviceTypes: Array<{ value: RuckusDevice['type']; label: string; icon: React.ReactNode }> = [
    { value: 'ap', label: 'Access Points', icon: <Wifi className="h-4 w-4" /> },
    { value: 'switch', label: 'Switches', icon: <Router className="h-4 w-4" /> },
    { value: 'router', label: 'Routers', icon: <Server className="h-4 w-4" /> },
    { value: 'unknown', label: 'Unknown', icon: <HardDrive className="h-4 w-4" /> },
  ];

  const statusOptions: Array<{ value: RuckusDevice['status']; label: string }> = [
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'unknown', label: 'Unknown' },
  ];

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="h-5 w-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
      </div>

      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search devices..."
            value={filter.search || ''}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Device Type Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Device Type
        </label>
        <div className="space-y-2">
          <button
            onClick={() => onFilterChange({ ...filter, type: undefined })}
            className={clsx(
              'w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors',
              !filter.type
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <span>All Types</span>
          </button>
          {deviceTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => onFilterChange({ ...filter, type: type.value })}
              className={clsx(
                'w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors',
                filter.type === type.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {type.icon}
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Status
        </label>
        <div className="space-y-2">
          <button
            onClick={() => onFilterChange({ ...filter, status: undefined })}
            className={clsx(
              'w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors',
              !filter.status
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <span>All Status</span>
          </button>
          {statusOptions.map((status) => (
            <button
              key={status.value}
              onClick={() => onFilterChange({ ...filter, status: status.value })}
              className={clsx(
                'w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors',
                filter.status === status.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <div
                className={clsx(
                  'w-2 h-2 rounded-full',
                  status.value === 'online' && 'bg-green-500',
                  status.value === 'offline' && 'bg-red-500',
                  status.value === 'unknown' && 'bg-yellow-500'
                )}
              />
              <span>{status.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Showing <span className="font-medium text-gray-900">{deviceCount}</span> of{' '}
          <span className="font-medium text-gray-900">{totalDevices}</span> devices
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
