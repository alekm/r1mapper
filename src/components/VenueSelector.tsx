import React from 'react';
import { MapPin, Building2 } from 'lucide-react';
import { Venue } from '../types';

interface VenueSelectorProps {
  venues: Venue[];
  selectedVenueId: string | null;
  onVenueSelect: (venueId: string | null) => void;
  loading?: boolean;
}

const VenueSelector: React.FC<VenueSelectorProps> = ({
  venues,
  selectedVenueId,
  onVenueSelect,
  loading = false
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">Select Venue</h3>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedVenueId || ''}
            onChange={(e) => onVenueSelect(e.target.value || null)}
            disabled={loading}
            className="min-w-[200px] px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select a venue to view devices</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
          
          {selectedVenueId && (
            <button
              onClick={() => onVenueSelect(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {selectedVenueId && (
        <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>
            {(() => {
              const venue = venues.find(v => v.id === selectedVenueId);
              if (!venue) return 'No address available';
              
              // Handle different address formats
              if (typeof venue.address === 'string') {
                return venue.address;
              } else if (venue.address && typeof venue.address === 'object') {
                // If address is an object, try to extract meaningful parts
                const addr = venue.address as any;
                return addr.addressLine || addr.city || addr.country || 'Address available';
              }
              return 'No address available';
            })()}
          </span>
        </div>
      )}
    </div>
  );
};

export default VenueSelector;
