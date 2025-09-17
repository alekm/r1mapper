import React, { useEffect, useRef, useState } from 'react';
import { RuckusDevice, LLDPLink } from '../types';
import { clsx } from 'clsx';

interface TopologyViewProps {
  devices: RuckusDevice[];
  links: LLDPLink[];
  selectedDevice: RuckusDevice | null;
  onDeviceSelect: (device: RuckusDevice) => void;
}

const TopologyView: React.FC<TopologyViewProps> = ({
  devices,
  links,
  selectedDevice,
  onDeviceSelect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Simple force-directed layout simulation
  const [devicePositions, setDevicePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (devices.length === 0) return;

    // Initialize positions in a circle
    const positions = new Map<string, { x: number; y: number }>();
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.3;

    devices.forEach((device, index) => {
      const angle = (2 * Math.PI * index) / devices.length;
      positions.set(device.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    setDevicePositions(positions);
  }, [devices, dimensions]);

  const getDeviceColor = (device: RuckusDevice) => {
    if (device.status === 'offline') return '#ef4444';
    if (device.status === 'online') {
      switch (device.type) {
        case 'ap': return '#3b82f6';
        case 'switch': return '#10b981';
        case 'router': return '#8b5cf6';
        default: return '#6b7280';
      }
    }
    return '#f59e0b';
  };

  const getDeviceIcon = (device: RuckusDevice) => {
    switch (device.type) {
      case 'ap':
        return '📶';
      case 'switch':
        return '🔀';
      case 'router':
        return '🌐';
      default:
        return '❓';
    }
  };

  return (
    <div className="h-full w-full bg-gray-50 relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="absolute inset-0"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        {/* Links */}
        {links.map((link) => {
          const sourcePos = devicePositions.get(link.localDeviceId);
          const targetPos = devicePositions.get(link.remoteDeviceId);
          
          if (!sourcePos || !targetPos) return null;

          return (
            <line
              key={link.id}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              className={clsx(
                'connection-line',
                selectedDevice && 
                (selectedDevice.id === link.localDeviceId || selectedDevice.id === link.remoteDeviceId) &&
                'active'
              )}
              stroke="#94a3b8"
            />
          );
        })}

        {/* Devices */}
        {devices.map((device) => {
          const position = devicePositions.get(device.id);
          if (!position) return null;

          const isSelected = selectedDevice?.id === device.id;
          const color = getDeviceColor(device);

          return (
            <g key={device.id}>
              {/* Device circle */}
              <circle
                cx={position.x}
                cy={position.y}
                r={isSelected ? 25 : 20}
                fill={color}
                stroke={isSelected ? '#1f2937' : '#ffffff'}
                strokeWidth={isSelected ? 3 : 2}
                className="device-node cursor-pointer transition-all duration-200 hover:scale-110"
                onClick={() => onDeviceSelect(device)}
              />
              
              {/* Device icon */}
              <text
                x={position.x}
                y={position.y + 5}
                textAnchor="middle"
                className="text-white text-sm font-bold pointer-events-none"
              >
                {getDeviceIcon(device)}
              </text>
              
              {/* Device name */}
              <text
                x={position.x}
                y={position.y + 45}
                textAnchor="middle"
                className="text-xs font-medium text-gray-700 pointer-events-none"
              >
                {device.name}
              </text>
              
              {/* Status indicator */}
              <circle
                cx={position.x + 15}
                cy={position.y - 15}
                r={4}
                fill={device.status === 'online' ? '#10b981' : device.status === 'offline' ? '#ef4444' : '#f59e0b'}
                stroke="#ffffff"
                strokeWidth={1}
              />
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Device Types</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Access Points</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Switches</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Routers</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Unknown</span>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-900 mb-2">Status</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Online</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>Offline</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>Unknown</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Network Stats</h3>
        <div className="space-y-1 text-xs text-gray-600">
          <div>Devices: {devices.length}</div>
          <div>Connections: {links.length}</div>
          <div>Online: {devices.filter(d => d.status === 'online').length}</div>
          <div>Offline: {devices.filter(d => d.status === 'offline').length}</div>
        </div>
      </div>
    </div>
  );
};

export default TopologyView;
