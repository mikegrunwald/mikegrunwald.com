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
	}

	.logo-wrapper {
		width: 100%;
		height: 100dvh;
		pointer-events: auto;
		transform-origin: center center;
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
		margin-bottom: 6.66vh;

		&:before {
			content: '';
			display: block;
			max-width: 96vw;
			height: 88vh;
			height: 88dvh;
			aspect-ratio: 1.153594844873037 / 1;
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
		margin: auto auto 6.66vh;
		max-width: 96vw;
		height: 88vh;
		height: 88dvh;
		aspect-ratio: 1.153594844873037 / 1;
		pointer-events: none;
	}
</style>
