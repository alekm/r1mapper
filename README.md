# r1mapper - Network Topology Visualizer

A modern, interactive web application that connects to the Ruckus One API to visualize network devices and their LLDP neighbors on both map and topology views.

## Features

- 🗺️ **Interactive Map View**: Visualize devices on a geographical map with custom icons
- 🔗 **Network Topology View**: See device connections and relationships in a graph layout
- 📊 **Real-time Data**: Fetch live device status and LLDP neighbor information
- 🔍 **Advanced Filtering**: Filter devices by type, status, and search terms
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Fast & Modern**: Built with React, TypeScript, and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Ruckus One account with API access
- Application token (Client ID, Client Secret, Tenant ID)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd r1map
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Configuration

On first launch, you'll be prompted to configure your Ruckus One API credentials:

1. **Region**: Choose your Ruckus One region (North America, Europe, or Asia)
2. **Tenant ID**: Your Ruckus One tenant identifier
3. **Client ID**: Application token client ID
4. **Client Secret**: Application token client secret
5. **Scope**: API access scope (usually "read")

#### How to get your credentials:

1. Log into your Ruckus One account
2. Navigate to **Administration → Account Management → Settings**
3. Create an **Application Token**
4. Copy the Client ID, Client Secret, and Tenant ID
5. Enter these values in the configuration modal

## Usage

### Map View
- View devices plotted on a geographical map
- Click on device markers to see details
- Different icons for APs, switches, and routers
- Color-coded status indicators

### Topology View
- Network graph showing device relationships
- LLDP neighbor connections displayed as lines
- Click devices to select and view details
- Legend showing device types and status

### Filtering
- **Search**: Find devices by name, model, IP, or MAC address
- **Device Type**: Filter by Access Points, Switches, Routers, or Unknown
- **Status**: Show only Online, Offline, or Unknown devices

### Device Details
- Comprehensive device information panel
- Real-time status and uptime
- Network configuration details
- Location information (when available)

## API Integration

The application integrates with the following Ruckus One API endpoints:

- `/venues` - Get venue information
- `/venues/{venueId}/aps` - Get access points for a venue
- `/switches` - Get switch devices
- `/venues/{venueId}/aps/{serialNumber}/neighbors` - Trigger neighbor collection
- `/venues/{venueId}/aps/{serialNumber}/neighbors/query` - Query LLDP neighbors

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Mapping**: Leaflet, React-Leaflet
- **Visualization**: D3.js, Cytoscape.js
- **Build Tool**: Vite
- **Icons**: Lucide React

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/          # React components
│   ├── ConfigModal.tsx  # API configuration
│   ├── DeviceDetails.tsx # Device information panel
│   ├── FilterPanel.tsx  # Device filtering
│   └── TopologyView.tsx # Network topology visualization
├── services/            # API services
│   └── ruckusApi.ts     # Ruckus One API client
├── types/               # TypeScript type definitions
│   └── index.ts         # Main type definitions
├── App.tsx              # Main application component
├── main.tsx             # Application entry point
└── index.css            # Global styles
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the [Ruckus One API Documentation](https://docs.ruckus.cloud/api/)
- Create an issue in this repository
- Contact Ruckus support for API-related questions

## Roadmap

- [ ] Real-time updates via WebSocket
- [ ] Device performance metrics
- [ ] Network health monitoring
- [ ] Export functionality (PNG, SVG, PDF)
- [ ] Custom device icons and themes
- [ ] Multi-tenant support
- [ ] Historical data visualization
