<script>
	import '../app.scss';
	import 'lenis/dist/lenis.css';
	import { SvelteLenis, useLenis } from 'lenis/svelte';
	// import PageHeader from '../lib/components/PageHeader.svelte';
	import { onMount } from 'svelte';

	import WebGLFluid from '$lib/efx/WebGLFluid';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { gsap } from 'gsap/dist/gsap';


	gsap.registerPlugin(ScrollTrigger);

	let { children } = $props();

	let lerp = $state(0.0825);
	let autoRaf = $state(true);
	let options = $derived({ lerp, autoRaf });

	let lenis = useLenis((lenis) => {
		ScrollTrigger.update();
	});

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
			SUNRAYS_WEIGHT: 1,
			PRIMARY_RGB: {
				"r": 0.051,
				"g": 0.197,
				"b": 0.243
			}
		});
	});
</script>

<div class="app" id="app">
	<canvas class="canvas" bind:this={canvas}></canvas>
	<!-- <PageHeader /> -->
	<SvelteLenis root {options}>
		<main>
			{@render children()}
		</main>
	</SvelteLenis>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		position: relative;
		z-index: 1;
		background-image: url('/images/noise.png');
	}

	.canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		touch-action: auto !important;
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
