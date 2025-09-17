import React, { useState } from 'react';
// Test deployment trigger
import { X, Save, Eye, EyeOff } from 'lucide-react';
import { RuckusConfig } from '../types';

interface ConfigModalProps {
  onSave: (config: RuckusConfig) => void;
  onDemoMode: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ onSave, onDemoMode }) => {
  const [config, setConfig] = useState<RuckusConfig>(() => {
    // Load saved configuration from localStorage
    const savedConfig = localStorage.getItem('ruckus-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        return {
          region: parsed.region || 'na',
          tenantId: parsed.tenantId || '',
          clientId: parsed.clientId || '',
          clientSecret: parsed.clientSecret || ''
        };
      } catch (error) {
      }
    }
    
    // Default configuration
    return {
      region: 'na',
      tenantId: '',
      clientId: '',
      clientSecret: ''
    };
  });
  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const regionOptions = [
    { value: 'na', label: 'North America (api.ruckus.cloud)' },
    { value: 'eu', label: 'Europe (api.eu.ruckus.cloud)' },
    { value: 'asia', label: 'Asia (api.asia.ruckus.cloud)' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Ruckus One API Configuration</h2>
          <button
            onClick={() => window.location.reload()}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region
            </label>
            <select
              value={config.region}
              onChange={(e) => setConfig({ ...config, region: e.target.value as 'na' | 'eu' | 'asia' })}
              className="input"
              required
            >
              {regionOptions.map((region) => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tenant ID
            </label>
            <input
              type="text"
              value={config.tenantId}
              onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
              className="input"
              placeholder="Enter your tenant ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client ID
            </label>
            <input
              type="text"
              value={config.clientId}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              className="input"
              placeholder="Enter your client ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.clientSecret}
                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                className="input pr-10"
                placeholder="Enter your client secret"
                required
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">How to get your credentials:</h3>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Log into your Ruckus One account</li>
              <li>Go to Administration → Account Management → Settings</li>
              <li>Create an Application Token</li>
              <li>Copy the Client ID, Client Secret, and Tenant ID</li>
            </ol>
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={onDemoMode}
              className="btn btn-secondary"
            >
              Try Demo Mode
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigModal;
