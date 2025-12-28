```
_  _ _ _  _ ____ ____ ____ _  _ _  _ _ _ _ ____ _    ___   ____ ____ _  _
|\/| | |_/  |___ | __ |__/ |  | |\ | | | | |__| |    |  \  |    |  | |\/|
|  | | | \_ |___ |__] |  \ |__| | \| |_|_| |  | |___ |__/ .|___ |__| |  |
```

---

## CMS Media Management

This project uses [Decap CMS](https://decapcms.org/) with a smart media upload system that routes files based on size and type.

### Upload Routing

* **Videos** (all sizes) → Cloudflare R2 storage
* **Large images** (>25MB) → Cloudflare R2 storage
* **Small images** (<25MB) → Git repository (`static/uploads/`)

<!-- ### Storage Locations
* **Cloudflare R2:** `https://assets.mikegrunwald.com/`
  + Videos: `/video/[timestamp]-[filename]`
  + Images: `/images/[timestamp]-[filename]`
* **Git Repository:** `static/uploads/[filename]`
  + Public path: `/uploads/[filename]`

### CMS Widget Features

* **Upload New:** Smart routing based on file type/size
* **Browse R2:** View and reuse files stored in Cloudflare R2
* **Manual URL:** Direct URL input for external media

### Configuration

* CMS config: `static/admin/config.yml`
* Custom widget: `static/admin/widgets/smart-media-widget.js`
* R2 credentials: `.env` (see `.env.example`)

### API Endpoints

* `GET /api/r2/list-files` - List R2 bucket contents
* `POST /api/r2/presigned-url` - Generate upload URLs for R2

For detailed R2 setup instructions, see [static/admin/R2_MEDIA_SETUP.md](static/admin/R2_MEDIA_SETUP.md) -->

---

# todos/notes:
* [ ] logo preloader inspiration: https://www.gentlerain.ai/
* [ ] use this effect on the video/placeholder: https://codepen.io/jh3y/pen/WNmQXyE
* [ ] add sound effects to hovers, clicks and other interactions 
