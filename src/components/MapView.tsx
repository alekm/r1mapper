import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Venue, RuckusDevice } from '../types';
import { MapPin, Building2 } from 'lucide-react';

// Component to fit map bounds to show all markers
function FitBounds({ venues }: { venues: Venue[] }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (venues.length > 0) {
      const venuesWithLocation = venues.filter(v => v.location);
      if (venuesWithLocation.length > 0) {
        const bounds = venuesWithLocation.map(venue => [
          venue.location!.latitude,
          venue.location!.longitude
        ] as [number, number]);
        
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      }
    }
  }, [map, venues]);
  
  return null;
}

interface MapViewProps {
  venues: Venue[];
  devices: RuckusDevice[]; // devices are passed but not rendered on the map
  selectedVenueId: string | null;
  onVenueSelect: (venueId: string) => void;
  demoMode: boolean;
}

const MapView: React.FC<MapViewProps> = ({
  venues,
  devices, // devices are passed but not rendered on the map
  selectedVenueId,
  onVenueSelect,
  demoMode
}) => {
  // For demo mode, add some sample venues if none exist
  const displayVenues = useMemo(() => {
    if (demoMode && venues.length === 0) {
      return [
        {
          id: 'demo-1',
          name: 'Demo Office Building',
          location: { latitude: 37.7749, longitude: -122.4194 },
          address: 'San Francisco, CA'
        },
        {
          id: 'demo-2',
          name: 'Demo Warehouse',
          location: { latitude: 34.0522, longitude: -118.2437 },
          address: 'Los Angeles, CA'
        },
        {
          id: 'demo-3',
          name: 'Demo Data Center',
          location: { latitude: 40.7128, longitude: -74.0060 },
          address: 'New York, NY'
        }
      ];
    }
    return venues;
  }, [venues, demoMode]);

  // Memoize map center and zoom to prevent re-renders that break interactivity
  const mapCenter = useMemo(() => {
    // If we have venues with locations, center on the middle of all venues
    if (displayVenues.length > 0) {
      const venuesWithLocation = displayVenues.filter(v => v.location);
      if (venuesWithLocation.length > 0) {
        const avgLat = venuesWithLocation.reduce((sum, v) => sum + v.location!.latitude, 0) / venuesWithLocation.length;
        const avgLng = venuesWithLocation.reduce((sum, v) => sum + v.location!.longitude, 0) / venuesWithLocation.length;
        return [avgLat, avgLng] as [number, number];
      }
    }
    // For map view, use a more neutral default center (middle of US) instead of San Francisco
    return [39.8283, -98.5795] as [number, number]; // Default to middle of US
  }, [displayVenues, demoMode]);

  const mapZoom = useMemo(() => {
    // Adjust zoom based on number of venues
    if (displayVenues.length > 0) {
      const venuesWithLocation = displayVenues.filter(v => v.location);
      if (venuesWithLocation.length > 1) {
        return 6; // Zoom out more for multiple venues to show all
      } else if (venuesWithLocation.length === 1) {
        return 10; // Zoom in for single venue
      }
    }
    return 4; // Default zoom - wide view for map overview
  }, [displayVenues, demoMode]);

  return (
    <div className="h-full w-full flex">
      {/* Sidebar with venue list */}
      <div className="map-sidebar">
        <div className="sidebar-header">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Building2 className="h-5 w-5 mr-2 icon-primary" />
            Venues
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {displayVenues.length} venue{displayVenues.length !== 1 ? 's' : ''} found
          </p>
        </div>
        
        <div className="sidebar-content">
          {displayVenues.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No venues found</p>
            </div>
          ) : (
            <div className="p-2">
              {displayVenues.map((venue) => (
                <div
                  key={venue.id}
                  onClick={() => onVenueSelect(venue.id)}
                  className={`sidebar-item rounded-lg mb-2 ${
                    selectedVenueId === venue.id ? 'active' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">
                        {venue.name}
                      </h3>
                      {venue.address && (
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {venue.address}
                        </p>
                      )}
                      {venue.location && (
                        <p className="text-xs text-gray-400 mt-1">
                          {venue.location.latitude.toFixed(4)}, {venue.location.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <MapPin className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map container */}
      <div className="map-container">
        <MapContainer
          key={`map-${displayVenues.length}-${demoMode}`} // Force re-render when venues change
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <FitBounds venues={displayVenues} />

          {displayVenues.map((venue) => (
            venue.location ? (
              <Marker
                key={venue.id}
                position={[venue.location.latitude, venue.location.longitude]}
                icon={new Icon({
                  iconUrl: `data:image/svg+xml;base64,${btoa(`
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="${selectedVenueId === venue.id ? '#10b981' : '#3B82F6'}" stroke="#ffffff" stroke-width="2"/>
                      <path d="M12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5ZM12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 10.8C12.99 10.8 13.8 9.99 13.8 9C13.8 8.01 12.99 7.2 12 7.2C11.01 7.2 10.2 8.01 10.2 9C10.2 9.99 11.01 10.8 12 10.8Z" fill="#ffffff"/>
                    </svg>
                  `)}`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -30]
                })}
                eventHandlers={{
                  click: () => onVenueSelect(venue.id),
                }}
              >
                <Popup>
                  <div className="font-semibold text-primary-700">{venue.name}</div>
                  <div className="text-sm text-gray-600">{venue.address}</div>
                  <button
                    onClick={() => onVenueSelect(venue.id)}
                    className="mt-2 px-3 py-1 bg-primary-500 text-white text-xs rounded hover:bg-primary-600"
                  >
                    View Topology
                  </button>
                </Popup>
              </Marker>
            ) : null
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;