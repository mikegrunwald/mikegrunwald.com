<script>
	import '../app.scss';
	import 'lenis/dist/lenis.css';
	import { SvelteLenis, useLenis } from 'lenis/svelte';
	// import PageHeader from '../lib/components/PageHeader.svelte';
	import { onMount } from 'svelte';

	import WebGLFluid from '$lib/efx/WebGLFluid';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { SplitText } from 'gsap/dist/SplitText';
	import { gsap } from 'gsap/dist/gsap';
	import CursorDot from '$lib/components/CursorDot.svelte';

	gsap.registerPlugin(ScrollTrigger, SplitText);

	let { children } = $props();

	const lerp = 0.0666;
	let autoRaf = $state(true);
	let options = $derived({
		lerp,
		autoRaf,
		syncTouch: true,
		syncTouchLerp: lerp
	});

	// Throttle filter updates - skip frames for better performance
	let frameCount = 0;
	const FRAME_SKIP = 2; // Update every 3rd frame (0, 3, 6, 9...)

	let lenis = useLenis((lenis) => {
		// Skip frames to reduce expensive filter calculations
		frameCount++;
		if (frameCount % FRAME_SKIP !== 0) {
			return;
		}

		// Update filter based on scroll position
		const scrollY = lenis.scroll;
		const vh = window.innerHeight;

		if (scrollY <= vh) {
			filterProgress = scrollY / vh;
		} else {
			filterProgress = 1;
		}
	});

	let canvas;
	let fluidInstance;
	let filterProgress = $state(0);

	onMount(async () => {
		fluidInstance = WebGLFluid(canvas, {
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
				r: 0.051,
				g: 0.197,
				b: 0.243
			}
		});
	});
</script>

<div class="app" id="app">
	<canvas
		class="canvas"
		bind:this={canvas}
		style="filter: 
			invert({filterProgress * 100}%) 
			opacity({50 * filterProgress + (100 - 100 * filterProgress)}%) 
			hue-rotate({filterProgress * 180}deg) 
			saturate({0.333 * filterProgress + (1 - filterProgress)})"
	></canvas>
	<CursorDot class="dot" />
	<SvelteLenis root {options}>
		<main>
			{@render children()}
		</main>
	</SvelteLenis>
</div>

<style>
	.app {
		background-image: url('/images/noise.webp');
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		position: relative;
		overflow-x: hidden;
	}

	.canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		touch-action: auto !important;
		will-change: filter;
	}

	.dot {
		position: relative;
		z-index: 300;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		margin: 0 auto;
	}
</style>
