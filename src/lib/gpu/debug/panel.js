// Dev-only. Callers must gate on shouldShowPanel() before importing anything heavy.
export function shouldShowPanel() {
	return import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
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

	const sim = fluidScene.params;
	const fluid = pane.addFolder({ title: 'Fluid' });
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

	const bloom = pane.addFolder({ title: 'Bloom + Sunrays' });
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
	const res = pane.addFolder({ title: 'Resolutions (rebuilds targets)' });
	res
		.addBinding(sim, 'SIM_RESOLUTION', { options: { 32: 32, 64: 64, 128: 128, 256: 256 } })
		.on('change', rebuildTargets);
	res
		.addBinding(sim, 'DYE_RESOLUTION', { options: { high: 1024, medium: 512, low: 256 } })
		.on('change', rebuildTargets);

	const grading = pane.addFolder({ title: 'Scroll grading' });
	const gradingState = { override: false, progress: 0 };
	grading.addBinding(gradingState, 'override').on('change', () => {
		forceProgress(gradingState.override ? gradingState.progress : null);
	});
	grading.addBinding(gradingState, 'progress', { min: 0, max: 1 }).on('change', () => {
		if (gradingState.override) forceProgress(gradingState.progress);
	});

	if (grainPass) {
		const grain = pane.addFolder({ title: 'Grain' });
		grain.addBinding(grainPass.params, 'intensity', { min: 0, max: 1 });
		grain.addBinding(grainPass.params, 'scale', { min: 0.25, max: 4 });
	}

	let disposed = false;
	let sceneWatchRafId = null;
	let carouselWatchRafId = null;

	if (getLogoScene) {
		const particles = pane.addFolder({ title: 'Particles' });
		// The scene may not exist yet (not-yet-created on `/`, or non-home route)
		// — bind through a proxy object that reads/writes the live scene's
		// params when present. Verified against Tweakpane v4's BindingTarget
		// (node_modules/tweakpane/dist/tweakpane.js): simple number bindings
		// call `read()`/`write()`, which are plain `obj[key]` / `obj[key] = v`
		// property accesses — no `in`/`ownKeys` checks — so the Proxy's get/set
		// traps are sufficient; no plain-object-with-refresh fallback needed.
		// `count` is intentionally NOT a live binding — it requires buffer
		// rebuilds; changing it stays a code-level decision.
		// Panel construction can precede scene creation (see the identity watcher
		// below), so the proxy has to answer with something of the RIGHT TYPE
		// before the scene exists — Tweakpane infers the control type from the
		// value present at addBinding() time, so handing a color binding the
		// scalar `0` fallback would build the wrong control (or throw) and no
		// later refresh would repair it. Numbers can keep the plain 0 fallback.
		const PARAM_FALLBACKS = { color: { r: 1, g: 1, b: 1 } };
		const proxy = new Proxy(
			{},
			{
				get: (_, key) => getLogoScene()?.params?.[key] ?? PARAM_FALLBACKS[key] ?? 0,
				set: (_, key, value) => {
					const scene = getLogoScene();
					if (scene) scene.params[key] = value;
					return true;
				}
			}
		);
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
		const carousel = pane.addFolder({ title: 'Carousel' });
		// Same proxy-through-a-maybe-missing-scene pattern as Particles above. All
		// carousel params are plain numbers, so the `?? 0` fallback is always the
		// right control TYPE (no color binding to mis-infer) and Tweakpane v4's
		// number read()/write() being plain obj[key] access means the Proxy traps
		// are sufficient — no plain-object refresh fallback needed (resolved for
		// Particles, holds identically here).
		const proxy = new Proxy(
			{},
			{
				get: (_, key) => getCarouselScene()?.params?.[key] ?? 0,
				set: (_, key, value) => {
					const scene = getCarouselScene();
					if (scene) scene.params[key] = value;
					return true;
				}
			}
		);
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
		// Bypass the ScrollTrigger pin for isolated tuning — forces the ring
		// visible + videos playing without scrolling into the pinned section.
		carousel
			.addButton({ title: 'Force active (bypass pin)' })
			.on('click', () => getCarouselScene()?.setActive(true));

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

	const eng = pane.addFolder({ title: 'Engine' });
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
