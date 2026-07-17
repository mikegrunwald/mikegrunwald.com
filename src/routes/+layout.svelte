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
	import { LogoParticlesScene } from '$lib/gpu/scenes/LogoParticlesScene.js';

	gsap.registerPlugin(ScrollTrigger, SplitText);

	beforeNavigate(() => {});
	afterNavigate(() => {
		if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
		syncParticlesScene();
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
	let unsubGrainResize;
	let logoScene;
	let creatingParticles = false;

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
	// which the engine owns exclusively and fans out via `engine.onResize()`
	// (Task 1 of Phase 2). FluidScene and the grain wiring below both subscribe
	// there instead of touching `renderer.onAfterResize` directly, so
	// `syncCanvasSize` only needs to trigger the resize itself — every consumer
	// reacts via the fan-out.
	function syncCanvasSize() {
		if (!engine) return;
		const width = window.innerWidth;
		const height = window.innerHeight;
		if (!width || !height) return;
		engine.curtains.renderer.resize({ width, height, top: 0, left: 0 });
	}

	// Keys the hero particle scene's lifecycle off the presence of
	// HeroHeader's `[data-gpu-logo]` box in the current page — present only
	// on the homepage, so this creates the scene on `/` and destroys it on
	// navigation away, recreating it on return. `creatingParticles` guards
	// against a double-create race: `LogoParticlesScene.create()` awaits an
	// async bake (bakeLogoImage), and `afterNavigate` can fire again (e.g. a
	// fast nav away and back) while that create is still in flight. The
	// `el.isConnected` recheck after the await covers the case where the
	// element that was present when the create started has since been
	// unmounted by a navigation that completed before the create resolved.
	async function syncParticlesScene() {
		if (!engine) return; // /dev/ routes (or no WebGPU) never boot the layout engine
		const el = document.querySelector('[data-gpu-logo]');
		if (el && !logoScene && !creatingParticles) {
			creatingParticles = true;
			try {
				const created = await LogoParticlesScene.create({ engine, element: el, fluidScene });
				if (!engine || !el.isConnected) {
					created.destroy();
					return;
				}
				logoScene = created;
				document.documentElement.classList.add('gpu-particles-live');
			} finally {
				creatingParticles = false;
			}
		} else if (!el && logoScene) {
			logoScene.destroy();
			logoScene = undefined;
			document.documentElement.classList.remove('gpu-particles-live');
		}
	}

	onMount(async () => {
		if (page.url.pathname.startsWith('/dev/')) return; // dev routes boot their own engine
		engine = await createEngine({ canvas });
		if (!engine) return; // no WebGPU / reduced motion → DOM-only experience

		fluidScene = new FluidScene({ engine });
		grainPass = createGrainPass({ engine });
		unsubGrainResize = engine.onResize(() => {
			const size = engine.getCanvasSize();
			grainPass.resize(size.width, size.height);
		});

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

		await syncParticlesScene();
	});

	onDestroy(() => {
		// SvelteKit's SSR/prerender runs onDestroy callbacks synchronously right
		// after rendering each component (svelte/src/internal/server/index.js),
		// unlike the browser where onDestroy only fires on real unmount — so this
		// callback also executes during the build's prerender pass, where
		// `window`/`document` do not exist. `engine`/`fluidScene`/`logoScene`/etc.
		// are always undefined there too (onMount never runs server-side), so
		// their `?.` calls are already safe; only the unconditional `window`/
		// `document` references need the explicit guards.
		if (typeof window !== 'undefined') window.removeEventListener('resize', syncCanvasSize);
		unsubGrainResize?.();
		debugPanel?.destroy();
		grainPass?.destroy();
		logoScene?.destroy();
		if (typeof document !== 'undefined')
			document.documentElement.classList.remove('gpu-particles-live');
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
