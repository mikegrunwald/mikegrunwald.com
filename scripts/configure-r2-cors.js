/**
 * Configure CORS for Cloudflare R2 Bucket
 *
 * This script configures Cross-Origin Resource Sharing (CORS) settings for your R2 bucket.
 * This is required to allow the Decap CMS admin interface to upload files directly to R2.
 *
 * Purpose:
 * - Sets CORS rules to allow uploads from your website and localhost
 * - Enables Decap CMS media library to work with R2
 * - Allows cross-origin access to R2 assets from your domains
 *
 * When to Run:
 * - Once during initial R2 bucket setup
 * - After creating a new R2 bucket
 * - When adding new allowed origins (domains)
 * - If Decap CMS cannot upload files (CORS errors in browser console)
 *
 * Usage:
 * Run: `npm run configure-r2-cors`
 *
 * Requirements:
 * - R2_ACCOUNT_ID: Your Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token with EDIT permissions
 * - R2_SECRET_ACCESS_KEY: R2 API token secret
 * - R2_BUCKET_NAME: Name of your R2 bucket (default: mikegrunwald-assets)
 *
 * Environment Variables:
 * Set these in your .env file (see .env.example)
 *
 * CORS Configuration:
 * - Allows methods: GET, PUT, POST, DELETE, HEAD
 * - Allowed origins: localhost (dev) and production domains
 * - Modify corsConfiguration in this file to add/remove origins
 *
 * Troubleshooting:
 * - If you get permission errors, ensure your R2 API token has "Edit" permissions
 * - Check that R2_BUCKET_NAME matches your actual bucket name
 * - Verify credentials are correct in .env file
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mikegrunwald-assets';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing R2 credentials in .env file');
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

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://mikegrunwald.com',
        'https://www.mikegrunwald.com',
      ],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function configureCORS() {
  try {
    console.log(`🔧 Configuring CORS for R2 bucket: ${R2_BUCKET_NAME}\n`);

    // Check existing CORS configuration
    try {
      const existingCors = await s3Client.send(
        new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME })
      );
      console.log('📋 Existing CORS configuration:');
      console.log(JSON.stringify(existingCors.CORSRules, null, 2));
      console.log();
    } catch (error) {
      if (error.name === 'NoSuchCORSConfiguration') {
        console.log('📋 No existing CORS configuration found\n');
      } else {
        throw error;
      }
    }

    // Apply new CORS configuration
    const command = new PutBucketCorsCommand({
      Bucket: R2_BUCKET_NAME,
      CORSConfiguration: corsConfiguration,
    });

    await s3Client.send(command);

    console.log('✅ CORS configuration applied successfully!\n');
    console.log('📝 New CORS rules:');
    console.log(JSON.stringify(corsConfiguration.CORSRules, null, 2));
    console.log();
    console.log('🎉 Your R2 bucket now accepts uploads from:');
    corsConfiguration.CORSRules[0].AllowedOrigins.forEach((origin) => {
      console.log(`   - ${origin}`);
    });
    console.log();
    console.log('💡 You can now upload files from the Decap CMS admin interface!');
  } catch (error) {
    console.error('❌ Error configuring CORS:', error);
    console.error();
    console.error('Troubleshooting:');
    console.error('1. Verify your R2 API token has "Edit" permissions');
    console.error('2. Check that the bucket name is correct:', R2_BUCKET_NAME);
    console.error('3. Ensure your R2 credentials are valid');
    process.exit(1);
  }
}

configureCORS();
