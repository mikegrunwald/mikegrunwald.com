<script>
	import { getMediaInfo, sanitizeSVG } from '$lib/utils/media-utils';

	let { media, alt = '' } = $props();

	// Extract string value from media (handle both string and object formats)
	const mediaSrc = $derived(
		typeof media === 'string' ? media : media?.path || media?.url || media?.src || ''
	);

	const mediaInfo = $derived(getMediaInfo(mediaSrc));

	// For inline SVG, sanitize the code for security
	const sanitizedSVG = $derived(mediaInfo?.isInline ? sanitizeSVG(mediaInfo.src) : null);
</script>

{#if mediaInfo}
	{#if mediaInfo.type === 'video'}
		<video src={mediaInfo.src} autoplay muted loop playsinline></video>
	{:else if mediaInfo.type === 'svg-inline'}
		{@html sanitizedSVG}
	{:else if mediaInfo.type === 'svg-path' || mediaInfo.type === 'image'}
		<img src={mediaInfo.src} {alt} />
	{/if}
{/if}

<style>
	:global(svg) {
		max-width: 100%;
		height: auto;
		display: block;
	}
</style>
