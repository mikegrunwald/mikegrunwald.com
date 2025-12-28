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
 * Check if a string is inline SVG code (not a file path)
 * @param {string} value - Either SVG code or file path
 * @returns {boolean}
 */
export function isInlineSVG(value) {
	if (!value || typeof value !== 'string') return false;

	const trimmed = value.trim();
	return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
}

/**
 * Check if a path points to an SVG file
 * @param {string} path - File path or URL
 * @returns {boolean}
 */
export function isSVGPath(path) {
	if (!path) return false;
	const extension = path.split('.').pop()?.toLowerCase();
	return extension === 'svg';
}

/**
 * Sanitize SVG code to remove security risks
 * @param {string} svgCode - Raw SVG code
 * @returns {string} Sanitized SVG code
 */
export function sanitizeSVG(svgCode) {
	if (!svgCode) return '';

	let sanitized = svgCode;

	// Remove script tags (case-insensitive)
	sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

	// Remove event handlers (onclick, onload, onerror, etc.)
	sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
	sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

	// Remove javascript: protocol in attributes
	sanitized = sanitized.replace(/javascript:/gi, '');

	// Remove data: protocol (potential XSS vector)
	sanitized = sanitized.replace(/\sdata:text\/html[^"'\s>]*/gi, '');

	// Remove foreignObject (can embed HTML)
	sanitized = sanitized.replace(/<foreignObject\b[^>]*>.*?<\/foreignObject>/gis, '');

	// Remove <use> with external references (potential security issue)
	sanitized = sanitized.replace(
		/<use[^>]*xlink:href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi,
		''
	);

	return sanitized;
}

/**
 * Get media type and source from a path
 * @param {string} src - File path or URL
 * @returns {{type: 'video' | 'image' | 'svg-inline' | 'svg-path' | 'unknown', src: string, isInline?: boolean} | null}
 */
export function getMediaInfo(src) {
	if (!src) return null;

	// Check if it's inline SVG code
	if (isInlineSVG(src)) {
		return {
			type: 'svg-inline',
			src: src,
			isInline: true
		};
	}

	// Check if it's an SVG path
	if (isSVGPath(src)) {
		return {
			type: 'svg-path',
			src: src,
			isInline: false
		};
	}

	// Existing logic for video/image
	return {
		type: getMediaTypeFromPath(src),
		src: src,
		isInline: false
	};
}
