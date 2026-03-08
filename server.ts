import express from 'express';
import { createServer as createViteServer } from 'vite';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Initialize S3 Client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY || '',
      secretAccessKey: process.env.AWS_SECRET_KEY || '',
    },
    // Disable automatic checksum generation which adds headers that might be blocked by CORS
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  // API Routes

  // 1. Get Presigned Upload URL
  app.post('/api/upload-url', async (req, res) => {
    console.log('Received upload-url request:', req.body);
    try {
      const { filename, contentType } = req.body;

      if (!filename || !contentType) {
        return res.status(400).json({ error: 'Missing filename or contentType' });
      }

      const accessKeyId = process.env.AWS_ACCESS_KEY;
      const secretAccessKey = process.env.AWS_SECRET_KEY;

      if (!accessKeyId || !secretAccessKey) {
        console.error('Missing AWS Credentials');
        return res.status(500).json({ error: 'AWS Credentials not configured on server' });
      }

      const bucketName = process.env.S3_BUCKET || 'prismscales3';
      const key = `branding-prismscale-assets/${Date.now()}_${filename}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      console.log('Generated upload URL for:', key);
      
      const region = process.env.AWS_REGION || 'ap-southeast-1';
      const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

      res.json({ uploadUrl, fileUrl });
    } catch (error: any) {
      console.error('Error generating presigned URL:', error);
      res.status(500).json({ error: 'Failed to generate upload URL: ' + error.message });
    }
  });

  // 2. Generate Branding Page
  app.post('/api/generate-branding', async (req, res) => {
    try {
      const payload = req.body;
      const lambdaUrl = process.env.BRANDING_LAMBDA_URL;
      const apiKey = process.env.BRANDING_API_KEY;

      if (!lambdaUrl) {
        return res.status(500).json({ error: 'Lambda URL not configured' });
      }

      const response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lambda failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Error calling Lambda:', error);
      res.status(500).json({ error: error.message || 'Failed to generate branding page' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
