import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs' };

const REGION = process.env.APP_REGION || 'ap-southeast-1';
const BUCKET_NAME = process.env.S3_BUCKET || 'prismscales3';
const PREFIX = 'branding-prismscale/';

const createS3Client = () => {
  const accessKeyId = process.env.ACCESS_KEY_ID;
  const secretAccessKey = process.env.SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: REGION,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const s3Client = createS3Client();
  if (!s3Client) {
    return res.status(500).json({ error: 'AWS credentials not configured' });
  }

  try {
    const clients: string[] = [];
    let continuationToken: string | undefined;

    do {
      const cmd = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: PREFIX,
        Delimiter: '/',
        ContinuationToken: continuationToken,
      });
      const response = await s3Client.send(cmd);

      for (const cp of response.CommonPrefixes ?? []) {
        if (cp.Prefix) {
          const name = cp.Prefix.slice(PREFIX.length).replace(/\/$/, '');
          if (name) clients.push(name);
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    clients.sort();
    return res.status(200).json({ clients });
  } catch (err) {
    console.error('list-clients error:', err);
    return res.status(500).json({ error: 'Failed to list clients' });
  }
}
