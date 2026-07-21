<script>
	import { onMount, onDestroy } from 'svelte';
	import MediaItem from '$lib/components/MediaItem.svelte';
	import { readHandoff, shouldSeed, clearHandoff } from '$lib/transitionHandoff.js';
	import { BlurScrollEffect } from '$lib/efx/blurScrollEffect.js';
	import { createEntranceGate } from '$lib/efx/entranceGate.js';

	let { title, subtitle, backgroundMedia = null, slug = null } = $props();

	let figure;
	let titleEl;
	let subtitleEl;
	let headingEffects = [];

	// Read during init, not inside the entrance onMount: the first onMount
	// below calls clearHandoff(), and onMounts run in registration order, so
	// by the time the entrance gate's onMount runs the record is already
	// gone. The script body runs before either onMount, so it still sees it.
	//
	// This is the only reliable way to tell the two arrival paths apart.
	// document.fonts.ready looks like it should work but doesn't: the site
	// has one @font-face, the carousel arrives via SvelteKit goto() (a
	// same-document SPA navigation), and that navigation never unloads the
	// document — so its fonts are already loaded and fonts.ready resolves in
	// ~25ms, long before the 450-1050ms transition overlay lifts. A fresh
	// handoff record matching this page's slug, by contrast, only exists
	// when setHandoff() ran on the real-overlay carousel path.
	const entranceHandoff = readHandoff();

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

	onMount(() => {
		// Built paused: these headings are above the fold, so a ScrollTrigger
		// would fire them at mount — which on a carousel arrival is underneath
		// the transition overlay, where nobody sees them.
		const titleEffect = new BlurScrollEffect(titleEl, {
			mode: 'enter',
			from: 'end',
			paused: true
		});
		const subtitleEffect = new BlurScrollEffect(subtitleEl, {
			mode: 'enter',
			from: 'start',
			delay: 0.15,
			paused: true
		});
		headingEffects = [titleEffect, subtitleEffect];

		const gate = createEntranceGate(() => {
			titleEffect.play();
			subtitleEffect.play();
		});

		// A fresh handoff record for this slug means a real-overlay carousel
		// transition is in flight (setHandoff() in +layout.svelte only runs on
		// that path, after the degraded no-rect/no-video case has already
		// early-returned via goto()). Same 5000ms staleness window as
		// shouldSeed(), so a record left by an abandoned navigation can't make
		// a later direct visit wait on an event that will never arrive.
		const arrivedViaCarousel =
			entranceHandoff?.slug === slug && Date.now() - entranceHandoff?.at <= 5000;

		// Path 1: arrived through the carousel zoom. Play as the overlay lifts.
		const onDismissed = () => gate.open();
		window.addEventListener('project-transition-dismissed', onDismissed);

		// Path 2: direct load or back navigation — there is no overlay, so no
		// dismissal will ever come. Fonts resolving is the equivalent moment:
		// it is when the split can measure real glyphs.
		//
		// Only wire this fallback when we did NOT arrive via the carousel.
		// fonts.ready is useless as a discriminator on its own — goto() is a
		// same-document SPA navigation, so the document's one @font-face is
		// already loaded and fonts.ready resolves in ~25ms, well before the
		// 450-1050ms overlay lifts. Leaving it wired for the carousel path
		// would always win the race and let the entrance finish unseen
		// beneath the overlay, defeating the whole point of gating it.
		if (!arrivedViaCarousel) {
			document.fonts.ready.then(() => gate.open());
		}

		// Backstop: the layout's safety valve dispatches
		// project-transition-dismissed 1050ms after the transition starts. If
		// this route takes longer than that to mount, the event fires before
		// the listener above is attached, and — on the carousel path, where
		// fonts.ready is deliberately not wired — the gate would then never
		// open, leaving the headings permanently invisible. That is strictly
		// worse than an entrance playing a beat early, so open unconditionally
		// after the same 1050ms. The gate is once-only, so this is a no-op
		// when the event arrives normally.
		const backstop = setTimeout(() => gate.open(), 1050);

		return () => {
			window.removeEventListener('project-transition-dismissed', onDismissed);
			clearTimeout(backstop);
		};
	});

	onDestroy(() => {
		// Not optional. These pages are reached by client-side navigation from the
		// carousel, which is exactly the away-and-back round trip that previously
		// left stale ScrollTriggers alive alongside the fresh ones.
		for (const effect of headingEffects) effect.destroy();
		headingEffects = [];
	});
</script>

<header class="project-header">
	{#if backgroundMedia}
		<figure class="background-media" bind:this={figure}>
			<MediaItem media={backgroundMedia} alt={title} />
		</figure>
	{/if}
	<h1 class="title super" bind:this={titleEl}>{title}</h1>
	<h2 class="subtitle display" bind:this={subtitleEl}>{subtitle}</h2>
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
