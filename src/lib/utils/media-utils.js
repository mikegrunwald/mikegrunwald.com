/**
 * Media type detection utilities
 * Shared between Svelte components and admin widgets
 */

export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov'];
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];

/**
 * Check if a path is an image based on file extension
 * @param {string} path - File path or URL
 * @returns {boolean}
 */
export function isImagePath(path) {
	if (!path) return false;
	const extension = path.split('.').pop()?.toLowerCase();
	return IMAGE_EXTENSIONS.includes(extension);
}

/**
 * Check if a path is a video based on file extension
 * @param {string} path - File path or URL
 * @returns {boolean}
 */
export function isVideoPath(path) {
	if (!path) return false;
	const extension = path.split('.').pop()?.toLowerCase();
	return VIDEO_EXTENSIONS.includes(extension);
}

/**
 * Get media type from file path
 * @param {string} path - File path or URL
 * @returns {'video' | 'image' | 'unknown'}
 */
export function getMediaTypeFromPath(path) {
	if (!path) return 'unknown';

	if (isVideoPath(path)) return 'video';
	if (isImagePath(path)) return 'image';
	return 'unknown';
}

/**
 * Get media type and source from a path
 * @param {string} src - File path or URL
 * @returns {{type: 'video' | 'image' | 'unknown', src: string} | null}
 */
export function getMediaInfo(src) {
	if (!src) return null;

	return {
		type: getMediaTypeFromPath(src),
		src
	};
}
