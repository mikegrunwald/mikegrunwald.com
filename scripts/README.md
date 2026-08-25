# Asset Scripts

Everything that turns authored content into the files the site actually serves,
plus the Cloudflare R2 plumbing that hosts them.

`.githooks/pre-push` runs `media` then `upload-assets` on every push to `main`,
so in normal use you never run these by hand. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

## Scripts

### `encode-media.js`

Generates the derived media for every entry in `src/content/work`: a 540p / ≤16s
carousel **teaser** from the first video in `media`, and a 768px **archive thumb**
from the first image. Needs local `ffmpeg` — Cloudflare's builder has none.

**Usage:**

```bash
npm run media
npm run media -- --force          # re-encode even if the output exists
npm run media -- --only=thumbs    # or --only=teasers
```

**What it does:**

- Teasers → `static/video/teasers/<slug>.mp4`, plus a `teaser:` frontmatter field.
  Gitignored (`*.mp4`); served from R2 in production.
- Thumbs → `static/images/projects/archive/<slug>.webp`. **Committed**, because
  `/work` is prerendered and its loader checks the file exists at build time.
- Skips anything already encoded, so re-running is cheap.

---

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

- Uploads files from `static/video` and `static/images` that R2 doesn't already
  have (compares size; `npm run upload-assets -- --force` re-uploads everything)
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
