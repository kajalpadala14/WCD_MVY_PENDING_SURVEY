// Vercel Serverless Function to proxy requests to Google Apps Script / Google Sheet
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_WEBAPP_URL || "https://script.google.com/macros/s/AKfycby4MhsULd3Q0-lrFGy-EE2D5uwk35jLHPmxknwv8uP7pPOz2DJ8PU64GCMRVDqPYLB1kg/exec";

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract action from query or path
  // E.g. /api/getBeneficiaries or /api?action=getBeneficiaries
  const urlParts = req.url.split('?');
  const pathname = urlParts[0].replace('/api/', '').replace('/api', '');
  const searchParams = new URLSearchParams(urlParts[1] || '');

  let action = pathname || searchParams.get('action') || '';
  if (action) {
    searchParams.set('action', action);
  }

  try {
    if (req.method === 'GET') {
      const targetUrl = `${APPS_SCRIPT_URL}?${searchParams.toString()}`;
      const response = await fetch(targetUrl, { redirect: 'follow' });
      const data = await response.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(data);
    } else if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        redirect: 'follow'
      });
      const data = await response.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(data);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Vercel API Proxy Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
