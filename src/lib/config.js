// Asset URL configuration
// Automatically uses R2 URLs for large assets in production

// Use environment variable if available, otherwise fallback to production R2 URL
const R2_URL = import.meta.env.PUBLIC_R2_URL || 'https://assets.mikegrunwald.com';
const IS_DEV = import.meta.env.DEV;

export const ASSET_BASE_URL = IS_DEV ? '' : R2_URL;

// Helper function to get the correct URL for an asset
// For local development, returns the path as-is
// For production with R2, returns the R2 URL for large files
export function getAssetUrl(path) {
  // In development, always use local paths
  if (IS_DEV) {
    return path;
  }

  // In production, use R2 for video files (they're the large ones)
  if (path.startsWith('/video/') || path.startsWith('/images/projects/')) {
    return `${ASSET_BASE_URL}${path}`;
  }

  // Use relative path for everything else
  return path;
}
