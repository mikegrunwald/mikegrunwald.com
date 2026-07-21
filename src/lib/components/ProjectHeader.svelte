<script>
	import { onMount } from 'svelte';
	import MediaItem from '$lib/components/MediaItem.svelte';
	import { readHandoff, shouldSeed, clearHandoff } from '$lib/transitionHandoff.js';

	let { title, subtitle, backgroundMedia = null, slug = null } = $props();

	let figure;

	function mediaSrc(media) {
		if (!media) return null;
		return typeof media === 'string' ? media : (media.path ?? media.url ?? media.src ?? null);
	}

	onMount(() => {
		// Query our own figure rather than binding through MediaItem: that
		// component renders every media block on the site, and widening its API
		// for one caller would be the wrong trade.
		const video = figure?.querySelector('video');
		if (!video) return;

		const record = readHandoff();
		const srcUrl = mediaSrc(backgroundMedia);
		const wantsSeed = shouldSeed({ record, slug, srcUrl, now: Date.now() });

		// Dev-only diagnostic. Whether the seed fired, and why not, is otherwise
		// invisible: a refused seed looks identical to a successful transition
		// that simply started at 0. Same rationale as window.__gpu.
		if (import.meta.env.DEV) {
			window.__handoff = { record, slug, srcUrl, wantsSeed, readyStateAtMount: video.readyState };
		}

		// Seeking before the video has metadata does NOT throw — it is silently
		// ignored, and the video plays from 0. That failure is invisible: the
		// transition looks right and the continuity just quietly does not happen.
		// At mount readyState is usually 0, so the seek almost always has to wait
		// for loadedmetadata rather than running immediately.
		const seek = () => {
			try {
				video.currentTime = record.currentTime;
			} catch {
				// Some browsers do throw on an out-of-range seek. Starting at 0 is
				// an acceptable outcome; failing the page is not.
			}
		};
		if (wantsSeed) {
			if (video.readyState >= 1 /* HAVE_METADATA */) {
				seek();
			} else {
				video.addEventListener('loadedmetadata', seek, { once: true });
			}
		}
		// Consumed either way — a record that did not match this page must not
		// linger and seed a later navigation.
		clearHandoff();

		// Tell the layout the overlay can go. `loadeddata` means there is a frame
		// to show, which is exactly the condition for removing the overlay
		// without a black flash. Fires immediately if the video is already there.
		const announce = () => window.dispatchEvent(new CustomEvent('project-header-ready'));
		if (video.readyState >= 2) {
			announce();
		} else {
			video.addEventListener('loadeddata', announce, { once: true });
		}
		return () => {
			video.removeEventListener('loadeddata', announce);
			video.removeEventListener('loadedmetadata', seek);
		};
	});
</script>

<header class="project-header">
	{#if backgroundMedia}
		<figure class="background-media" bind:this={figure}>
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
		right: 0.025em;
		z-index: 3;
		text-align: right;
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
