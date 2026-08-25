<!-- src/lib/components/CaseStudiesSection.svelte -->
<script>
	import { spotlight } from '$lib/actions/spotlight.js';
	import { playInView } from '$lib/actions/playInView.js';
	import { revealInView } from '$lib/actions/revealInView.js';
	let { caseStudies = [] } = $props();
</script>

<section class="case-studies" aria-label="Case Studies">
	<h1 class="case-studies__title h1">Case Studies</h1>
	<ul class="case-studies__grid" use:spotlight>
		{#each caseStudies as item, i (item.slug)}
			<li class="case-studies__cell">
				<a class="cs-card" href={item.href} data-spotlight-card use:revealInView={{ index: i }}>
					<!-- The frame (video + noise + shine + box-shadow) scales on hover; the
					     label is left OUTSIDE it so it holds its size/position and the
					     magnetic dot can still sit behind its text (a transform on the card
					     itself would make it a stacking context and re-trap the dot). -->
					<span class="cs-card__frame">
						{#if item.teaserUrl}
							<span class="cs-card__media">
								<!-- svelte-ignore a11y_media_has_caption -->
								<video
									class="cs-card__video"
									src={item.teaserUrl}
									crossorigin="anonymous"
									muted
									loop
									playsinline
									preload="metadata"
									aria-hidden="true"
									use:playInView
								></video>
							</span>
						{/if}
						<span class="cs-card__glow" aria-hidden="true"></span>
					</span>
					<!-- data-cursor-behind: the magnetic dot morphs onto this button but is
					     z-indexed BEHIND its text and above the video (see CursorDot). -->
					<span
						class="cs-card__label button outline small"
						data-cursor="magnetic"
						data-cursor-behind>{item.title}</span
					>
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
		gap: var(--spacing-sm);
		grid-template-columns: repeat(auto-fit, minmax(min(var(--cs-min-track, 16.5rem), 100%), 1fr));
	}

	.case-studies__cell {
		margin: 0;
	}

	.cs-card {
		position: relative;
		display: block;
		aspect-ratio: var(--cs-card-aspect, 16 / 10);
		/* No overflow:hidden — the shine ring is inset OUTSIDE the frame edge and
		   would be clipped by it. The video + noise self-clip via border-radius. */
		text-decoration: none;
		border-radius: var(--border-radius);
	}
	/* Everything but the label lives in the frame so it can scale as one unit on
	   hover (video, noise, shine, glow) while the label — and the magnetic dot
	   behind it — stay put. The card itself must NOT be transformed (stacking
	   context = dot re-trapped), which is why the transform lives here. */
	.cs-card__frame {
		position: absolute;
		inset: 0;
		z-index: 0;
		border-radius: inherit;
		box-shadow:
			0 0 16px 0 #33c5f3,
			inset 0 0 12px #33c5f3;
		transition: transform var(--animation-duration-slow) var(--animation-timing);
	}
	.cs-card:hover .cs-card__frame {
		transform: scale(1.05);
	}
	/* Scroll-in reveal: scale up from center + fade, staggered by --reveal-delay
	   (set per card by revealInView). Revealed state animates transform to `none`,
	   NOT scale(1) — a lingering transform would make the card a stacking context
	   and re-trap the magnetic cursor dot. Gated on no-preference so reduced-motion
	   users get the cards immediately with no hidden state. */
	@media (prefers-reduced-motion: no-preference) {
		.cs-card {
			opacity: 0;
			transform: scale(0.85);
			transition:
				opacity 0.6s ease,
				transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
			transition-delay: var(--reveal-delay, 0ms);
		}
		/* :global on the JS-added class — Svelte prunes .cs-card.is-revealed as
		   "unused" since is-revealed never appears in the template markup. */
		.cs-card:global(.is-revealed) {
			opacity: 1;
			transform: none;
		}
	}
	/* Noise grain over the video, below the glow ring + label. Reuses the site's
	   noise.webp (same asset as GrainPass / the old CSS grain). */
	.cs-card__frame::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		border-radius: inherit; /* self-clip now that the card has no overflow:hidden */
		background-image:
			url('/images/noise.webp'),
			linear-gradient(
				in oklch to bottom,
				rgba(0, 0, 0, 0.95) 0%,
				rgba(0, 0, 0, 0.666) 50%,
				rgba(0, 0, 0, 0.95) 100%
			);
	}
	/* Viewport media queries (not container queries) so .cs-card is NOT a
	   container — container-type establishes a stacking context, which trapped the
	   magnetic cursor dot. On narrow (1-column) screens, shrink + left-align the
	   label; on very wide screens the cards are roomy enough for a larger label. */
	@media (max-width: 768px) {
		.cs-card__label {
			left: var(--spacing-xxs);
			transform: none;
			font-size: var(--font-size-body-xs);
		}
	}
	@media (min-width: 1600px) {
		.cs-card__label {
			font-size: var(--font-size-body-sm);
		}
	}
	/* Clips the video (incl. its hover scale-up) to the rounded card. z-index:0
	   keeps it below the noise (1), glow (2), magnetic dot (3) and label (4). */
	.cs-card__media {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
		z-index: 0;
	}
	.cs-card__video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* z-index:4 leaves slot 3 for the magnetic cursor dot to sit behind the button
	   text but above the video/noise/glow (0/1/2). page-wrapper no longer creates a
	   stacking context, so these z-indexes and the global dot share the root
	   context and the dot can land between them. */
	.cs-card__label {
		position: absolute;
		left: 50%;
		bottom: var(--spacing-xs);
		transform: translateX(-50%);
		z-index: 4;
	}
	.cs-card__glow {
		--cs-glow-width: 4px;

		position: absolute;
		/* Inset OUTWARD by the ring width so the masked band sits just outside the
		   card/video edge rather than on top of the video. Radius grows to match
		   (card radius + width) so the outer corners stay concentric. */
		inset: calc(-1 * var(--cs-glow-width, 3px));
		border-radius: calc(var(--border-radius) + var(--cs-glow-width, 3px));
		/* Shine ring width — ~3× the original 1.5px so the lit border reads wider. */
		padding: var(--cs-glow-width, 3px);
		pointer-events: none;
		z-index: 2;
		/* White-hot core at the cursor, fading through the primary blue to transparent. */
		background: radial-gradient(
			var(--cs-glow-radius, 420px) circle at var(--mx, -1000px) var(--my, -1000px),
			#fff 0%,
			rgba(var(--color-primary-rgb), var(--cs-glow-intensity, 1)) 22%,
			transparent 60%
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
