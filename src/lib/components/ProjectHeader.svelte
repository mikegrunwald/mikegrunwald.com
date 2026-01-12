<script>
	import MediaItem from '$lib/components/MediaItem.svelte';

	let { title, subtitle, backgroundMedia = null } = $props();
</script>

<header class="project-header">
	{#if backgroundMedia}
		<figure class="background-media">
			<MediaItem media={backgroundMedia} alt={title} />
		</figure>
	{/if}
	<h1 class="title super">{title}</h1>
	<h2 class="subtitle display">{subtitle}</h2>
</header>

<style lang="scss">
	.project-header {
		position: relative;
		width: 100dvw;
		height: 100dvh;
	}

	.background-media {
		position: relative;
		z-index: -1;
		height: 100vh;
		height: 100dvh;
		--media-height: 100%;
		--media-width: 100%;
		overflow: hidden;

		&:after {
			background: linear-gradient(
				in oklch to bottom,
				rgba(0, 0, 0, 0.95) 0%,
				rgba(0, 0, 0, 0.666) 50%,
				rgba(0, 0, 0, 0.95) 100%
			);
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 2;
		}
	}

	.title {
		position: absolute;
		top: 0.051em;
		right: 0;
		z-index: 3;
	}

	.subtitle {
		position: absolute;
		bottom: -0.047em;
		z-index: 4;
		margin-bottom: 0;
	}

	.title,
	.subtitle {
		--line-height-heading: 0.947;
	}

	@supports (-webkit-text-stroke: 3px black) {
		.title,
		.subtitle {
			-webkit-text-fill-color: transparent;
			-webkit-text-stroke: 1px var(--color-primary);
		}
	}
</style>
