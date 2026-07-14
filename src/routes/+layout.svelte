<script>
	import '../app.scss';
	import 'lenis/dist/lenis.css';
	import { SvelteLenis, useLenis } from 'lenis/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { SplitText } from 'gsap/dist/SplitText';
	import { gsap } from 'gsap/dist/gsap';
	import CursorDot from '$lib/components/CursorDot.svelte';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidScene } from '$lib/gpu/scenes/FluidScene.js';
	import { createGrainPass } from '$lib/gpu/passes/GrainPass.js';
	import { scrollProgress } from '$lib/gpu/fluid/grading.js';

	gsap.registerPlugin(ScrollTrigger, SplitText);

	beforeNavigate(() => {});
	afterNavigate(() => {
		if (window.lenis) window.lenis.scrollTo(0, { immediate: true });
	});

	let { children } = $props();

	const lerp = 0.0666;
	let autoRaf = $state(true);
	let options = $derived({ lerp, autoRaf, syncTouch: true, syncTouchLerp: lerp });

	let canvas;
	let engine;
	let fluidScene;
	let grainPass;
	let debugPanel;
	let forcedProgress = null;

	// /dev/ routes (e.g. /dev/fluid-parity) boot their own engine + debug panel
	// directly in their +page.svelte. Booting the layout's engine there too
	// would mean two sims, two pointer listener sets, and two debug panels
	// running simultaneously — gate the whole layout engine boot off on those
	// routes and hide the layout's fixed canvas so it doesn't sit behind the
	// dev route's own panes.
	let isDevRoute = $derived(page.url.pathname.startsWith('/dev/'));

	let lenis = useLenis((lenis) => {
		if (!engine || !fluidScene) return;
		engine.setScroll({ y: lenis.scroll, velocity: lenis.velocity });
		if (forcedProgress === null) {
			fluidScene.setProgress(scrollProgress(lenis.scroll, window.innerHeight));
		}
	});

	// The canvas is `position: fixed; width: 100vw; height: 100dvh` — its box is
	// tied directly to the viewport, not to `.app`'s (content-driven) height, so
	// a plain `window` resize listener is the correct signal here (unlike the
	// fluid-parity dev route, whose canvas is sized by a CSS grid wrapper and
	// therefore needs a ResizeObserver on that wrapper instead).
	//
	// `renderer.resize()` already invokes gpu-curtains' single-slot
	// `onAfterResize` callback synchronously before returning (confirmed in
	// node_modules/gpu-curtains/dist/esm/core/renderers/GPURenderer.mjs:193-197),
	// and FluidScene's constructor registers `() => this.resizeSim()` on that
	// exact slot. So `fluidScene.resizeSim()` runs automatically as part of
	// `renderer.resize()` — calling it again here would double-resize the sim
	// (destroy-and-recreate its output texture twice) and fight the single
	// callback slot, exactly what FluidScene's own doc comment and the
	// fluid-parity route's resize comment warn against. Only `grainPass.resize()`
	// needs an explicit call, since GrainPass intentionally does not hook
	// `onAfterResize` (see GrainPass.js doc comment) to avoid stomping
	// FluidScene's registration.
	function syncCanvasSize() {
		if (!engine) return;
		const width = window.innerWidth;
		const height = window.innerHeight;
		if (!width || !height) return;
		engine.curtains.renderer.resize({ width, height, top: 0, left: 0 });
		if (grainPass) {
			const size = engine.getCanvasSize();
			grainPass.resize(size.width, size.height);
		}
	}

	onMount(async () => {
		if (page.url.pathname.startsWith('/dev/')) return; // dev routes boot their own engine
		engine = await createEngine({ canvas });
		if (!engine) return; // no WebGPU / reduced motion → DOM-only experience

		fluidScene = new FluidScene({ engine });
		grainPass = createGrainPass({ engine });

		window.addEventListener('resize', syncCanvasSize);
		syncCanvasSize();

		const { shouldShowPanel, maybeCreatePanel } = await import('$lib/gpu/debug/panel.js');
		if (shouldShowPanel()) {
			debugPanel = await maybeCreatePanel({
				fluidScene,
				grainPass,
				engine,
				forceProgress: (p) => {
					forcedProgress = p;
					if (p !== null) fluidScene.setProgress(p);
				}
			});
		}
	});

	onDestroy(() => {
		// SvelteKit's SSR/prerender runs onDestroy callbacks synchronously right
		// after rendering each component (svelte/src/internal/server/index.js),
		// unlike the browser where onDestroy only fires on real unmount — so this
		// callback also executes during the build's prerender pass, where
		// `window` does not exist. `engine`/`fluidScene`/etc. are always
		// undefined there too (onMount never runs server-side), so their `?.`
		// calls are already safe; only the unconditional `window` reference
		// needs the explicit guard.
		if (typeof window !== 'undefined') window.removeEventListener('resize', syncCanvasSize);
		debugPanel?.destroy();
		grainPass?.destroy();
		fluidScene?.destroy();
		engine?.destroy();
	});
</script>

<div class="app" id="app">
	{#if !isDevRoute}
		<canvas class="canvas" bind:this={canvas}></canvas>
	{/if}
	<CursorDot class="dot" />
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
