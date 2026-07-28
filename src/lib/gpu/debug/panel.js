import { soundConfig, EVENTS, NONE } from '$lib/audio/config.js';
import { SOUND_NAMES } from '$lib/audio/core/index.js';
import { play, unlock } from '$lib/audio/engine.js';

// Dev-only. Callers must gate on shouldShowPanel() before importing anything heavy.
export function shouldShowPanel() {
	// return import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
	return new URLSearchParams(location.search).has('debug');
}

// A Tweakpane binding target for a scene whose lifetime is shorter than the
// panel's (not-yet-created on `/`, absent on non-home routes, destroyed when its
// section unmounts). The panel outlives the scene, so binding straight to
// `scene.params` is impossible and the old approach was a Proxy that answered
// `?? 0` on every miss.
//
// That `?? 0` is exactly what made "Copy preset JSON" emit zeros: `pane.
// exportState()` RE-READS every binding, so exporting while the scene was absent
// snapshotted 0 for the whole folder even though the sliders still displayed the
// real (last-refreshed) values. This backs the proxy with a persistent `store`
// that stays warm with the last value seen from the live scene, so reads — and
// therefore exports — keep returning real values across the scene's absences.
//
// `fallbacks` supplies a right-typed seed for params Tweakpane must type-infer
// before the scene exists (e.g. a color's {r,g,b}); a bare 0 would build the
// wrong control. Numbers can keep the plain 0 fallback.
export function createLiveProxy(getScene, fallbacks = {}) {
	const store = {};
	return new Proxy(
		{},
		{
			get: (_, key) => {
				const params = getScene()?.params;
				// Warm the cache whenever the scene is live. Guard on `!== undefined`
				// so a legitimate 0/false overwrites the store but a missing key does
				// not wipe a previously-warmed value.
				if (params && params[key] !== undefined) store[key] = params[key];
				return store[key] ?? fallbacks[key] ?? 0;
			},
			set: (_, key, value) => {
				store[key] = value;
				const params = getScene()?.params;
				if (params) params[key] = value;
				return true;
			}
		}
	);
}

