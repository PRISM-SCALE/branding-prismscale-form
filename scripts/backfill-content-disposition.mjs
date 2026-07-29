/**
 * One-off backfill: stamp `Content-Disposition: attachment` onto brand assets
 * that were uploaded before api/upload-url.ts started setting it.
 *
 * Without the header a PNG or PDF opened by a per-asset link on a generated
 * brand page renders in the browser instead of saving, because the page and the
 * assets sit on different S3 hostnames and the anchor `download` attribute is
 * ignored cross-origin. New uploads get the header at PUT time; already-stored
 * objects need this pass.
 *
 * Reads credentials from the same .env the API uses.
 *
 *   node scripts/backfill-content-disposition.mjs            # dry run, writes nothing
 *   node scripts/backfill-content-disposition.mjs --apply    # perform the copies
 *
 * Safe to re-run: objects that already carry a disposition are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

const PREFIX = 'branding-prismscale-assets/';
// The template's own webfonts, loaded by @font-face on every brand page rather
// than offered as downloads. Left alone: nothing links to them as assets.
const SKIP_PREFIX = `${PREFIX}fonts/`;

const APPLY = process.argv.includes('--apply');

const loadEnv = () => {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const fromFile = fs.existsSync(envPath)
    ? Object.fromEntries(
        fs
          .readFileSync(envPath, 'utf8')
          .split(/\r?\n/)
          .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
          .map((line) => [
            line.slice(0, line.indexOf('=')).trim(),
            line.slice(line.indexOf('=') + 1).trim(),
          ])
      )
    : {};
  return { ...fromFile, ...process.env };
};

const env = loadEnv();
const REGION = env.APP_REGION || 'ap-southeast-1';
const BUCKET = env.S3_BUCKET || 'prismscales3';

if (!env.ACCESS_KEY_ID || !env.SECRET_ACCESS_KEY) {
  console.error('ACCESS_KEY_ID / SECRET_ACCESS_KEY missing from .env and environment.');
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: { accessKeyId: env.ACCESS_KEY_ID, secretAccessKey: env.SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/**
 * Same encoder as api/upload-url.ts, kept in sync deliberately: the value has to
 * be identical whether a file gets the header at upload time or from this pass.
 */
const buildAttachmentDisposition = (filename) => {
  const asciiFallback =
    filename
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'download';

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

/** Keys are `<epoch-ms>_<original name>`; recover the name the user uploaded. */
const originalFilename = (key) => {
  const basename = key.slice(key.lastIndexOf('/') + 1);
  const match = basename.match(/^\d{10,}_(.+)$/);
  return match ? match[1] : basename;
};

const listAll = async () => {
  const keys = [];
  let token;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token })
    );
    for (const object of page.Contents || []) {
      if (object.Key.endsWith('/') || object.Key.startsWith(SKIP_PREFIX)) continue;
      keys.push(object);
    }
    token = page.NextContinuationToken;
  } while (token);
  return keys;
};

console.log(`bucket=${BUCKET} region=${REGION} prefix=${PREFIX}`);
console.log(APPLY ? 'mode=APPLY (objects will be rewritten)\n' : 'mode=DRY RUN (nothing is written)\n');

const objects = await listAll();
console.log(`${objects.length} objects in scope (fonts/ excluded)\n`);

const stats = { already: 0, updated: 0, planned: 0, failed: 0, oddStorage: 0, extraMeta: 0 };

/** Round trips to the bucket dominate the runtime; a few in flight keeps it brisk. */
const CONCURRENCY = 8;

const processOne = async (object) => {
  const key = object.Key;
  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (error) {
    stats.failed += 1;
    console.log(`HEAD FAILED  ${key}  ${error.name}`);
    return;
  }

  if (head.ContentDisposition) {
    stats.already += 1;
    return;
  }

  // CopyObject rewrites the whole metadata set, so anything not passed back is
  // dropped. Flag the cases worth eyeballing before a bulk pass.
  if (head.StorageClass && head.StorageClass !== 'STANDARD') {
    stats.oddStorage += 1;
    console.log(`SKIP storage=${head.StorageClass}  ${key}`);
    return;
  }
  if (head.Metadata && Object.keys(head.Metadata).length) stats.extraMeta += 1;

  const disposition = buildAttachmentDisposition(originalFilename(key));

  if (!APPLY) {
    stats.planned += 1;
    if (stats.planned <= 10) {
      console.log(`WOULD SET  ${key}\n           type=${head.ContentType}  ->  ${disposition}`);
    }
    return;
  }

  try {
    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        Key: key,
        // CopySource travels as an HTTP header and must be URL-encoded: keys
        // holding non-ASCII (a `©` in a photo credit, an emoji) otherwise fail
        // the signature check or are rejected as an invalid header value.
        CopySource: `${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`,
        MetadataDirective: 'REPLACE',
        ContentDisposition: disposition,
        // Everything below is carried over by hand, since REPLACE discards the
        // existing values.
        ContentType: head.ContentType,
        ...(head.CacheControl ? { CacheControl: head.CacheControl } : {}),
        ...(head.ContentEncoding ? { ContentEncoding: head.ContentEncoding } : {}),
        ...(head.ContentLanguage ? { ContentLanguage: head.ContentLanguage } : {}),
        ...(head.Metadata && Object.keys(head.Metadata).length ? { Metadata: head.Metadata } : {}),
        ...(head.ServerSideEncryption ? { ServerSideEncryption: head.ServerSideEncryption } : {}),
      })
    );
    stats.updated += 1;
    if (stats.updated % 50 === 0) console.log(`  ...${stats.updated} updated`);
  } catch (error) {
    stats.failed += 1;
    console.log(`COPY FAILED  ${key}  ${error.name}: ${error.message}`);
  }
};

const queue = [...objects];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await processOne(queue.pop());
  })
);

console.log('\n=== summary ===');
console.log(`already had disposition: ${stats.already}`);
console.log(APPLY ? `updated: ${stats.updated}` : `would update: ${stats.planned}`);
console.log(`objects carrying custom metadata (preserved): ${stats.extraMeta}`);
console.log(`skipped, non-standard storage class: ${stats.oddStorage}`);
console.log(`failed: ${stats.failed}`);
if (!APPLY) console.log('\nRe-run with --apply to write.');
