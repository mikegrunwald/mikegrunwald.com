<script>
	import '../app.scss';
	// import PageHeader from '../lib/components/PageHeader.svelte';
	import { onMount } from 'svelte';

	import WebGLFluid from '$lib/efx/WebGLFluid';

	let canvas;

	onMount(async () => {
		WebGLFluid(canvas, {
			TRIGGER: 'hover',
			IMMEDIATE: false,
			AUTO: false,
			INTERVAL: 5000,
			SIM_RESOLUTION: 128,
			DYE_RESOLUTION: 1024,
			CAPTURE_RESOLUTION: 512,
			DENSITY_DISSIPATION: 4,
			VELOCITY_DISSIPATION: 1,
			PRESSURE: 0.25,
			PRESSURE_ITERATIONS: 20,
			CURL: 0.1,
			SPLAT_RADIUS: 0.5,
			SPLAT_FORCE: 6000,
			SPLAT_COUNT: Number.parseInt(Math.random() * 100) + 5,
			SHADING: true,
			COLORFUL: true,
			COLOR_UPDATE_SPEED: 10,
			PAUSED: false,
			BACK_COLOR: { r: 0, g: 0, b: 0 },
			TRANSPARENT: true,
			BLOOM: true,
			BLOOM_ITERATIONS: 16,
			BLOOM_RESOLUTION: 56,
			BLOOM_INTENSITY: 0.025,
			BLOOM_THRESHOLD: 1,
			BLOOM_SOFT_KNEE: 1.5,
			SUNRAYS: true,
			SUNRAYS_RESOLUTION: 256,
			SUNRAYS_WEIGHT: 1
		});
	});
</script>

<div class="app" id="app">
	<canvas class="canvas" bind:this={canvas}></canvas>
	<!-- <PageHeader /> -->
	<main>
		<slot></slot>
	</main>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		position: relative;
		z-index: 1;
		overflow: scroll;
	}

	.canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		touch-action: auto !important;
		background-image: url('/images/noise.png');
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}
</style>
