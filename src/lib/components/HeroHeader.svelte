<script>
	import ScrollIndicator from './ScrollIndicator.svelte';
</script>

<header class="hero">
	<div class="logo-wrapper">
		<h1 class="display"><span class="sr-only">Michael Grunwald</span></h1>
		<div class="logo-box" data-gpu-logo aria-hidden="true"></div>
	</div>
	<ScrollIndicator />
</header>

<style lang="scss">
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: right;
		flex: 1;
		min-height: 100dvh;
		width: 100%;
		overflow: hidden;
		position: relative;

		/* Single source of truth for the logo box's geometry, shared by the CSS
		   logo (`.display::before`) and the GPU particle scene's DOM-sync target
		   (`.logo-box`). These two MUST stay identical: LogoParticlesScene
		   measures `.logo-box` every frame and maps logo-local particle
		   positions (0..1 on each axis) across its rect, so any difference — or
		   any deviation from the baked logo's aspect ratio — distorts the
		   particle logo directly.

		   Sizing is WIDTH-driven so the aspect ratio can never break. The
		   previous version set `height: 88dvh` with `max-width: 96vw`, which is
		   over-constrained: on a narrow viewport the max-width clamped the width
		   while the height stayed pinned at 88dvh, producing a 96vw x 88dvh box
		   that violated `aspect-ratio` outright and stretched the logo tall.
		   Taking the min of "as wide as the viewport allows" and "as wide as an
		   88dvh-tall logo would be" keeps the box inside both limits while
		   `aspect-ratio` derives the height, so it fills whichever axis runs out
		   first and never distorts. */
		--logo-aspect: 1.153594844873037;
		--logo-max-height: 88dvh;
		--logo-max-width: 96vw;
		--logo-width: min(var(--logo-max-width), var(--logo-max-height) * var(--logo-aspect));
	}

	.logo-wrapper {
		width: 100%;
		height: 100dvh;
		pointer-events: auto;
		transform-origin: center center;
		/* Containing block for the two absolutely-positioned logo boxes below.
		   It is exactly one viewport tall and starts at the top of the page, so
		   centering within it == centering in the viewport on load. Previously
		   they resolved against `.hero`, which is only `min-height: 100dvh` and
		   so can grow taller than the viewport as content changes. */
		position: relative;
		@media (pointer: coarse) {
			pointer-events: auto;
		}
	}

	.display {
		color: var(--color-text-body);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		position: absolute;
		inset: 0;
		filter: drop-shadow(0 0 0 rgba(var(--color-primary-rgb), 1));

		&:before {
			content: '';
			display: block;
			/* Geometry mirrors `.logo-box` exactly — see the custom properties
			   on `.hero`. Width-driven; `aspect-ratio` derives the height. */
			width: var(--logo-width);
			aspect-ratio: var(--logo-aspect);
			background-image: url('/images/logo.svg');
			background-position: center;
			background-size: 80%;
			background-repeat: no-repeat;

			mask-image: url('/images/pop-smoke.webp');
			mask-size: 100%;
			mask-position: center;
			mask-repeat: no-repeat;

			filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.25));
			transition: opacity 0.6s ease;

			/* Hidden by DEFAULT, revealed only when we know the GPU particles
			   are not going to run (see `.gpu-logo-fallback` below).
			   Previously this was the reverse — visible by default, faded out
			   once the particle scene reported live — which meant every load
			   painted the CSS logo for as long as engine boot + logo bake +
			   pipeline compile took, then cross-faded it away: the "initial
			   flash of the original". Starting hidden makes the handoff
			   invisible, at the cost of needing an explicit reveal on every
			   no-particles path (no WebGPU, reduced motion, ?noparticles,
			   scene-create failure, budget-guard kill) — all wired in
			   +layout.svelte, plus a <noscript> reveal in src/app.html for
			   JS-disabled clients. */
			opacity: 0;
		}
	}

	/* Set by +layout.svelte when the particle scene will not (or no longer
	   does) run. Global because the class lives on <html>. */
	:global(.gpu-logo-fallback) .display:before {
		opacity: 1;
	}

	/* DOM-sync target for the GPU particle scene: LogoParticlesScene measures
	   THIS box every frame (getBoundingClientRect) and maps logo-local particle
	   positions through it, so its geometry must stay identical to the CSS
	   logo's `.display::before` box above — change the two together or the
	   particles and the fallback logo will not occupy the same space. */
	.logo-box {
		position: absolute;
		inset: 0;
		/* All-auto margins + `inset: 0` = true centering in `.logo-wrapper`
		   (i.e. in the viewport on load). This was `auto auto 6.66vh`, which
		   does NOT nudge the box up by 6.66vh as it reads — with a fixed bottom
		   margin the auto TOP margin absorbs all remaining free space, pinning
		   the box to the bottom. That was invisible while the box was 88dvh
		   tall (almost no free space to absorb) and became obvious once
		   width-driven sizing made it short on narrow viewports. */
		margin: auto;
		/* Geometry mirrors `.display::before` exactly — see the custom
		   properties on `.hero`. Width-driven; `aspect-ratio` derives the
		   height, so the box can never be over-constrained into a
		   non-1.1536 shape and distort the particle logo. */
		width: var(--logo-width);
		aspect-ratio: var(--logo-aspect);
		pointer-events: none;
	}
</style>
