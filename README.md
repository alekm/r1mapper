# R1Mapper - Network Topology Visualizer

A modern, interactive web application that connects to the Ruckus One API to visualize network devices and their LLDP neighbors on both map and topology views. Built with a focus on desktop optimization and professional network management workflows.

## Features

### 🗺️ **Interactive Map View**
- Visualize venues on a geographical map with custom markers
- Venue sidebar for easy selection when markers are clustered
- Automatic zoom to fit all venues
- Click venues to navigate to topology view

### 🔗 **Network Topology View**
- Multiple layout algorithms: Hierarchical, Tree, Force-Directed, Grid, and Circle
- Interactive pan and zoom with mouse controls
- Draggable devices for custom positioning
- LLDP neighbor connections with port information
- RF neighbor discovery for Access Points
- Venue-specific view save/load functionality

### 📊 **Advanced Device Management**
- Real-time device status and information
- RF neighbor scanning and querying for APs
- LLDP neighbor discovery for switches
- Device filtering and search capabilities
- Comprehensive device details sidebar

### 🎨 **Professional UI/UX**
- Desktop-optimized design (not mobile-responsive)
- r1helper-inspired styling with orange gradient theme
- Centralized CSS architecture
- Smooth animations and transitions
- Loading states and error handling

### 💾 **Data Persistence**
- Venue-specific saved topology views
- Custom device positioning preservation
- API configuration storage
- View management (save, load, delete)

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Ruckus One account with **Administrator API access** (required for LLDP neighbor discovery)
- Application token (Client ID, Client Secret, Tenant ID)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/alekm/r1mapper.git
cd r1mapper
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

#### How to get your credentials:

1. Log into your Ruckus One account
2. Navigate to **Administration → Account Management → Settings**
3. Create an **Application Token** with Administrator scope
4. Copy the Client ID, Client Secret, and Tenant ID
5. Enter these values in the configuration modal

## Usage

### Map View (`/map`)
- **Venue Overview**: See all venues plotted on a geographical map
- **Venue Selection**: Use the sidebar to select venues when markers are clustered
- **Navigation**: Click "View Topology" to switch to the topology view for that venue

### Topology View (`/topology`)
- **Venue Selection**: Choose a venue to view its network topology
- **Layout Options**: Switch between different layout algorithms
- **Device Interaction**: 
  - Click devices to view details
  - Drag devices to custom positions
  - View LLDP connections with port information
- **RF Neighbors**: For Access Points, trigger RF scans and view wireless neighbors
- **View Management**: Save, load, and delete custom topology views per venue

### Device Management
- **Device Details**: Comprehensive information panel with status, configuration, and location
- **RF Neighbor Discovery**: Trigger and query RF neighbors for Access Points
- **LLDP Discovery**: Automatic neighbor discovery for switches and APs
- **Status Monitoring**: Real-time device status with color-coded indicators

### View Management
- **Save Views**: Save custom device positions and layout types per venue
- **Load Views**: Quickly switch between saved topology arrangements
- **Reset Views**: Clear custom positioning and recalculate layouts
- **Confirmation Dialogs**: Prevent accidental loss of custom positioning work

## API Integration

The application integrates with the following Ruckus One API endpoints:

### Authentication
- OAuth 2.0 Client Credentials Flow
- JWT token management with automatic refresh

### Core Endpoints
- `/venues` - Get venue information
- `/venues/{venueId}/aps` - Get access points for a venue
- `/switches` - Get switch devices
- `/switches/{switchId}/ports` - Get switch port information

### Neighbor Discovery
- `PATCH /venues/{venueId}/aps/{serialNumber}/neighbors` - Trigger RF neighbor collection
- `POST /venues/{venueId}/aps/{serialNumber}/neighbors/query` - Query RF neighbors
- LLDP neighbor discovery via switch port queries

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Routing**: React Router for navigation between views
- **Mapping**: Leaflet, React-Leaflet for geographical visualization
- **Visualization**: Custom SVG-based topology rendering
- **Build Tool**: Vite for fast development and building
- **Icons**: Lucide React for consistent iconography
- **State Management**: React hooks and localStorage for persistence

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build optimized production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality

### Project Structure

```
src/
├── components/              # React components
│   ├── ConfigModal.tsx      # API configuration modal
│   ├── MapView.tsx          # Geographical map visualization
│   ├── TopologyView.tsx     # Network topology visualization
│   ├── TopologyViewWrapper.tsx # Topology view with sidebar
│   └── VenueSelector.tsx    # Venue selection component
├── services/                # API services
│   └── ruckusApi.ts         # Ruckus One API client
├── types/                   # TypeScript type definitions
│   └── index.ts             # Main type definitions
├── App.tsx                  # Main application component
├── main.tsx                 # Application entry point
└── index.css                # Global styles and design system
```

### Design System

The application uses a centralized CSS architecture with Tailwind CSS:

- **Color Scheme**: Orange gradient theme inspired by r1helper
- **Typography**: Desktop-optimized fonts and sizing
- **Components**: Reusable CSS classes for buttons, cards, forms, and layouts
- **Responsive**: Desktop-first design (explicitly not mobile-optimized)

## Demo Mode

The application includes a demo mode with sample data for testing and demonstration purposes. Enable demo mode from the configuration modal to explore features without API credentials.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly on desktop browsers
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
- [ ] Device performance metrics and monitoring
- [ ] Network health dashboards
- [ ] Export functionality (PNG, SVG, PDF)
- [ ] Custom device icons and themes
- [ ] Multi-tenant support
- [ ] Historical data visualization
- [ ] Advanced filtering and search
- [ ] Network path tracing
- [ ] Device configuration management