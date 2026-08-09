<!-- src/lib/components/CaseStudiesSection.svelte -->
<script>
	import { spotlight } from '$lib/actions/spotlight.js';
	import { playInView } from '$lib/actions/playInView.js';
	let { caseStudies = [] } = $props();
</script>

<section class="case-studies" aria-label="Case Studies">
	<h1 class="case-studies__title h1">Case Studies</h1>
	<ul class="case-studies__grid" use:spotlight>
		{#each caseStudies as item (item.slug)}
			<li class="case-studies__cell">
				<a class="cs-card" href={item.href} data-cursor="magnetic" data-spotlight-card>
					{#if item.teaserUrl}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							class="cs-card__video"
							src={item.teaserUrl}
							muted
							loop
							playsinline
							preload="metadata"
							aria-hidden="true"
							use:playInView
						></video>
					{/if}
					<span class="cs-card__glow" aria-hidden="true"></span>
					<span class="cs-card__label button outline small">{item.title}</span>
				</a>
			</li>
		{/each}
	</ul>
</section>

<style lang="scss">
	.case-studies__title {
		margin-bottom: var(--spacing-base);
	}
	.case-studies__grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--cs-gap, var(--spacing-sm));
		grid-template-columns: repeat(auto-fit, minmax(var(--cs-min-track, 22rem), 1fr));
	}
	.cs-card {
		position: relative;
		display: block;
		aspect-ratio: var(--cs-card-aspect, 16 / 10);
		border-radius: var(--cs-radius, var(--border-radius));
		overflow: hidden;
		text-decoration: none;
		container-type: inline-size;
	}
	/* Below a narrow card width, shrink and left-align the label so it reads at
	   1-column mobile without wrapping under the 3-column desktop sizing. */
	@container (max-width: 18rem) {
		.cs-card__label {
			left: var(--spacing-xxs);
			transform: none;
			font-size: var(--font-size-body-xs);
		}
	}
	/* Roomier cards get a larger label. */
	@container (min-width: 30rem) {
		.cs-card__label {
			font-size: var(--font-size-body-sm);
		}
	}
	.cs-card__video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cs-card__label {
		position: absolute;
		left: 50%;
		bottom: var(--spacing-xs);
		transform: translateX(-50%);
		z-index: 2;
	}
	.cs-card__glow {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: var(--cs-glow-width, 1.5px);
		pointer-events: none;
		z-index: 1;
		background: radial-gradient(
			var(--cs-glow-radius, 220px) circle at var(--mx, -1000px) var(--my, -1000px),
			rgba(var(--color-primary-rgb), var(--cs-glow-intensity, 0.9)),
			transparent 45%
		);
		/* Gradient-border trick: mask keeps only the padding ring, so the glow reads
		   as a lit border rather than a filled panel. */
		-webkit-mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
	}
</style>
