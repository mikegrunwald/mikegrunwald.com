# R2 Scripts

This directory contains utility scripts for managing Cloudflare R2 storage.

## Scripts

### `upload-to-r2.js`

Uploads video and image assets to Cloudflare R2 storage.

**Usage:**
```bash
# Automatic (runs during build)
npm run build

# Manual upload only
npm run upload-assets
```

**What it does:**
- Uploads all files from `static/video` and `static/images` to R2
- Sets appropriate MIME types for videos and images
- Maintains directory structure
- Provides upload progress and summary

**Required environment variables:**
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 API token access key
- `R2_SECRET_ACCESS_KEY` - R2 API token secret
- `R2_BUCKET_NAME` - Bucket name (default: mikegrunwald-assets)
- `PUBLIC_R2_URL` - Public URL (default: https://assets.mikegrunwald.com)

---

### `configure-r2-cors.js`

Configures CORS settings for your R2 bucket to enable Decap CMS uploads.

**Usage:**
```bash
npm run configure-r2-cors
```

**When to run:**
- During initial R2 setup
- If Decap CMS shows CORS errors when uploading
- After creating a new R2 bucket
- When adding new domains

**What it does:**
- Displays existing CORS configuration
- Applies CORS rules for allowed origins
- Enables GET, PUT, POST, DELETE, HEAD methods
- Configures localhost and production domains

**Required environment variables:**
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 API token (needs "Edit" permissions)
- `R2_SECRET_ACCESS_KEY` - R2 API token secret
- `R2_BUCKET_NAME` - Bucket name (default: mikegrunwald-assets)

**Modifying allowed origins:**
Edit the `corsConfiguration.CORSRules[0].AllowedOrigins` array in the script.

---

## Documentation

For complete R2 setup instructions, see [R2-SETUP.md](../R2-SETUP.md) in the project root.
