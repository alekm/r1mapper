import React from 'react';
import { ArrowLeft, ExternalLink, Wifi, MapPin, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Footer } from './Footer';

const AboutPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with back button */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/map')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Map</span>
            </button>
            <div className="h-4 w-px bg-gray-300"></div>
            <h2 className="text-lg font-semibold text-gray-900">About R1Mapper</h2>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-6">
              <Wifi className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              R1Mapper
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Network Topology Visualizer v1.0
            </p>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              A modern, interactive web application that connects to the Ruckus One API to visualize 
              network devices and their LLDP neighbors on both map and topology views.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <MapPin className="h-6 w-6 text-orange-500 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Interactive Map View</h3>
                </div>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Visualize venues on geographical maps</li>
                  <li>• Custom markers with venue information</li>
                  <li>• Automatic zoom to fit all venues</li>
                  <li>• Easy venue selection and navigation</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <Network className="h-6 w-6 text-orange-500 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Network Topology</h3>
                </div>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Multiple layout algorithms</li>
                  <li>• Interactive pan and zoom controls</li>
                  <li>• LLDP neighbor connections</li>
                  <li>• RF neighbor discovery for APs</li>
                </ul>
              </div>
            </div>
          </div>

          {/* R1Tools Integration */}
          <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100 mb-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Part of the R1Tools Suite</h2>
              <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
                R1Mapper is just one of the powerful tools in the R1Tools collection. 
                Explore more Ruckus One management utilities and resources.
              </p>
              <a 
                href="https://r1tools.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <ExternalLink className="w-5 h-5" />
                Visit R1Tools
              </a>
            </div>
          </div>

          {/* Technical Details */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Technology Stack</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• React 18 with TypeScript</li>
                  <li>• Tailwind CSS for styling</li>
                  <li>• Leaflet for map visualization</li>
                  <li>• Custom SVG topology rendering</li>
                  <li>• Vite for fast development</li>
                </ul>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Integration</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Ruckus One API integration</li>
                  <li>• OAuth 2.0 authentication</li>
                  <li>• Real-time device status</li>
                  <li>• LLDP neighbor discovery</li>
                  <li>• RF neighbor scanning</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Built with ❤️ for network administrators and IT professionals
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Desktop-optimized design • Professional network management workflows
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Hosted on{' '}
              <a 
                href="https://netlify.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-600 hover:text-orange-700 transition-colors"
              >
                Netlify
              </a>
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default AboutPage;
