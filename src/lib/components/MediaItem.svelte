<script>
	import { getMediaInfo, sanitizeSVG } from '$lib/utils/media-utils';

	let { media, alt = '' } = $props();

	const mediaInfo = $derived(getMediaInfo(media));

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
