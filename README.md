<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This repo ships a Vite + React frontend that talks to serverless helpers via Vercel Serverless Functions.

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the frontend:
   ```bash
   npm run dev
   ```
3. In a second terminal, run the Vercel development environment to exercise `/api` routes:
   ```bash
   npx vercel dev
   ```
   This spins up the same serverless handlers that run on production.

## Deployment on Vercel

- Frontend build command: `npm run build`
- Output directory: `dist`
- Serverless helpers live under the `api/` directory and deploy automatically.

## Required Environment Variables

Set these either via `.env`/`.env.local` for `vercel dev` or through the Vercel dashboard.

| Variable | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY` or `AWS_ACCESS_KEY_ID` | AWS credentials for generating S3 presigned URLs |
| `AWS_SECRET_KEY` or `AWS_SECRET_ACCESS_KEY` | AWS credentials for generating S3 presigned URLs |
| `AWS_REGION` | Region of the bucket (defaults to `ap-southeast-1`) |
| `S3_BUCKET` | Bucket used for uploaded assets (defaults to `prismscales3`) |
| `BRANDING_LAMBDA_URL` | URL of the branding-generation Lambda |
| `BRANDING_API_KEY` | (Optional) API key sent as `x-api-key` to the Lambda |

After adding the variables, deploy on Vercel and the `/api/upload-url` and `/api/generate-branding` endpoints will be reachable from the frontend.
