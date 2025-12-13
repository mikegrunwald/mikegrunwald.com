// Asset URL configuration
// Automatically uses R2 URLs for large assets in production

export const ASSET_BASE_URL = import.meta.env.PUBLIC_R2_URL || '';

// Helper function to get the correct URL for an asset
// For local development or small assets, returns the path as-is
// For production with R2, returns the R2 URL
export function getAssetUrl(path) {
  // If no R2 URL is configured, use relative paths (local/Cloudflare Pages)
  if (!ASSET_BASE_URL) {
    return path;
  }

  // Only use R2 for video files (they're the large ones)
  if (path.startsWith('/video/')) {
    return `${ASSET_BASE_URL}${path}`;
  }

  // Use relative path for everything else
  return path;
}
