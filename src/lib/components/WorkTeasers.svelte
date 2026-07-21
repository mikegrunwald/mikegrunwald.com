<script>
	import { getContext, onMount, onDestroy } from 'svelte';
	import { BlurScrollEffect } from '$lib/efx/blurScrollEffect.js';

	let { teasers = [], hoveredIndex = null } = $props();

	let heading;
	// Retained for teardown. BlurScrollEffect implicitly creates a ScrollTrigger
	// that GSAP keeps in its own global registry, so dropping the reference
	// leaks one trigger per visit to this page — the same bug AboutIntro had.
	let headingEffect;

	onMount(() => {
		headingEffect = new BlurScrollEffect(heading);
	});

	onDestroy(() => {
		// Also covers unmounting before document.fonts.ready resolves: destroy()
		// sets a flag the pending init checks, so no trigger is created after this.
		headingEffect?.destroy();
		headingEffect = undefined;
	});

	// The layout provides the live raycast hover index via context (Task 6);
	// outside the layout (isolated dev/test render) it's absent, so fall back to
	// the `hoveredIndex` prop. getContext must run during init — safe at top level.
	const carouselHover = getContext('carousel-hover');
	const activeIndex = $derived(carouselHover ? carouselHover.index : hoveredIndex);

	const hoveredTeaser = $derived(
		activeIndex != null && teasers[activeIndex] ? teasers[activeIndex] : null
	);
</script>

<section class="work-teasers" data-gpu-carousel aria-label="Featured work">
	<!-- h2 carrying the .h1 type scale, per the same pattern AboutIntro uses.
	     `.display` is the hook BlurScrollEffect splits and animates. -->
	<h2 class="work-teasers__title h1 display" bind:this={heading}>Featured Work</h2>

	<ul class="work-teasers__list sr-only">
		{#each teasers as teaser (teaser.slug)}
			<li>
				<a href={teaser.href} data-cursor="magnetic">
					{teaser.title}
					{#if teaser.subtitle}<span> — {teaser.subtitle}</span>{/if}
				</a>
			</li>
		{/each}
	</ul>

	<!-- Task 6 hover label: purely cosmetic DOM feedback for the 3D ring, not a
	     duplicate a11y surface — the real links above already cover SEO/a11y. -->
	<p class="work-teasers__label" aria-hidden="true" class:is-visible={!!hoveredTeaser}>
		{hoveredTeaser?.title ?? ''}
	</p>
</section>

<style>
	.work-teasers {
		position: relative;
		/* Scroll runway for the ScrollTrigger pin (Task 4) — the ring rotates
		   through its full range while the user scrolls through this height.
		   Tuned here, not left to ScrollTrigger's end-of-content default. */
		height: 300vh;
	}

	.work-teasers__title {
		/* The section is pinned by ScrollTrigger for the whole rotation, so the
		   heading is carried along with it and holds its position without any
		   position: sticky of its own. Left-aligned to match AboutIntro's
		   headings. pointer-events: none so it never swallows a click meant for
		   the ring behind it. */
		position: relative;
		z-index: 2;
		margin: 0;
		padding: var(--spacing-base) var(--spacing-base) 0;
		pointer-events: none;

		@media (max-width: 768px) {
			padding: var(--spacing-base) var(--spacing-xs) 0;
		}
	}

	.work-teasers__label {
		position: fixed;
		left: 50%;
		bottom: 10vh;
		transform: translateX(-50%) translateY(8px);
		margin: 0;
		padding: 0.5em 1em;
		pointer-events: none;
		opacity: 0;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		z-index: 50;
	}

	.work-teasers__label.is-visible {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
</style>
