import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const API_KEY = env.DATA_GOV_IN_API_KEY;
const RESOURCE_ID = '6176ee09-3d56-4a3b-8115-21841576b2f6';

createServer(async (req, res) => {
  const match = req.url?.match(/^\/api\/pincode\/(\d{6})$/);

  if (!match || req.method !== 'GET') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  const code = match[1];

  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'DATA_GOV_IN_API_KEY not set in .env.local' }));
  }

  try {
    const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=1&filters%5Bpincode%5D=${code}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok' || !data.records?.length) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Pincode not found' }));
    }

    const record = data.records[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pincode: record.pincode,
      city: record.districtname,
      state: record.statename,
      office: record.officename,
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(3000, () => console.log('Pincode API dev server on http://localhost:3000'));