export async function maybeCreatePanel({
	fluidScene,
	grainPass,
	engine,
	forceProgress,
	getLogoScene,
	getCarouselScene
}) {
	if (!shouldShowPanel()) return null;
	const { Pane } = await import('tweakpane');
	const pane = new Pane({ title: 'GPU debug' });

	// Tweakpane's default wrapper (.tp-dfwv) is `position: absolute` on <body>,
	// so it scrolls away with the page — useless on a document several viewports
	// tall when the thing you are tuning is pinned to the viewport. Pin it.
	// The z-index is set alongside because the default is `auto`: once the panel
	// is taken out of the scroll flow, any positioned page content (the cursor
	// dot sits at 100) would otherwise be able to render over it.
	// `.tp-dfwv` only exists when Tweakpane creates its own wrapper (no
	// `container` option), hence the fallback to the pane's own element.
	const paneRoot = pane.element.closest('.tp-dfwv') ?? pane.element;
	paneRoot.style.position = 'fixed';
	paneRoot.style.zIndex = '1000';
	// Font: bind to the site's mono stack (Roboto Mono, loaded from Google Fonts
	// in app.html) instead of Tweakpane's built-in fallback list, which names the
	// same face but only as an unloaded local() lookup. `--tp-base-font-family` is
	// the variable Tweakpane's own `.tp-rotv` reads for `--bs-ff`; setting it on
	// the root lets it inherit down to every blade, input, and button (their CSS
	// is `font-family: inherit`). `--font-family-mono` resolves via :root.
	paneRoot.style.setProperty('--tp-base-font-family', 'var(--font-family-mono)');
	// Reset letter-spacing to normal. The site sets a tight global tracking
	// (letter-spacing: -0.066em, ~-2.1px at the 32px root) on :root/body that
	// otherwise inherits straight into every panel label and value, squishing the
	// mono text. `normal` here stops that inheritance for the whole panel;
	// Tweakpane's own folder-title spacing is set on its elements directly and so
	// is unaffected.
	paneRoot.style.letterSpacing = 'normal';
	// 80px wider than Tweakpane's 256px default (→ 336px): the longer binding
	// labels (DENSITY_DISSIPATION, PRESSURE_ITERATIONS) were truncated at the
	// default width.
	paneRoot.style.width = '336px';

	const sim = fluidScene.params;
	// Every folder starts collapsed (expanded: false) — the full panel is several
	// screens tall, so opening only the one being tuned keeps it manageable.
	const fluid = pane.addFolder({ title: 'Fluid', expanded: false });
	fluid.addBinding(sim, 'DENSITY_DISSIPATION', { min: 0, max: 8 });
	fluid.addBinding(sim, 'VELOCITY_DISSIPATION', { min: 0, max: 4 });
	fluid.addBinding(sim, 'PRESSURE', { min: 0, max: 1 });
	fluid.addBinding(sim, 'PRESSURE_ITERATIONS', { min: 1, max: 60, step: 1 });
	fluid.addBinding(sim, 'CURL', { min: 0, max: 50 });
	fluid.addBinding(sim, 'SPLAT_RADIUS', { min: 0.01, max: 1 });
	fluid.addBinding(sim, 'SPLAT_FORCE', { min: 1000, max: 12000, step: 100 });
	fluid.addBinding(sim, 'SHADING');
	fluid.addBinding(sim, 'PAUSED');
	fluid.addBinding(sim, 'PRIMARY_RGB', { color: { type: 'float' } });
	fluid
		.addButton({ title: 'Random splats' })
		.on('click', () => fluidScene.sim.multipleSplats(Math.floor(Math.random() * 20) + 5));

	const bloom = pane.addFolder({ title: 'Bloom + Sunrays', expanded: false });
	bloom.addBinding(sim, 'BLOOM');
	bloom.addBinding(sim, 'BLOOM_INTENSITY', { min: 0, max: 2 });
	bloom.addBinding(sim, 'BLOOM_THRESHOLD', { min: 0, max: 2 });
	bloom.addBinding(sim, 'BLOOM_SOFT_KNEE', { min: 0, max: 2 });
	bloom.addBinding(sim, 'SUNRAYS');
	bloom.addBinding(sim, 'SUNRAYS_WEIGHT', { min: 0.3, max: 1 });

	// Resolution changes require target rebuilds. sim.resize() destroys and
	// recreates sim.output (FluidSimulation.resize()), but FluidScene's
	// copyGPUTexture re-bridge only runs via renderer.onAfterResize — which a
	// panel-driven rebuild never triggers. Without re-bridging here, the display
	// plane keeps sampling the destroyed GPUTexture (black canvas + WebGPU
	// validation errors on the next presented frame).
	const rebuildTargets = () => {
		fluidScene.resizeSim();
	};
	const res = pane.addFolder({ title: 'Resolutions (rebuilds targets)', expanded: false });
	res
		.addBinding(sim, 'SIM_RESOLUTION', { options: { 32: 32, 64: 64, 128: 128, 256: 256 } })
		.on('change', rebuildTargets);
	res
		.addBinding(sim, 'DYE_RESOLUTION', { options: { high: 1024, medium: 512, low: 256 } })
		.on('change', rebuildTargets);

	const grading = pane.addFolder({ title: 'Scroll grading', expanded: false });
	const gradingState = { override: false, progress: 0 };
	grading.addBinding(gradingState, 'override').on('change', () => {
		forceProgress(gradingState.override ? gradingState.progress : null);
	});
	grading.addBinding(gradingState, 'progress', { min: 0, max: 1 }).on('change', () => {
		if (gradingState.override) forceProgress(gradingState.progress);
	});

	if (grainPass) {
		const grain = pane.addFolder({ title: 'Grain', expanded: false });
		grain.addBinding(grainPass.params, 'intensity', { min: 0, max: 1 });
		grain.addBinding(grainPass.params, 'scale', { min: 0.25, max: 4 });
	}

	// Dev-only sound auditioning. Binds to the same soundConfig object CursorDot
	// reads, so changes here are heard on the very next hover — no reload.
	const sounds = pane.addFolder({ title: 'Sounds', expanded: false });
	// Dropdown options: None + every core sound, e.g. { None: 'none', 'modal-open': 'modal-open', … }
	const soundOptions = {
		None: NONE,
		...Object.fromEntries(SOUND_NAMES.map((n) => [n, n]))
	};
	for (const event of EVENTS) {
		sounds.addBinding(soundConfig, event, { label: event, options: soundOptions });
		sounds.addButton({ title: `test ${event}` }).on('click', async () => {
			await unlock();
			play(soundConfig[event]);
		});
	}
	sounds.addBinding(soundConfig, 'volume', { min: 0, max: 1, step: 0.01 });
	sounds.addBinding(soundConfig, 'muted');
	sounds.addButton({ title: 'Copy sound config' }).on('click', () => {
		const { enter, leave, click, volume, muted } = soundConfig;
		navigator.clipboard.writeText(JSON.stringify({ enter, leave, click, volume, muted }, null, 2));
	});

	let disposed = false;
	let sceneWatchRafId = null;
	let carouselWatchRafId = null;

	if (getLogoScene) {
		const particles = pane.addFolder({ title: 'Particles', expanded: false });
		// The scene may not exist yet (not-yet-created on `/`, or non-home route)
		// — bind through a cache-backed proxy that reads/writes the live scene's
		// params when present and retains the last real values when it is absent
		// (see createLiveProxy). Verified against Tweakpane v4's BindingTarget
		// (node_modules/tweakpane/dist/tweakpane.js): simple number bindings
		// call `read()`/`write()`, which are plain `obj[key]` / `obj[key] = v`
		// property accesses — no `in`/`ownKeys` checks — so the Proxy's get/set
		// traps are sufficient. `count` is intentionally NOT a live binding — it
		// requires buffer rebuilds; changing it stays a code-level decision.
		// `color` needs a right-typed fallback so Tweakpane infers a color control
		// before the scene exists (a scalar 0 would build the wrong control).
		const proxy = createLiveProxy(getLogoScene, { color: { r: 1, g: 1, b: 1 } });
		// Safety-valve (2026-07-17): count is resolved once at scene creation
		// (conservative default, or the `?pcount=N` URL override — see
		// LogoParticlesScene.js) and rebuilding the particle buffers live isn't
		// wired up, so this is display-only — readonly, not a live binding like
		// the params below it.
		particles.addBinding(proxy, 'count', { readonly: true });
		particles.addBinding(proxy, 'size', { min: 0.001, max: 0.02 });
		particles.addBinding(proxy, 'opacity', { min: 0, max: 1 });
		// Flat particle tint, {r,g,b} floats 0..1 — same shape/convention as the
		// fluid's PRIMARY_RGB binding above. Defaults to the logo.svg fill.
		particles.addBinding(proxy, 'color', { color: { type: 'float' } });
		particles.addBinding(proxy, 'spring', { min: 0, max: 20 });
		particles.addBinding(proxy, 'damping', { min: 0, max: 10 });
		particles.addBinding(proxy, 'curlStrength', { min: 0, max: 1 });
		particles.addBinding(proxy, 'curlScale', { min: 0.5, max: 10 });
		particles.addBinding(proxy, 'curlSpeed', { min: 0, max: 2 });
		particles.addBinding(proxy, 'pointerRadius', { min: 0.02, max: 0.5 });
		particles.addBinding(proxy, 'pointerForce', { min: 0, max: 5 });
		particles.addBinding(proxy, 'coupling', { min: 0, max: 2 });
		particles.addBinding(proxy, 'shimmerSpeed', { min: 0, max: 5 });
		particles.addBinding(proxy, 'shimmerIntensity', { min: 0, max: 1 });
		// Capped at 1 (not the earlier-drafted 2): T7 review found sizeVariation
		// > 2.86 flips sprite corners in the shader's per-particle size formula.
		particles.addBinding(proxy, 'sizeVariation', { min: 0, max: 1 });
		particles.addBinding(proxy, 'glintGain', { min: 0, max: 5 });
		particles.addBinding(proxy, 'maxTilt', { min: 0, max: 30 });
		particles.addBinding(proxy, 'tiltEase', { min: 0.01, max: 0.3 });
		particles.addBinding(proxy, 'tiltDepth', { min: 0, max: 0.5 });

		// The scene mounts asynchronously after the panel is created (bake +
		// buffer setup race — see +layout.svelte's syncParticlesScene), so the
		// proxy's initial `read()` at bind time can land before `getLogoScene()`
		// resolves to a real scene, seeding every slider's displayed value at
		// the proxy's `?? 0` fallback instead of the scene's real defaults.
		// Identity-watch the scene across its lifetime: refresh the pane whenever
		// getLogoScene() returns a different instance (covers both first-load and
		// navigation-recreate). Non-home routes never create a logo scene at all,
		// so this must stop polling once the panel is destroyed (see `destroy()`
		// below) — otherwise it rAF-loops forever on e.g. /work?debug. Home-route
		// layout creates the panel BEFORE the scene, making this watcher load-bearing.
		let lastLogoScene = null;
		const watchSceneIdentity = () => {
			if (disposed) return;
			const scene = getLogoScene();
			if (scene !== lastLogoScene) {
				lastLogoScene = scene;
				if (scene) pane.refresh();
			}
			sceneWatchRafId = requestAnimationFrame(watchSceneIdentity);
		};
		watchSceneIdentity();
	}

	if (getCarouselScene) {
		const carousel = pane.addFolder({ title: 'Carousel', expanded: false });
		// Same cache-backed proxy as Particles above (see createLiveProxy): reads
		// warm from the live scene and survive its absence, so "Copy preset JSON"
		// round-trips the real values instead of the old `?? 0` miss.
		//
		// `autoRadius` needs a boolean fallback so Tweakpane infers a checkbox
		// before the scene exists — a bare 0 would build a slider for it, which no
		// later refresh repairs (same trap the Particles color binding avoided).
		const proxy = createLiveProxy(getCarouselScene, { autoRadius: true });
		// Radius is derived from the teaser count by default (ringGeometry.js), so
		// adding or removing featured entries needs no retuning. `ringRadius`
		// below only takes effect once this is off.
		carousel.addBinding(proxy, 'autoRadius');
		// Fraction of each slot left empty between teasers. Proportional by
		// construction — the gap reads the same relative to a teaser at any count.
		carousel.addBinding(proxy, 'ringGap', { min: 0, max: 0.5, step: 0.005 });
		// How much of the visible frustum one teaser may fill. Only bites when the
		// frustum is the binding constraint (portrait/narrow viewports), so in
		// practice this is the mobile size control — ringGap has no effect there.
		carousel.addBinding(proxy, 'frustumFit', { min: 0.3, max: 1, step: 0.01 });
		carousel.addBinding(proxy, 'ringRadius', { min: 1, max: 10 });
		// Ring-centre world Z. 10 == camera position (viewer at the ring's centre);
		// lower values push the centre ahead of the viewer. See CarouselScene.js.
		carousel.addBinding(proxy, 'ringDepth', { min: 2, max: 14 });
		// Ranges must comfortably exceed the defaults (3.6 x 2.03) — Tweakpane
		// CLAMPS writes to the bound range, so a max below the default would
		// silently shrink the real param the first time the slider is touched.
		carousel.addBinding(proxy, 'planeWidth', { min: 0.4, max: 8 });
		carousel.addBinding(proxy, 'planeHeight', { min: 0.3, max: 5 });
		// World-unit padding around the video for the glow to draw into. Max is
		// far above the 0.15 default because Tweakpane CLAMPS writes to the bound
		// range — a max at or below the default silently shrinks the real value
		// the first time the slider is touched.
		carousel.addBinding(proxy, 'glowPad', { min: 0, max: 1, step: 0.005 });
		carousel.addBinding(proxy, 'cornerRadius', { min: 0, max: 0.3, step: 0.001 });
		carousel.addBinding(proxy, 'borderWidth', { min: 0, max: 0.05, step: 0.001 });
		carousel.addBinding(proxy, 'glowRadius', { min: 0, max: 0.5, step: 0.002 });
		carousel.addBinding(proxy, 'glowInset', { min: 0, max: 0.5, step: 0.002 });
		carousel.addBinding(proxy, 'glowStrength', { min: 0, max: 3, step: 0.01 });
		carousel.addBinding(proxy, 'hoverGlowBoost', { min: 0, max: 5, step: 0.05 });
		carousel.addBinding(proxy, 'gradientEdge', { min: 0, max: 1, step: 0.005 });
		carousel.addBinding(proxy, 'gradientMid', { min: 0, max: 1, step: 0.005 });
		carousel.addBinding(proxy, 'rotationsPerScroll', { min: 0.25, max: 4 });
		carousel.addBinding(proxy, 'preRollTurns', { min: 0, max: 1, step: 0.01 });
		carousel.addBinding(proxy, 'velocityGain', { min: 0, max: 3 });
		carousel.addBinding(proxy, 'velocitySmoothing', { min: 0.5, max: 20 });
		carousel.addBinding(proxy, 'maxVelocityBoost', { min: 0, max: 5 });
		// Staggered slide-in entrance. Seconds between consecutive planes, seconds
		// per plane's slide, and the world-unit leftward offset it slides from.
		carousel.addBinding(proxy, 'entranceStagger', { min: 0, max: 0.5, step: 0.01 });
		carousel.addBinding(proxy, 'entranceDuration', { min: 0.1, max: 2, step: 0.05 });
		carousel.addBinding(proxy, 'entranceSlide', { min: 0, max: 6, step: 0.1 });
		// Bypass the ScrollTrigger pin for isolated tuning — forces the ring
		// visible + videos playing without scrolling into the pinned section.
		carousel
			.addButton({ title: 'Force active (bypass pin)' })
			.on('click', () => getCarouselScene()?.setActive(true));
		// Re-arm the entrance without leaving the section: toggle inactive→active so
		// setActive resets the clock and re-assigns the left→right delays.
		carousel.addButton({ title: 'Replay entrance' }).on('click', () => {
			const scene = getCarouselScene();
			if (!scene) return;
			scene.setActive(false);
			scene.setActive(true);
		});

		// Same panel-created-before-scene race as Particles: the layout builds the
		// panel before syncCarouselScene() runs, so seed the real param values once
		// the scene appears (and again on navigation-recreate) by identity-watching
		// it. Independent rafId from the logo watcher so each stops on its own.
		let lastCarouselScene = null;
		const watchCarouselIdentity = () => {
			if (disposed) return;
			const scene = getCarouselScene();
			if (scene !== lastCarouselScene) {
				lastCarouselScene = scene;
				if (scene) pane.refresh();
			}
			carouselWatchRafId = requestAnimationFrame(watchCarouselIdentity);
		};
		watchCarouselIdentity();
	}

	const eng = pane.addFolder({ title: 'Engine', expanded: false });
	eng.addBinding(engine.quality, 'tier', { readonly: true });
	eng.addBinding(engine.quality, 'dpr', { readonly: true });
	const stats = { fps: 0 };
	eng.addBinding(stats, 'fps', { readonly: true });
	let frames = 0;
	let lastFps = performance.now();
	const unsub = engine.onFrame(() => {
		frames++;
		const now = performance.now();
		if (now - lastFps >= 1000) {
			stats.fps = Math.round((frames * 1000) / (now - lastFps));
			frames = 0;
			lastFps = now;
		}
	});

	pane.addButton({ title: 'Copy preset JSON' }).on('click', () => {
		navigator.clipboard.writeText(JSON.stringify(pane.exportState(), null, 2));
	});

	return {
		pane,
		destroy() {
			disposed = true;
			if (sceneWatchRafId !== null) {
				cancelAnimationFrame(sceneWatchRafId);
			}
			if (carouselWatchRafId !== null) {
				cancelAnimationFrame(carouselWatchRafId);
			}
			unsub();
			pane.dispose();
		}
	};
}
