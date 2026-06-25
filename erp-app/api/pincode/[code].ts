const RESOURCE_ID = '6176ee09-3d56-4a3b-8115-21841576b2f6';

interface PincodeRecord {
  district: string;
  statename: string;
  pincode: string;
  officename: string;
}

interface GovApiResponse {
  success: boolean;
  records: PincodeRecord[];
  total: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be a 6-digit number.' });
  }

  const apiKey = process.env.DATA_GOV_IN_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${apiKey}&format=json&limit=1&filters%5Bpincode%5D=${code}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `data.gov.in returned ${response.status}` });
    }

    const data: GovApiResponse = await response.json();

    if (!data.success || !data.records?.length) {
      return res.status(404).json({ error: 'Pincode not found' });
    }

    const record = data.records[0];

    return res.status(200).json({
      pincode: record.pincode,
      city: record.district,
      state: record.statename,
      office: record.officename,
    });
  } catch (err) {
    console.error('Pincode lookup failed:', err);
    return res.status(500).json({ error: 'Failed to look up pincode' });
  }
}
