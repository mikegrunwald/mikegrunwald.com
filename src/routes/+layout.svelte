<script>
	import '../app.scss';
	import 'lenis/dist/lenis.css';
	import { SvelteLenis, useLenis } from 'lenis/svelte';
	// import PageHeader from '../lib/components/PageHeader.svelte';
	import { onMount } from 'svelte';

	import WebGLFluid from '$lib/efx/WebGLFluid';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { gsap } from 'gsap/dist/gsap';
	import CursorDot from '$lib/components/CursorDot.svelte';

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
				r: 0.051,
				g: 0.197,
				b: 0.243
			}
		});
	});
</script>

<div class="app" id="app">
	<canvas class="canvas" bind:this={canvas}></canvas>
	<!-- <div class="noise-bg"></div> -->
	<!-- <PageHeader /> -->
	<CursorDot />
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
		background-image: url('/images/noise.webp');
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

	.noise-bg {
		position: fixed;
		inset: -10px;
		z-index: 999;
		animation: noisey-bg 1s steps(2) infinite;
		background-image: url(data:image/png;base64,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);
	}

	@keyframes noisey-bg {
		0% {
			transform: translateZ(0);
		}

		10% {
			transform: translate3d(2rem, -9rem, 0);
		}

		20% {
			transform: translate3d(1rem, -4rem, 0);
		}

		30% {
			transform: translate3d(-8rem, -7rem, 0);
		}

		40% {
			transform: translate3d(5rem, 6rem, 0);
		}

		50% {
			transform: translate3d(-1rem, 8rem, 0);
		}

		60% {
			transform: translate3d(5rem, 2rem, 0);
		}

		70% {
			transform: translate3d(-8rem, -5rem, 0);
		}

		80% {
			transform: translate3d(6rem, 1rem, 0);
		}

		90% {
			transform: translate3d(9rem, 5rem, 0);
		}

		to {
			transform: translate3d(0, -6rem, 0);
		}
	}
</style>
