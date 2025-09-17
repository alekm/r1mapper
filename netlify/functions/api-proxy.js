// Use CommonJS syntax instead of ES modules
const axios = require('axios');
const https = require('https');

const handler = async (event, context) => {
  console.log('Function called with:', {
    method: event.httpMethod,
    path: event.path,
    queryString: event.queryStringParameters,
    hasBody: !!event.body
  });

  // Enable robust CORS for browser requests
  const requestOrigin = event.headers && (event.headers.origin || event.headers.Origin);
  const allowedOrigins = new Set([
    'https://r1mapper.com',
    'https://www.r1mapper.com',
    'https://r1mapper.netlify.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]);
  const corsOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : '*';

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Headers': event.headers && (event.headers['access-control-request-headers'] || event.headers['Access-Control-Request-Headers'] || 'Content-Type, Authorization, X-Tenant-ID, X-MSP-ID, x-rks-tenantid'),
    'Access-Control-Allow-Methods': event.headers && (event.headers['access-control-request-method'] || event.headers['Access-Control-Request-Method'] || 'GET, POST, PUT, PATCH, DELETE, OPTIONS'),
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
    'Pragma': 'no-cache'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    // Regional API endpoints mapping
    const REGIONAL_ENDPOINTS = {
      na: 'https://api.ruckus.cloud',
      eu: 'https://api.eu.ruckus.cloud',
      asia: 'https://api.asia.ruckus.cloud'
    };

    // Parse the path to determine region and target endpoint
    let path = event.path.replace('/.netlify/functions/api-proxy', '');
    
    // Remove /api prefix if present (for production routing)
    if (path.startsWith('/api')) {
      path = path.substring(4); // Remove '/api'
    }
    
    // Extract region from query parameters or default to 'na'
    const region = event.queryStringParameters?.region || 'na';
    const apiBase = REGIONAL_ENDPOINTS[region];
    
    if (!apiBase) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid region specified' })
      };
    }

    // Construct the target URL with forwarded query params (excluding internal 'region')
    const originalQs = event.queryStringParameters || {};
    // Forward ALL query params, including 'region' (required by upstream to avoid redirects)
    const forwardedParams = Object.keys(originalQs)
      .filter((key) => originalQs[key] !== undefined && originalQs[key] !== null)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(originalQs[key]))}`)
      .join('&');

    let targetUrl = forwardedParams
      ? `${apiBase}${path}?${forwardedParams}`
      : `${apiBase}${path}`;

    // SPECIAL HANDLING: OAuth client_credentials token
    // Normalize to POST /oauth2/token (no tenant in path), enforce body and headers
    const isTokenPath = /\/oauth2\/token(\/[^/?]+)?/i.test(path);
    if (isTokenPath) {
      // Extract tenantId from path if present
      const tenantMatch = path.match(/\/oauth2\/token\/([^/?]+)/i);
      const tenantIdFromPath = tenantMatch ? tenantMatch[1] : undefined;
      const tenantIdHeader = event.headers['x-rks-tenantid'] || event.headers['x-tenant-id'] || tenantIdFromPath;

      // Always call non-tenant endpoint
      targetUrl = `${apiBase}/oauth2/token${forwardedParams ? `?${forwardedParams}` : ''}`;

      // Force method/body/headers for client_credentials
      requestOptions.method = 'POST';
      requestOptions.headers = {
        ...requestOptions.headers,
        'content-type': 'application/x-www-form-urlencoded',
        ...(tenantIdHeader ? { 'x-rks-tenantid': tenantIdHeader, 'x-tenant-id': tenantIdHeader } : {}),
      };
      // Body must be exactly grant_type=client_credentials
      requestOptions.body = 'grant_type=client_credentials';
    }
    
    // Debug logging
    console.log('Proxy request:', {
      method: event.httpMethod,
      path: path,
      region: region,
      apiBase: apiBase,
      targetUrl: targetUrl,
      hasBody: !!event.body
    });
    
    // Prepare headers for the upstream request
    const upstreamHeaders = {};
    
    // Copy relevant headers from the original request
    if (event.headers.authorization) {
      upstreamHeaders.authorization = event.headers.authorization;
    }
    if (event.headers['x-tenant-id']) {
      upstreamHeaders['x-tenant-id'] = event.headers['x-tenant-id'];
    }
    if (event.headers['x-rks-tenantid']) {
      upstreamHeaders['x-rks-tenantid'] = event.headers['x-rks-tenantid'];
    }
    if (event.headers['x-msp-id']) {
      upstreamHeaders['x-msp-id'] = event.headers['x-msp-id'];
    }
    if (event.headers['content-type']) {
      upstreamHeaders['content-type'] = event.headers['content-type'];
    }
    // Ensure a User-Agent is present (some CDNs reject missing UA)
    if (!upstreamHeaders['user-agent']) {
      upstreamHeaders['user-agent'] = 'r1mapper-proxy/1.0';
    }
    // If Basic auth is present from client, preserve it; otherwise allow token shaping to set it if needed.
    
    // Add Accept header for JSON responses
    upstreamHeaders.accept = 'application/json';

    // Prepare the request options
    const requestOptions = {
      method: event.httpMethod,
      headers: upstreamHeaders
    };

    // Add body for POST/PUT/PATCH requests
    if (event.body && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
      // Respect base64 encoding flag from Netlify
      if (event.isBase64Encoded) {
        requestOptions.body = Buffer.from(event.body, 'base64');
      } else {
        requestOptions.body = event.body;
      }
    }

    // Make the request to Ruckus One API using axios only
    let axiosResp = await axios.request({
      method: event.httpMethod,
      url: targetUrl,
      headers: {
        ...upstreamHeaders,
        // Upstream sometimes expects region both in query and header. Send both.
        'x-region': region,
      },
      data: requestOptions.body,
      httpsAgent: new https.Agent({ keepAlive: true }),
      maxRedirects: 0, // avoid upstream redirect loops, surface Location if any
      validateStatus: () => true, // pass through status
    });

    // Follow up to 3 redirects manually when Location is provided
    let redirectHops = 0;
    while (axiosResp.status >= 300 && axiosResp.status < 400 && axiosResp.headers && axiosResp.headers.location && redirectHops < 3) {
      const nextUrl = axiosResp.headers.location.startsWith('http')
        ? axiosResp.headers.location
        : `${apiBase}${axiosResp.headers.location}`;
      redirectHops += 1;
      console.log('Following redirect', { hop: redirectHops, status: axiosResp.status, location: nextUrl });
      axiosResp = await axios.request({
        method: event.httpMethod,
        url: nextUrl,
        headers: {
          ...upstreamHeaders,
          'x-region': region,
        },
        data: requestOptions.body,
        httpsAgent: new https.Agent({ keepAlive: true }),
        maxRedirects: 0,
        validateStatus: () => true,
      });
    }

    // Special case: OAuth token path redirected to authorization (auth-code)
    // Fallback to non-tenant token endpoint with tenant header
    if (
      axiosResp.status >= 300 && axiosResp.status < 400 &&
      axiosResp.headers && axiosResp.headers.location &&
      /\/oauth2\/authorization\//i.test(axiosResp.headers.location) &&
      /\/oauth2\/token\//i.test(path)
    ) {
      const tenantMatch = path.match(/\/oauth2\/token\/([^/?]+)/);
      const tenantIdFromPath = tenantMatch ? tenantMatch[1] : undefined;
      console.log('Fallback: retrying token without tenant path, with tenant header', {
        tenantIdFromPath
      });
      const tokenUrlNoTenant = `${apiBase}/oauth2/token${forwardedParams ? `?${forwardedParams}` : ''}`;
      axiosResp = await axios.request({
        method: 'POST',
        url: tokenUrlNoTenant,
        headers: {
          ...upstreamHeaders,
          'x-region': region,
          ...(tenantIdFromPath ? { 'x-rks-tenantid': tenantIdFromPath, 'x-tenant-id': tenantIdFromPath } : {}),
        },
        data: requestOptions.body,
        httpsAgent: new https.Agent({ keepAlive: true }),
        maxRedirects: 0,
        validateStatus: () => true,
      });
    }

    const axContentType = axiosResp.headers['content-type'] || 'application/json';
    // If upstream sent a redirect, pass along the Location to help diagnose
    const location = axiosResp.headers['location'];
    const axBody = typeof axiosResp.data === 'string' ? axiosResp.data : JSON.stringify(axiosResp.data);

    // Debug logging for response
    console.log('Proxy response:', {
      status: axiosResp.status,
      contentType: axContentType,
      bodyType: typeof axiosResp.data,
      bodyLength: typeof axiosResp.data === 'string' ? axiosResp.data.length : 'object',
      hasLocation: !!axiosResp.headers['location']
    });

    // Return the response
    return {
      statusCode: axiosResp.status,
      headers: { ...headers, 'content-type': axContentType, ...(location ? { Location: location } : {}) },
      body: axBody,
    };

  } catch (error) {
    console.error('Proxy error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};

module.exports = { handler };