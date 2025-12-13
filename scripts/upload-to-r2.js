import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// R2 Configuration from environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mikegrunwald-assets';
const R2_PUBLIC_URL = process.env.PUBLIC_R2_URL || `https://assets.mikegrunwald.com`;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.');
  process.exit(1);
}

// Configure S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});


// Get MIME type based on extension
function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Recursively find all files in a directory
function findFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Upload a file to R2
async function uploadToR2(filePath, key) {
  const fileContent = readFileSync(filePath);
  const contentType = getMimeType(filePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Uploaded: ${key}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to upload ${key}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  const staticDir = join(__dirname, '..', 'static');
  const videoDir = join(staticDir, 'video');
  const imagesDir = join(staticDir, 'images');

  console.log('🚀 Starting R2 upload for large assets...\n');

  // Find all files in video and images directories
  const directories = [videoDir, imagesDir];
  let uploadedFiles = [];

  for (const dir of directories) {
    const files = findFiles(dir);

    for (const filePath of files) {
      const stat = statSync(filePath);
      const fileSize = stat.size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      // Get relative path from static directory
      const relativePath = relative(staticDir, filePath);
      const key = relativePath.replace(/\\/g, '/'); // Normalize path separators

      console.log(`Uploading ${key} (${fileSizeMB} MB)...`);
      const success = await uploadToR2(filePath, key);
      if (success) {
        uploadedFiles.push({
          path: `/${key}`,
          r2Url: `${R2_PUBLIC_URL}/${key}`,
          size: fileSizeMB
        });
      }
    }
  }

  console.log('\n📊 Upload Summary:');
  console.log(`✓ Uploaded ${uploadedFiles.length} files to R2\n`);

  if (uploadedFiles.length > 0) {
    console.log('📝 Files uploaded to R2:');
    uploadedFiles.forEach(file => {
      console.log(`  ${file.path} (${file.size} MB)`);
    });
  }
}

main().catch(console.error);
