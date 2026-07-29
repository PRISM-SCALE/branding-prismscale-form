import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const REGION = process.env.APP_REGION || 'ap-southeast-1';
const BUCKET_NAME = process.env.S3_BUCKET || 'prismscales3';

const createS3Client = () => {
  const accessKeyId = process.env.ACCESS_KEY_ID;
  const secretAccessKey = process.env.SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
};

export const config = { runtime: 'nodejs' };

/**
 * Build an RFC 6266 `attachment` disposition for a user-supplied filename.
 * Quotes, backslashes and anything outside printable ASCII are replaced in the
 * plain `filename`, with the exact name carried by `filename*` for clients that
 * support it. Header values cannot contain CR/LF, so those are stripped too.
 */
const buildAttachmentDisposition = (filename: string): string => {
  const asciiFallback =
    filename
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'download';

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.body) {
    return res.status(400).json({ error: 'Request body is required' });
  }

  const { filename, contentType } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'Missing filename or contentType' });
  }

  const s3Client = createS3Client();

  if (!s3Client) {
    return res.status(500).json({ error: 'AWS credentials are misconfigured' });
  }

  const key = `branding-prismscale-assets/${Date.now()}_${filename}`;

  // Brand pages are served from a different S3 host than the assets, so the
  // anchor `download` attribute is ignored as cross-origin and the browser
  // renders PDFs/docs inline instead of saving them. Content-Disposition is
  // origin-independent, so store it on the object at upload time. It also gives
  // the download the original filename instead of the timestamped key.
  // Only affects navigations - `<img src>` previews ignore it and still render.
  const contentDisposition = buildAttachmentDisposition(filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentDisposition: contentDisposition,
  });

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const fileUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;

    // Returned so the client can echo it on the PUT: it is a signed header, and
    // a missing or differing value fails the signature check.
    return res.status(200).json({ uploadUrl, fileUrl, contentDisposition });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
