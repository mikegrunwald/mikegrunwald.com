# R2 Media Integration for Decap CMS

This setup allows you to upload images and videos directly to Cloudflare R2 from the Decap CMS admin interface.

## How It Works

### Architecture

1. **Custom Widget** ([r2-media-widget.js](./widgets/r2-media-widget.js))
   - Provides a tabbed interface for uploading new files or browsing existing ones
   - Handles direct uploads to R2 using presigned URLs
   - Shows previews for images and video icons

2. **API Routes** (SvelteKit)
   - `/api/r2/presigned-url` - Generates secure presigned URLs for uploads
   - `/api/r2/list-files` - Lists existing files in your R2 bucket

3. **Security**
   - R2 credentials are stored server-side only (never exposed to browser)
   - Presigned URLs are time-limited (5 minutes)
   - Files are sanitized before upload

## Setup Instructions

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your R2 credentials:

```bash
cp .env.example .env
```

Required variables:
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 API token access key
- `R2_SECRET_ACCESS_KEY` - R2 API token secret
- `R2_BUCKET_NAME` - Your R2 bucket name (default: mikegrunwald-assets)
- `PUBLIC_R2_URL` - Your R2 public URL (e.g., https://assets.mikegrunwald.com)

### 2. How to Get R2 Credentials

1. Go to Cloudflare Dashboard > R2
2. Create or select your bucket
3. Go to "Manage R2 API Tokens"
4. Create a new API token with:
   - Permissions: Read & Write
   - Bucket: Your specific bucket (or all buckets)
5. Copy the Access Key ID and Secret Access Key

### 3. Configure R2 Bucket Public Access

For the public URL to work:
1. Go to your R2 bucket settings
2. Connect a custom domain OR use Cloudflare's public bucket URL
3. Update `PUBLIC_R2_URL` in your `.env`

## Using the Widget

### In Decap CMS

1. Edit a project in the admin interface
2. Find the "Media" field
3. Click "Add Media"
4. You'll see two tabs:

   **Upload New:**
   - Click to select an image or video file
   - File uploads directly to R2
   - Returns the public URL automatically

   **Browse Existing:**
   - View all files currently in R2
   - Search by filename
   - Click a file to select it
   - Shows thumbnails for images, icons for videos

### Local Development Mode

When running `npm run dev` with `local_backend: true`:
- The widget will detect local mode
- New uploads still work (via API routes)
- You can browse and select existing R2 files
- No files are committed to Git

### Production Mode

When deployed:
- Files upload directly to R2 (no Git involvement)
- Media URLs are stored in your markdown/JSON files
- Large files stay in R2, not in your repository

## File Organization

Uploaded files are organized by type:
- Images: `images/[timestamp]-[filename]`
- Videos: `video/[timestamp]-[filename]`

## Fallback Behavior

If R2 API is unavailable:
- Widget falls back to reading from `/src/lib/r2-manifest.js`
- Shows existing files that were previously uploaded
- Displays helpful error messages

## Troubleshooting

### "R2 credentials not configured"
- Check that your `.env` file exists and has all required variables
- Restart your dev server after updating `.env`

### "Failed to upload file to R2"
- Verify your R2 API token has write permissions
- Check that the bucket name is correct
- Ensure presigned URLs aren't blocked by CORS

### Files don't appear in browse tab
- Wait a few seconds after upload (refresh is automatic)
- Check that files were successfully uploaded to R2
- Verify `PUBLIC_R2_URL` is correct

## Security Notes

- Never commit `.env` to Git (it's in `.gitignore`)
- R2 credentials are only used server-side in API routes
- Presigned URLs expire after 5 minutes
- Filenames are sanitized to prevent path traversal attacks
