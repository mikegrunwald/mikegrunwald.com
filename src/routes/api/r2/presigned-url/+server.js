import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
  // Get R2 credentials from environment
  const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
  const R2_BUCKET_NAME = env.R2_BUCKET_NAME || 'mikegrunwald-assets';
  const R2_PUBLIC_URL = env.PUBLIC_R2_URL || 'https://assets.mikegrunwald.com';

  // Check if R2 credentials are available
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return json({
      error: 'R2 credentials not configured. Running in local mode.'
    }, { status: 503 });
  }

  try {
    const { filename, contentType, folder = 'uploads' } = await request.json();

    if (!filename) {
      return json({ error: 'Filename is required' }, { status: 400 });
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${Date.now()}-${sanitizedFilename}`;

    // Configure S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // Generate presigned URL valid for 5 minutes
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return json({
      presignedUrl,
      publicUrl: `${R2_PUBLIC_URL}/${key}`,
      key,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}
