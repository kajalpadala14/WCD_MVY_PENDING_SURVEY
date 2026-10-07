const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 1. Read .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          env[key] = val;
        }
      }
    });
  }
  return env;
}

const env = loadEnv();
const PORT = process.env.PORT || env.PORT || 8080;
const APPS_SCRIPT_URL = env.APPS_SCRIPT_WEBAPP_URL || '';

console.log(`[ENV] Connected APPS_SCRIPT_WEBAPP_URL: ${APPS_SCRIPT_URL ? APPS_SCRIPT_URL : 'Not configured'}`);

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Helper using native fetch (handles redirects automatically and robustly)
async function fetchWithRedirect(targetUrl, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
    redirect: 'follow'
  };
  if (options.body) {
    fetchOptions.body = options.body;
  }
  const response = await fetch(targetUrl, fetchOptions);
  const data = await response.text();
  return {
    statusCode: response.status,
    data: data,
    headers: Object.fromEntries(response.headers.entries())
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // --- API Proxy Endpoints (Connects Localhost to Google Apps Script / Sheet) ---
  if (pathname.startsWith('/api/')) {
    const apiAction = pathname.replace('/api/', '');

    if (!APPS_SCRIPT_URL) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'APPS_SCRIPT_WEBAPP_URL is not configured in .env' }));
      return;
    }

    try {
      if (req.method === 'GET') {
        const queryParams = new URLSearchParams(parsedUrl.query);
        queryParams.set('action', apiAction);
        const remoteTarget = `${APPS_SCRIPT_URL}?${queryParams.toString()}`;

        const remoteRes = await fetchWithRedirect(remoteTarget, { method: 'GET' });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(remoteRes.data);
        return;
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const remoteRes = await fetchWithRedirect(APPS_SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body
            });
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(remoteRes.data);
          } catch (postErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: postErr.message }));
          }
        });
        return;
      }
    } catch (err) {
      console.error('[API Proxy Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // --- Static Files Server ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 WCD MVY Pending Survey Server Running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📊 Google Sheet Live API: ${APPS_SCRIPT_URL ? 'Connected' : 'Missing URL in .env'}`);
  console.log(`====================================================`);
});
