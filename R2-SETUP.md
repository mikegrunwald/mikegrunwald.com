# Cloudflare R2 Setup Guide

<!-- This guide will help you set up Cloudflare R2 to automatically host large video files that exceed Cloudflare Pages' 25MB file limit.

## What This Does

The build process now automatically:
1. Uploads files larger than 25MB to Cloudflare R2
2. Updates your components to reference R2 URLs in production
3. Keeps small files on Cloudflare Pages for optimal performance

## Setup Steps

### 1. Create an R2 Bucket

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name it `mikegrunwald-assets` (or your preferred name)
5. Click **Create bucket**

### 2. Create R2 API Token

1. In R2, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Give it a name like "Build Upload Token"
4. Set permissions: **Object Read & Write**
5. Select your bucket or choose "Apply to all buckets"
6. Click **Create API token**
7. **Save these credentials** (you won't see them again):
   - Access Key ID
   - Secret Access Key
   - Your Account ID (in the URL or shown on the page)

### 3. Set Up Public Access (Custom Domain - Recommended)

Option A: **Custom Domain (Recommended)**
1. In your R2 bucket settings, click **Settings** → **Public access**
2. Click **Connect domain**
3. Enter a subdomain like `assets.mikegrunwald.com`
4. Cloudflare will automatically configure DNS
5. Use this URL as your `PUBLIC_R2_URL`

Option B: **R2.dev Domain**
1. In your R2 bucket settings, click **Settings** → **Public access**
2. Enable **Allow Access** and copy the R2.dev URL
3. Use this as your `PUBLIC_R2_URL` (looks like `https://pub-xxxxx.r2.dev`)

### 4. Configure Environment Variables

#### Local Development

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=mikegrunwald-assets
PUBLIC_R2_URL=https://assets.mikegrunwald.com
```

#### Production (Cloudflare Pages)

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment variables**
3. Add the following variables for **Production**:
   - `R2_ACCOUNT_ID`

   - `R2_ACCESS_KEY_ID`

   - `R2_SECRET_ACCESS_KEY`

   - `R2_BUCKET_NAME`

   - `PUBLIC_R2_URL`

### 5. Install Dependencies

```bash
npm install
```

### 6. Build and Deploy

```bash
npm run build
```

This will:
1. Build your SvelteKit app
2. Automatically upload files >25MB to R2
3. Show you which files were uploaded -->

## How It Works

### Build Process

The `npm run build` command now:
1. Runs `vite build` to create your production build
2. Runs `upload-assets` script that scans for large files
3. Uploads files >25MB to R2
4. Logs what was uploaded

### URL Resolution

The `getAssetUrl()` helper in `src/lib/config.js` :
* **Development**: Returns local paths (e.g.,  `/video/file.mp4`)
* **Production with R2**: Returns R2 URLs (e.g., `https://assets.mikegrunwald.com/video/file.mp4`)
* **Production without R2**: Falls back to local paths

### Usage in Components

```svelte
<script>
  import { getAssetUrl } from '$lib/config.js';
</script>

<video src={getAssetUrl('/video/operation-tripod.mp4')} />
```

## Updating Other Pages

To use R2 URLs on other pages with videos, update them like this:

```svelte
<script>
  import { getAssetUrl } from '$lib/config.js';
</script>

<video
  src={getAssetUrl('/video/your-video.mp4')}
  poster={getAssetUrl('/images/poster.png')}
/>
```

## Local Development

For local development, you can:

**Option 1**: Don't set `PUBLIC_R2_URL` in your `.env`

* Assets will be served locally from `static/`

**Option 2**: Use `npm run build:local`

* Builds without uploading to R2
* Useful for testing the build locally

## Troubleshooting

### Files still 404ing?

* Check that environment variables are set in Cloudflare Pages
* Verify R2 bucket is publicly accessible
* Check browser network tab for the actual URL being requested

### Upload script failing?

* Verify your R2 credentials are correct
* Check that the bucket exists
* Ensure you have write permissions

### Want to skip R2 upload?

```bash
npm run build:local
```

## File Size Threshold

Currently set to 25MB in `scripts/upload-to-r2.js` . Files larger than this are uploaded to R2, smaller files remain on Cloudflare Pages for better performance.

To change this, edit the `SIZE_THRESHOLD` in `scripts/upload-to-r2.js` :

```javascript
const SIZE_THRESHOLD = 25 * 1024 * 1024; // 25MB in bytes
```
