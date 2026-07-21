<script>
	import '../app.scss';
	import 'lenis/dist/lenis.css';
	import { SvelteLenis, useLenis } from 'lenis/svelte';
	import { onMount, onDestroy, setContext } from 'svelte';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { SplitText } from 'gsap/dist/SplitText';
	import { gsap } from 'gsap/dist/gsap';
	import CursorDot from '$lib/components/CursorDot.svelte';
	import { beforeNavigate, afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidScene } from '$lib/gpu/scenes/FluidScene.js';
	import { createGrainPass } from '$lib/gpu/passes/GrainPass.js';
	import { scrollProgress } from '$lib/gpu/fluid/grading.js';
	import { LogoParticlesScene } from '$lib/gpu/scenes/LogoParticlesScene.js';
	import { CarouselScene } from '$lib/gpu/scenes/CarouselScene.js';
	import { shouldLoopRunway } from '$lib/gpu/carousel/scrollModel.js';

	gsap.registerPlugin(ScrollTrigger, SplitText);

	beforeNavigate(() => {});
	afterNavigate(() => {
		if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
		syncParticlesScene();
		syncCarouselScene();
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
	let unsubDeviceLost;
	let logoScene;
	let creatingParticles = false;
	let carouselScene;
	let carouselTrigger;
	let carouselPreRollTrigger;
	let creatingCarousel = false;
	// Re-entrancy guard for the runway wrap. Without it the programmatic scroll
	// triggers another ScrollTrigger.update, which can re-enter onUpdate while
	// progress is still >= 1 and wrap repeatedly in a single frame.
	let wrappingRunway = false;

	// Teleports scroll back to the start of the pinned runway, making downward
	// scrolling loop forever. Invisible because the runway is exactly one
	// rotation, so progress 0 and progress 1 are the same ring orientation.
	function wrapRunway(self) {
		if (wrappingRunway) return;
		// `self.start` is the document scroll position where the pin engages —
		// i.e. progress 0 — so this is the runway's start, not the section's top.
		// Land 1px INSIDE the runway rather than exactly on the boundary, where
		// ScrollTrigger could immediately read us as "before the trigger" and
		// unpin. At a ~1400px runway that is under a quarter degree of rotation.
		const startY = self.start + 1;
		if (!Number.isFinite(startY)) return;
		wrappingRunway = true;
		carouselScene?.suppressVelocity();
		// MUST go through Lenis, not window.scrollTo: Lenis owns the scroll
		// position under `root: true` and would smoothly animate straight back to
		// where it was. `immediate` skips its easing; `force` overrides any
		// in-flight scrollTo.
		lenis.current?.scrollTo(startY, { immediate: true, force: true });
		// Release on the next frame rather than synchronously — the scrollTo
		// above re-enters ScrollTrigger.update() before it returns.
		requestAnimationFrame(() => {
			wrappingRunway = false;
		});
	}

	// Carousel raycast hover index (Task 6). Driven by CarouselScene's onHover
	// callback, consumed by WorkTeasers.svelte's DOM label. WorkTeasers lives in
	// +page.svelte, not here, so it's exposed via context rather than a prop
	// thread — a getter keeps the read reactive across the runes boundary without
	// a store module. `null` when nothing is hovered / no carousel on the page.
	let hoveredTeaserIndex = $state(null);
	setContext('carousel-hover', {
		get index() {
			return hoveredTeaserIndex;
		}
	});

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
		// SvelteLenis runs with root: true, so Lenis's wrapper IS window/
		// documentElement — window.scrollY genuinely advances as Lenis
		// animates, and ScrollTrigger's default scroller (window) already
		// agrees with it. No scrollerProxy needed; this one line is the whole
		// bridge, re-evaluating pins on Lenis's smoothed ticks rather than only
		// on native scroll events (which Lenis's own smoothing can decouple
		// from). Safe to call even before any ScrollTrigger instances exist —
		// it's a no-op walk over an empty list.
		ScrollTrigger.update();
		carouselScene?.setVelocity(lenis.velocity); // Task 5 consumes this
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
	// Safety-valve teardown hook passed into LogoParticlesScene — called from
	// inside the scene's own update() when its budget guard (budgetGuard.js)
	// decides the scene is unsafe to keep running (sustained slow frames
	// and/or unbounded heap growth). This is the single place that actually
	// destroys a killed scene and swaps the CSS logo back in, so `logoScene`
	// has one source of truth regardless of whether the teardown was
	// triggered by navigation (the `else if` branch below) or the guard.
	// The hero's CSS logo (HeroHeader's `.display::before`) is hidden by default
	// so the GPU handoff never flashes the original. That inverts the burden:
	// EVERY path where particles won't run must reveal it explicitly, or the
	// hero is simply empty. The paths are: no engine (no WebGPU / reduced
	// motion), `?noparticles`, a failed scene create, and a budget-guard kill.
	// `showCssLogo` is idempotent, so callers don't need to know the state.
	function showCssLogo() {
		document.documentElement.classList.add('gpu-logo-fallback');
	}
	function hideCssLogo() {
		document.documentElement.classList.remove('gpu-logo-fallback');
	}

	function destroyParticlesScene() {
		logoScene?.destroy();
		logoScene = undefined;
		document.documentElement.classList.remove('gpu-particles-live');
		showCssLogo();
	}

	async function syncParticlesScene() {
		if (!engine) return; // /dev/ routes (or no WebGPU) never boot the layout engine
		// Safety-valve URL override (read once here, per nav — production-safe,
		// no persistent state): `?noparticles` skips creating the scene
		// entirely, the CSS logo fallback stays up. See LogoParticlesScene.js's
		// header note for the sibling `?pcount=N` override (handled inside the
		// scene itself, since it needs to affect the buffer size at construction).
		if (new URLSearchParams(location.search).has('noparticles')) {
			showCssLogo();
			return;
		}
		const el = document.querySelector('[data-gpu-logo]');
		if (el && !logoScene && !creatingParticles) {
			creatingParticles = true;
			try {
				const created = await LogoParticlesScene.create({
					engine,
					element: el,
					fluidScene,
					onGuardKill: destroyParticlesScene
				});
				if (!engine || !el.isConnected) {
					created.destroy();
					return;
				}
				logoScene = created;
				// No CSS hangs off `gpu-particles-live` any more (hiding the CSS
				// logo is now the default — see showCssLogo above). It is kept as
				// a DOM-inspectable state marker: it is the only way to tell from
				// outside the app whether the particle scene is actually live,
				// which QA and automated checks rely on, since the WebGPU canvas
				// itself cannot be read back from a page-level probe.
				document.documentElement.classList.add('gpu-particles-live');
				hideCssLogo();
			} catch (err) {
				// A create failure (e.g. the logo bake failing to load an image)
				// used to escape as an unhandled rejection from afterNavigate and
				// leave the hero blank now that the CSS logo starts hidden.
				console.error('[particles] scene creation failed — falling back to the CSS logo', err);
				showCssLogo();
			} finally {
				creatingParticles = false;
			}
		} else if (!el && logoScene) {
			destroyParticlesScene();
		}
	}

	// Keys the carousel ring's lifecycle off the presence of WorkTeasers'
	// `[data-gpu-carousel]` section — present only on the homepage, same
	// pattern as syncParticlesScene above (Phase 2 Task 8). `creatingCarousel`
	// guards the same double-create race: CarouselScene's constructor kicks
	// off async video loads (loadVideo) but returns synchronously, so there's
	// no `el.isConnected` recheck needed here the way LogoParticlesScene.create
	// needs one — construction itself can't straddle a navigation the way an
	// awaited create() can. The guard is still here for symmetry and because a
	// future async CarouselScene.create() shouldn't have to rediscover this.
	function syncCarouselScene() {
		if (!engine || creatingCarousel) return;
		const el = document.querySelector('[data-gpu-carousel]');
		if (el && !carouselScene) {
			creatingCarousel = true;
			try {
				carouselScene = new CarouselScene({
					engine,
					teasers: page.data.teasers ?? [],
					onHover: (index) => {
						hoveredTeaserIndex = index;
					},
					onNavigate: (href) => goto(href)
				});
				// `trigger: el` pins WorkTeasers' 300vh runway; `onUpdate` feeds
				// ScrollTrigger's own monotonic-with-scroll-direction `progress`
				// straight into setProgress (which turns it into rotation — see
				// CarouselScene.js), and the active section drives play/pause +
				// visibility via onEnter/onEnterBack/onLeave/onLeaveBack so videos
				// only decode while the ring is actually on screen.
				carouselTrigger = ScrollTrigger.create({
					trigger: el,
					start: 'top top',
					end: 'bottom bottom',
					pin: true,
					onUpdate: (self) => {
						carouselScene?.setProgress(self.progress);
						// Fast path: catches the case where scrolling lands exactly on
						// progress 1 without crossing the end. onLeave below is the
						// path that actually fires most of the time.
						if (shouldLoopRunway(self)) wrapRunway(self);
					},
					// THE wrap trigger. onUpdate only fires while between start and
					// end, and under smooth scrolling its last call is typically at
					// progress < 1 — so relying on it alone meant the wrap never ran
					// and scrolling down simply fell off the end of the page. onLeave
					// is guaranteed to fire when crossing the end going forward.
					onLeave: (self) => wrapRunway(self)
					// No setActive here. The approach trigger owns activation now:
					// leaving the pin FORWARD wraps (so the ring must stay live), and
					// leaving it BACKWARD lands in the approach zone where the ring
					// is still supposed to be visible.
				});
				// Approach trigger: scrubs 0..1 over the last stretch before the pin
				// engages, so the ring is already onscreen and turning by the time
				// the pin takes over — which is what stops the first teaser popping
				// into the centre.
				//
				// Starts at `top 20%`, NOT `top bottom`. A full-viewport approach
				// made the ring fade up over AboutIntro's closing paragraph, so the
				// teasers and the text fought each other. At 20% the About copy has
				// essentially left the viewport before any teaser appears.
				carouselPreRollTrigger = ScrollTrigger.create({
					trigger: el,
					start: 'top 20%',
					end: 'top top',
					scrub: true,
					onUpdate: (self) => carouselScene?.setPreRoll(self.progress),
					// setActive moves here from the pin trigger: the meshes have to
					// be VISIBLE during the approach for the pre-roll to be seen at
					// all. Side effect: the videos start decoding earlier than they
					// used to (one viewport-height sooner), which is accepted.
					onEnter: () => carouselScene?.setActive(true),
					onEnterBack: () => carouselScene?.setActive(true),
					onLeaveBack: () => carouselScene?.setActive(false)
				});
			} finally {
				creatingCarousel = false;
			}
		} else if (!el && carouselScene) {
			carouselTrigger?.kill();
			carouselTrigger = undefined;
			carouselPreRollTrigger?.kill();
			carouselPreRollTrigger = undefined;
			carouselScene.destroy();
			carouselScene = undefined;
		}
	}

	onMount(async () => {
		if (page.url.pathname.startsWith('/dev/')) return; // dev routes boot their own engine
		engine = await createEngine({ canvas });
		if (!engine) {
			showCssLogo(); // no WebGPU / reduced motion → DOM-only experience
			return;
		}

		// A lost device is terminal (the engine cannot resume its render loop after
		// one), so the canvas is left frozen on whatever it last drew — which reads
		// as "the site rendered, then everything stopped moving" rather than as a
		// failure. Degrade to the same DOM-only presentation used when WebGPU is
		// unavailable: bring the CSS logo back and tear the particle scene down so
		// it isn't holding GPU resources for a device that no longer exists.
		unsubDeviceLost = engine.onDeviceLost(() => {
			destroyParticlesScene(); // also re-shows the CSS logo
			carouselTrigger?.kill();
			carouselTrigger = undefined;
			carouselPreRollTrigger?.kill();
			carouselPreRollTrigger = undefined;
			carouselScene?.destroy();
			carouselScene = undefined;
		});

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
				},
				getLogoScene: () => logoScene,
				getCarouselScene: () => carouselScene
			});
		}

		await syncParticlesScene();
		syncCarouselScene();

		// Dev-only inspection handle. The WebGPU canvas cannot be read back from
		// a page-level probe (screenshots of it come back blank), and in a hidden
		// tab the render loop is suspended, so scene state is otherwise
		// unobservable from the console or an automated check. Exposing the live
		// scenes makes GPU state inspectable the only way that works: reading the
		// objects and driving their methods directly. Stripped from production
		// builds by the import.meta.env.DEV guard.
		if (import.meta.env.DEV) {
			window.__gpu = {
				engine,
				fluidScene,
				// GSAP keeps a global ScrollTrigger registry that nothing else
				// surfaces. Exposing it makes trigger leaks measurable: the count
				// must stay CONSTANT across repeated client-side nav away-and-back,
				// not grow. (It grew by 6 per round trip until AboutIntro started
				// destroying its scroll effects.)
				ScrollTrigger,
				get logoScene() {
					return logoScene;
				},
				get carouselScene() {
					return carouselScene;
				}
			};
		}
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
		unsubDeviceLost?.();
		debugPanel?.destroy();
		grainPass?.destroy();
		logoScene?.destroy();
		if (typeof document !== 'undefined')
			document.documentElement.classList.remove('gpu-particles-live');
		carouselTrigger?.kill();
		carouselPreRollTrigger?.kill();
		carouselScene?.destroy();
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
