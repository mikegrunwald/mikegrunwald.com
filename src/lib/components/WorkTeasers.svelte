<script>
	let { teasers = [], hoveredIndex = null } = $props();

	const hoveredTeaser = $derived(
		hoveredIndex != null && teasers[hoveredIndex] ? teasers[hoveredIndex] : null
	);
</script>

<section class="work-teasers" data-gpu-carousel aria-label="Featured work">
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
