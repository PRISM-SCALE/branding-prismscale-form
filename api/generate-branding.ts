import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs' };

const lambdaUrl = process.env.BRANDING_LAMBDA_URL;
const apiKey = process.env.BRANDING_API_KEY;

interface BrandingResponse {
  status: string;
  s3_url: string;
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!lambdaUrl) {
    return res.status(500).json({ error: 'Lambda URL not configured' });
  }

  const body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Request body is required' });
  }

  try {
    const deployResponse = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('Lambda error:', errorText);
      return res.status(500).json({ error: `Lambda failed with status ${deployResponse.status}: ${errorText}` });
    }

    const data = (await deployResponse.json()) as BrandingResponse;
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error calling lambda:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate branding page' });
  }
}
