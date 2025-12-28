import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function GET({ url }) {
  // Get R2 credentials from environment
  const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
  const R2_BUCKET_NAME = env.R2_BUCKET_NAME || 'mikegrunwald-assets';
  const R2_PUBLIC_URL = env.PUBLIC_R2_URL || 'https://assets.mikegrunwald.com';

  // Check if R2 credentials are available
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return json({
      error: 'R2 credentials not configured. Running in local mode.',
      files: []
    }, { status: 503 });
  }

  try {
    const prefix = url.searchParams.get('prefix') || '';
    const maxKeys = parseInt(url.searchParams.get('maxKeys') || '100', 10);
    const continuationToken = url.searchParams.get('continuationToken') || undefined;

    // Configure S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    const files = (response.Contents || []).map(item => ({
      key: item.Key,
      url: `${R2_PUBLIC_URL}/${item.Key}`,
      size: item.Size,
      lastModified: item.LastModified,
      isImage: /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.Key),
      isVideo: /\.(mp4|mov|webm)$/i.test(item.Key),
    }));

    return json({
      files,
      total: files.length,
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken || null,
    });
  } catch (error) {
    console.error('Error listing R2 files:', error);
    return json({ error: 'Failed to list R2 files', files: [] }, { status: 500 });
  }
}
