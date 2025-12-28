<script>
	import { getMediaInfo } from '$lib/utils/media-utils';

	let { media, alt = '' } = $props();

	const mediaInfo = $derived(getMediaInfo(media));
</script>

{#if mediaInfo}
	{#if mediaInfo.type === 'video'}
		<video src={mediaInfo.src} autoplay muted loop playsinline></video>
	{:else if mediaInfo.type === 'image'}
		<img src={mediaInfo.src} {alt} />
	{/if}
{/if}
