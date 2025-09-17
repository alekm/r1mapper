import React, { useEffect, useRef, useState } from 'react';
import { RuckusDevice, LLDPLink } from '../types';
import { clsx } from 'clsx';

type LayoutType = 'circle' | 'hierarchical' | 'force-directed' | 'grid' | 'tree';

interface TopologyViewProps {
  devices: RuckusDevice[];
  links: LLDPLink[];
  selectedDevice: RuckusDevice | null;
  onDeviceSelect: (device: RuckusDevice) => void;
  venueId?: string;
}

const TopologyView: React.FC<TopologyViewProps> = ({
  devices,
  links,
  selectedDevice,
  onDeviceSelect,
  venueId
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [layoutType, setLayoutType] = useState<LayoutType>('hierarchical');
  
  // Pan and zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  
  // Device dragging state
  const [isDraggingDevice, setIsDraggingDevice] = useState(false);
  const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);
  const [deviceDragStart, setDeviceDragStart] = useState({ x: 0, y: 0 });
  const [devicePositions, setDevicePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [manuallyPositionedDevices, setManuallyPositionedDevices] = useState<Set<string>>(new Set());
  
  // View save/load state
  const [savedViews, setSavedViews] = useState<Map<string, { positions: Map<string, { x: number; y: number }>, layout: LayoutType }>>(new Map());


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

  // Load saved views from localStorage on mount
  useEffect(() => {
    if (!venueId) return;
    
    const savedViewsData = localStorage.getItem(`topology-views-${venueId}`);
    if (savedViewsData) {
      try {
        const viewsArray = JSON.parse(savedViewsData);
        const viewsMap = new Map();
        viewsArray.forEach((view: any) => {
          viewsMap.set(view.name, {
            positions: new Map(view.positions),
            layout: view.layout,
            manuallyPositioned: new Set(view.manuallyPositioned || [])
          });
        });
        setSavedViews(viewsMap);
      } catch (error) {
      }
    } else {
      setSavedViews(new Map());
    }
  }, [venueId]);

  // Warn before page unload if there are unsaved manual positions
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (manuallyPositionedDevices.size > 0) {
        e.preventDefault();
        e.returnValue = `You have ${manuallyPositionedDevices.size} device(s) with custom positions that will be lost. Save your view or continue to lose changes.`;
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [manuallyPositionedDevices.size]);

  // Layout algorithms

  const calculateLayout = (layout: LayoutType) => {
    if (devices.length === 0) return new Map();

    const positions = new Map<string, { x: number; y: number }>();
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const margin = 50; // Standard margin for device spacing

    switch (layout) {
      case 'circle':
        // Original circular layout
        const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
        devices.forEach((device, index) => {
          const angle = (2 * Math.PI * index) / devices.length;
          positions.set(device.id, {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        });
        break;

      case 'hierarchical':
        // Hierarchical layout: switches at top, APs below
        const switches = devices.filter(d => d.type === 'switch');
        const aps = devices.filter(d => d.type === 'ap');
        const others = devices.filter(d => d.type !== 'switch' && d.type !== 'ap');
        
        // Switches at top
        switches.forEach((device, index) => {
          const x = margin + (index * (dimensions.width - 2 * margin)) / Math.max(switches.length - 1, 1);
          positions.set(device.id, { x, y: margin + 50 });
        });
        
        // APs in middle
        aps.forEach((device, index) => {
          const x = margin + (index * (dimensions.width - 2 * margin)) / Math.max(aps.length - 1, 1);
          positions.set(device.id, { x, y: centerY });
        });
        
        // Others at bottom
        others.forEach((device, index) => {
          const x = margin + (index * (dimensions.width - 2 * margin)) / Math.max(others.length - 1, 1);
          positions.set(device.id, { x, y: dimensions.height - margin - 50 });
        });
        break;

      case 'grid':
        // Grid layout
        const cols = Math.ceil(Math.sqrt(devices.length));
        const cellWidth = (dimensions.width - 2 * margin) / cols;
        const cellHeight = (dimensions.height - 2 * margin) / Math.ceil(devices.length / cols);
        
        devices.forEach((device, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          positions.set(device.id, {
            x: margin + col * cellWidth + cellWidth / 2,
            y: margin + row * cellHeight + cellHeight / 2
          });
        });
        break;

      case 'tree':
        // Tree layout: central switch with APs branching out
        const centralSwitch = devices.find(d => d.type === 'switch');
        const treeAPs = devices.filter(d => d.type === 'ap');
        const treeOthers = devices.filter(d => d.type !== 'switch' && d.type !== 'ap');
        
        if (centralSwitch) {
          positions.set(centralSwitch.id, { x: centerX, y: centerY });
          
          // APs in a circle around the central switch
          const treeRadius = Math.min(dimensions.width, dimensions.height) * 0.25;
          treeAPs.forEach((device, index) => {
            const angle = (2 * Math.PI * index) / Math.max(treeAPs.length, 1);
            positions.set(device.id, {
              x: centerX + treeRadius * Math.cos(angle),
              y: centerY + treeRadius * Math.sin(angle)
            });
          });
          
          // Other devices in outer ring
          const outerRadius = Math.min(dimensions.width, dimensions.height) * 0.4;
          treeOthers.forEach((device, index) => {
            const angle = (2 * Math.PI * index) / Math.max(treeOthers.length, 1);
            positions.set(device.id, {
              x: centerX + outerRadius * Math.cos(angle),
              y: centerY + outerRadius * Math.sin(angle)
            });
          });
        } else {
          // Fallback to circle if no central switch
          const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
          devices.forEach((device, index) => {
            const angle = (2 * Math.PI * index) / devices.length;
            positions.set(device.id, {
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle)
            });
          });
        }
        break;

      case 'force-directed':
        // Simple force-directed simulation
        const iterations = 100;
        const k = Math.sqrt((dimensions.width * dimensions.height) / devices.length);
        
        // Initialize random positions
        devices.forEach(device => {
          positions.set(device.id, {
            x: Math.random() * (dimensions.width - 2 * margin) + margin,
            y: Math.random() * (dimensions.height - 2 * margin) + margin
          });
        });
        
        // Force simulation
        for (let i = 0; i < iterations; i++) {
          const forces = new Map<string, { x: number; y: number }>();
          
          // Initialize forces
          devices.forEach(device => {
            forces.set(device.id, { x: 0, y: 0 });
          });
          
          // Repulsive forces between all devices
          for (let j = 0; j < devices.length; j++) {
            for (let k = j + 1; k < devices.length; k++) {
              const device1 = devices[j];
              const device2 = devices[k];
              const pos1 = positions.get(device1.id)!;
              const pos2 = positions.get(device2.id)!;
              
              const dx = pos1.x - pos2.x;
              const dy = pos1.y - pos2.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (k * k) / distance;
              
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;
              
              forces.set(device1.id, {
                x: forces.get(device1.id)!.x + fx,
                y: forces.get(device1.id)!.y + fy
              });
              forces.set(device2.id, {
                x: forces.get(device2.id)!.x - fx,
                y: forces.get(device2.id)!.y - fy
              });
            }
          }
          
          // Attractive forces for connected devices
          links.forEach(link => {
            const pos1 = positions.get(link.localDeviceId);
            const pos2 = positions.get(link.remoteDeviceId);
            if (pos1 && pos2) {
              const dx = pos2.x - pos1.x;
              const dy = pos2.y - pos1.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (distance * distance) / k;
              
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;
              
              forces.set(link.localDeviceId, {
                x: forces.get(link.localDeviceId)!.x + fx,
                y: forces.get(link.localDeviceId)!.y + fy
              });
              forces.set(link.remoteDeviceId, {
                x: forces.get(link.remoteDeviceId)!.x - fx,
                y: forces.get(link.remoteDeviceId)!.y - fy
              });
            }
          });
          
          // Apply forces
          devices.forEach(device => {
            const pos = positions.get(device.id)!;
            const force = forces.get(device.id)!;
            const damping = 0.1;
            
            positions.set(device.id, {
              x: Math.max(margin, Math.min(dimensions.width - margin, pos.x + force.x * damping)),
              y: Math.max(margin, Math.min(dimensions.height - margin, pos.y + force.y * damping))
            });
          });
        }
        break;
    }

    // Preserve positions for manually positioned devices
    manuallyPositionedDevices.forEach(deviceId => {
      const customPos = devicePositions.get(deviceId);
      if (customPos) {
        positions.set(deviceId, customPos);
      }
    });

    return positions;
  };

  useEffect(() => {
    const positions = calculateLayout(layoutType);
    setDevicePositions(positions);
  }, [devices, dimensions, layoutType]);

  // Pan and zoom event handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPan(pan);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDraggingDevice && draggedDeviceId) {
      // Handle device dragging
      const deltaX = (e.clientX - deviceDragStart.x) / zoom;
      const deltaY = (e.clientY - deviceDragStart.y) / zoom;
      
      const currentPos = devicePositions.get(draggedDeviceId);
      if (currentPos) {
        const newPositions = new Map(devicePositions);
        newPositions.set(draggedDeviceId, {
          x: currentPos.x + deltaX,
          y: currentPos.y + deltaY
        });
        setDevicePositions(newPositions);
        setDeviceDragStart({ x: e.clientX, y: e.clientY });
        
        // Mark device as manually positioned
        setManuallyPositionedDevices(prev => new Set(prev).add(draggedDeviceId));
      }
    } else if (isDragging) {
      // Handle pan dragging
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPan({
        x: lastPan.x + deltaX,
        y: lastPan.y + deltaY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingDevice(false);
    setDraggedDeviceId(null);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
    setZoom(newZoom);
  };

  // View save/load functions
  const saveView = () => {
    if (!venueId) {
      alert('No venue selected. Cannot save view.');
      return;
    }
    
    const viewName = prompt('Enter a name for this view:');
    if (viewName && viewName.trim()) {
      const newViews = new Map(savedViews);
      newViews.set(viewName.trim(), {
        positions: new Map(devicePositions),
        layout: layoutType,
        manuallyPositioned: new Set(manuallyPositionedDevices)
      });
      setSavedViews(newViews);
      
      // Save to venue-specific localStorage
      const viewsArray = Array.from(newViews.entries()).map(([name, data]) => ({
        name,
        positions: Array.from(data.positions.entries()),
        layout: data.layout,
        manuallyPositioned: Array.from(data.manuallyPositioned || [])
      }));
      localStorage.setItem(`topology-views-${venueId}`, JSON.stringify(viewsArray));
      
      alert(`View "${viewName}" saved successfully for this venue!`);
    }
  };

  const loadView = (viewName: string) => {
    const view = savedViews.get(viewName);
    if (view) {
      setDevicePositions(new Map(view.positions));
      setLayoutType(view.layout);
      setManuallyPositionedDevices(new Set(view.manuallyPositioned || []));
      alert(`View "${viewName}" loaded successfully!`);
    }
  };

  const deleteView = (viewName: string) => {
    if (!venueId) return;
    
    if (confirm(`Are you sure you want to delete view "${viewName}"?`)) {
      const newViews = new Map(savedViews);
      newViews.delete(viewName);
      setSavedViews(newViews);
      
      // Update venue-specific localStorage
      const viewsArray = Array.from(newViews.entries()).map(([name, data]) => ({
        name,
        positions: Array.from(data.positions.entries()),
        layout: data.layout,
        manuallyPositioned: Array.from(data.manuallyPositioned || [])
      }));
      localStorage.setItem(`topology-views-${venueId}`, JSON.stringify(viewsArray));
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDevicePositions(new Map());
    setManuallyPositionedDevices(new Set());
    // Force layout recalculation by updating device positions with current layout
    const newPositions = calculateLayout(layoutType);
    setDevicePositions(newPositions);
  };

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
    // Default to yellow for unknown status
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

  const getDeviceIconSvg = (device: RuckusDevice) => {
    const color = '#ffffff'; // White icon on colored background
    const bgColor = getDeviceColor(device); // Use the same colors as the main device circle
    
    switch (device.type) {
      case 'ap':
        return (
          <g>
            <circle cx="0" cy="0" r="8" fill={bgColor} />
            <path d="M-4,-2 L4,-2 M-3,0 L3,0 M-2,2 L2,2" stroke={color} strokeWidth="1.5" fill="none" />
          </g>
        );
      case 'switch':
        return (
          <g>
            <rect x="-6" y="-4" width="12" height="8" rx="1" fill={bgColor} />
            <rect x="-3" y="-2" width="6" height="4" fill={color} />
            <path d="M-6,0 L-8,0 M6,0 L8,0" stroke={color} strokeWidth="1" />
          </g>
        );
      case 'router':
        return (
          <g>
            <rect x="-6" y="-3" width="12" height="6" rx="1" fill={bgColor} />
            <path d="M-4,-1 L4,-1 M-4,0 L4,0 M-4,1 L4,1" stroke={color} strokeWidth="1" />
          </g>
        );
      default:
        return (
          <g>
            <circle cx="0" cy="0" r="8" fill={bgColor} />
            <text x="0" y="3" textAnchor="middle" fontSize="10" fill={color}>?</text>
          </g>
        );
    }
  };

  return (
    <div className="h-full w-full bg-gray-50 relative">
      {/* Controls - Top right corner */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 z-10 flex items-center space-x-2">
        <select
          value={layoutType}
          onChange={(e) => {
            const newLayout = e.target.value as LayoutType;
            // Check if there are manually positioned devices
            if (manuallyPositionedDevices.size > 0) {
              const shouldOverwrite = confirm(
                `You have ${manuallyPositionedDevices.size} device(s) with custom positions. Changing the layout will reset all device positions. Do you want to continue?`
              );
              if (!shouldOverwrite) {
                return; // User cancelled, don't change layout
              }
            }
            
            setLayoutType(newLayout);
            const newPositions = calculateLayout(newLayout);
            setDevicePositions(newPositions);
            setManuallyPositionedDevices(new Set()); // Clear manual positioning since we're applying new layout
          }}
          className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0"
        >
          <option value="hierarchical">Hierarchical</option>
          <option value="tree">Tree</option>
          <option value="force-directed">Force-Directed</option>
          <option value="grid">Grid</option>
          <option value="circle">Circle</option>
        </select>
        <button
          onClick={resetView}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
          title="Reset zoom and pan"
        >
          Reset View
        </button>
        <div className="text-xs text-gray-500 px-2">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* View Management Controls - Top left corner */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-2 z-10">
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={saveView}
            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
            title="Save current view"
          >
            Save View
          </button>
          {savedViews.size > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  loadView(e.target.value);
                  e.target.value = ''; // Reset selection
                }
              }}
              className="text-xs border-0 bg-transparent focus:outline-none focus:ring-0"
              defaultValue=""
            >
              <option value="">Load View...</option>
              {Array.from(savedViews.keys()).map((viewName) => (
                <option key={viewName} value={viewName}>
                  {viewName}
                </option>
              ))}
            </select>
          )}
        </div>
        {savedViews.size > 0 && (
          <div className="text-xs text-gray-500">
            {savedViews.size} saved view{savedViews.size !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="absolute inset-0"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
        className={`absolute inset-0 ${isDraggingDevice || isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Pan and zoom transform group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* Links */}
        {links.map((link) => {
          const sourcePos = devicePositions.get(link.localDeviceId);
          const targetPos = devicePositions.get(link.remoteDeviceId);
          
          if (!sourcePos || !targetPos) {
            return null;
          }
          // Calculate position for port label - close to the source device
          const labelX = sourcePos.x + (targetPos.x - sourcePos.x) * 0.2; // 20% from source device
          const labelY = sourcePos.y + (targetPos.y - sourcePos.y) * 0.2;
          
          return (
            <g key={link.id}>
              <line
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
                strokeWidth="2"
              />
              {/* Port label - positioned close to the source device */}
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                className="svg-text-small fill-gray-600 pointer-events-none"
              >
                {link.localPort}
              </text>
            </g>
          );
        })}

        {/* Devices */}
        {devices.map((device) => {
          const position = devicePositions.get(device.id);
          if (!position) return null;

          const isSelected = selectedDevice?.id === device.id;
          const deviceColor = getDeviceColor(device);
          const statusColor = device.status === 'online' ? '#10b981' : device.status === 'offline' ? '#ef4444' : '#f59e0b';

          return (
            <g 
              key={device.id}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingDevice(true);
                setDraggedDeviceId(device.id);
                setDeviceDragStart({ x: e.clientX, y: e.clientY });
              }}
                  className={isDraggingDevice && draggedDeviceId === device.id ? 'cursor-grabbing' : 'cursor-grab'}
            >
              {/* Device circle background */}
              <circle
                cx={position.x}
                cy={position.y}
                r={isSelected ? 25 : 20}
                fill={deviceColor}
                stroke={isSelected ? '#1f2937' : '#ffffff'}
                strokeWidth={isSelected ? 3 : 2}
                className="device-node"
                onClick={(e) => {
                  if (!isDraggingDevice) {
                    onDeviceSelect(device);
                  }
                }}
                    className={isDraggingDevice && draggedDeviceId === device.id ? 'transition-none' : 'transition-smooth'}
              />
              
              {/* Device icon */}
              <g 
                transform={`translate(${position.x}, ${position.y})`}
                className="cursor-pointer"
                onClick={() => onDeviceSelect(device)}
              >
                {getDeviceIconSvg(device)}
              </g>
              
              {/* Device name */}
              <text
                x={position.x}
                y={position.y + 35}
                textAnchor="middle"
                className="text-xs font-medium text-gray-700 pointer-events-none"
              >
                {device.name}
              </text>
              
              {/* Device type label */}
              <text
                x={position.x}
                y={position.y + 50}
                textAnchor="middle"
                className="text-xs text-gray-500 pointer-events-none"
              >
                {device.type.toUpperCase()}
              </text>
              
              {/* Status indicator - fixed position */}
              <circle
                cx={position.x + 18}
                cy={position.y - 18}
                r={5}
                fill={statusColor}
              />
            </g>
          );
        })}
        </g>
      </svg>
    </div>
  );
};

export default TopologyView;
