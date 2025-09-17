const fetch = require('node-fetch');

// Regional API endpoints mapping
const REGIONAL_ENDPOINTS = {
  na: 'https://api.ruckus.cloud',
  eu: 'https://api.eu.ruckus.cloud',
  asia: 'https://api.asia.ruckus.cloud'
};

exports.handler = async (event, context) => {
  // Enable CORS for browser requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-MSP-ID, x-rks-tenantid',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
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

    // Construct the target URL (forward all query params like region)
    const qsObj = event.queryStringParameters || {};
    const qs = Object.keys(qsObj)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(qsObj[k]))}`)
      .join('&');
    let targetUrl = qs ? `${apiBase}${path}?${qs}` : `${apiBase}${path}`;
    
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
    
    // Add Accept header for JSON responses
    upstreamHeaders.accept = 'application/json';

    // Prepare the request options
    const requestOptions = {
      method: event.httpMethod,
      headers: upstreamHeaders,
      redirect: 'follow'
    };

    // Add body for POST/PUT requests
    if (event.body && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
      requestOptions.body = event.body;
    }

    // If token call, normalize to non-tenant endpoint immediately and avoid following auth redirects
    const tokenMatch = path.match(/\/oauth2\/token\/([^/?]+)/i);
    if (tokenMatch) {
      const tenantIdFromPath = tokenMatch[1];
      // Force non-tenant token endpoint; do not include query params
      targetUrl = `${apiBase}/oauth2/token`;
      requestOptions.method = 'POST';
      requestOptions.redirect = 'manual';
      requestOptions.headers['content-type'] = requestOptions.headers['content-type'] || 'application/x-www-form-urlencoded';
      requestOptions.headers['x-rks-tenantid'] = requestOptions.headers['x-rks-tenantid'] || tenantIdFromPath;
      requestOptions.headers['x-tenant-id'] = requestOptions.headers['x-tenant-id'] || tenantIdFromPath;
    }

    // Make the request to Ruckus One API (with token fallback like r1helper)
    let response = await fetch(targetUrl, requestOptions);

    // If this is a token call with tenant in path and upstream rejects/redirects, retry non-tenant endpoint with tenant headers
    if (tokenMatch && response.status >= 300) {
      const tenantIdFromPath = tokenMatch[1];
      const fallbackUrl = `${apiBase}/oauth2/token`;
      const fallbackHeaders = { ...requestOptions.headers };
      // Ensure form content-type and tenant headers are present
      fallbackHeaders['content-type'] = fallbackHeaders['content-type'] || 'application/x-www-form-urlencoded';
      fallbackHeaders['x-rks-tenantid'] = fallbackHeaders['x-rks-tenantid'] || tenantIdFromPath;
      fallbackHeaders['x-tenant-id'] = fallbackHeaders['x-tenant-id'] || tenantIdFromPath;
      const fallbackInit = {
        method: 'POST',
        headers: fallbackHeaders,
        body: requestOptions.body,
        redirect: 'manual'
      };
      response = await fetch(fallbackUrl, fallbackInit);
    }
    
    // Get response body and handle different content types
    let responseBody;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
    } catch (parseError) {
      console.error('Response parsing error:', parseError.message);
      responseBody = await response.text();
    }

    // For errors, surface upstream details directly as JSON for debugging
    if (response.status >= 400) {
      const headersObj = {};
      response.headers.forEach((v, k) => { headersObj[k] = v; });
      const snippet = typeof responseBody === 'string' ? responseBody.slice(0, 2000) : JSON.stringify(responseBody).slice(0, 2000);
      return {
        statusCode: response.status,
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ status: response.status, headers: headersObj, body: snippet })
      };
    }

    // Success passthrough
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'content-type': contentType || 'application/json'
      },
      body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)
    };

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};