<script>
	import ScrollIndicator from './ScrollIndicator.svelte';
	import { tilt } from '$lib/actions/tilt';
</script>

<header class="hero">
	<div class="logo-wrapper" use:tilt={{ maxTilt: 13, perspective: 871, ease: 0.067 }}>
		<h1 class="display"><span class="sr-only">Michael Grunwald</span></h1>
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
			height: 66vh;
			height: 66dvh;
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
		}
	}
</style>
