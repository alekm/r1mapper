// Simple fetch-based API proxy for Netlify Functions (Node 18+ has global fetch)

const REGIONAL_ENDPOINTS = {
  na: 'https://api.ruckus.cloud',
  eu: 'https://api.eu.ruckus.cloud',
  asia: 'https://api.asia.ruckus.cloud'
};

module.exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-MSP-ID, x-rks-tenantid',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // Derive API base
    const qsObj = event.queryStringParameters || {};
    const region = qsObj.region || 'na';
    const apiBase = REGIONAL_ENDPOINTS[region] || REGIONAL_ENDPOINTS.na;

    // Normalize path
    let path = event.path.replace('/.netlify/functions/api-proxy', '');
    if (path.startsWith('/api')) path = path.substring(4);

    // Rebuild query string (forward everything)
    const qs = Object.keys(qsObj)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(qsObj[k]))}`)
      .join('&');
    const targetUrl = qs ? `${apiBase}${path}?${qs}` : `${apiBase}${path}`;

    // Forward relevant headers
    const upstreamHeaders = {};
    const h = event.headers || {};
    if (h.authorization) upstreamHeaders.authorization = h.authorization;
    if (h['x-tenant-id']) upstreamHeaders['x-tenant-id'] = h['x-tenant-id'];
    if (h['x-rks-tenantid']) upstreamHeaders['x-rks-tenantid'] = h['x-rks-tenantid'];
    if (h['x-msp-id']) upstreamHeaders['x-msp-id'] = h['x-msp-id'];
    if (h['content-type']) upstreamHeaders['content-type'] = h['content-type'];
    upstreamHeaders.accept = h.accept || '*/*';

    // Build fetch init; follow redirects like browser
    const init = {
      method: event.httpMethod,
      headers: upstreamHeaders,
      redirect: 'follow'
    };

    if (event.body && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
      init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    }

    const resp = await fetch(targetUrl, init);
    const contentType = resp.headers.get('content-type') || 'application/json';

    let body;
    try {
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        body = JSON.stringify(data);
      } else {
        body = await resp.text();
      }
    } catch {
      body = await resp.text();
    }

    // For errors, surface upstream details directly in JSON so it’s visible in the browser
    if (resp.status >= 400) {
      const headersObj = {};
      for (const [k, v] of resp.headers) headersObj[k] = v;
      const snippet = typeof body === 'string' ? body.slice(0, 2000) : String(body).slice(0, 2000);
      return {
        statusCode: resp.status,
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ status: resp.status, headers: headersObj, body: snippet })
      };
    }

    return {
      statusCode: resp.status,
      headers: { ...headers, 'content-type': contentType },
      body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: String(err && err.message) })
    };
  }
};