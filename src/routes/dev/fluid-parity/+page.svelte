<script>
	import { onMount, onDestroy } from 'svelte';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidScene } from '$lib/gpu/scenes/FluidScene.js';
	import { createGrainPass } from '$lib/gpu/passes/GrainPass.js';
	import { maybeCreatePanel } from '$lib/gpu/debug/panel.js';
	import { LogoParticlesScene } from '$lib/gpu/scenes/LogoParticlesScene.js';
	import { CarouselScene } from '$lib/gpu/scenes/CarouselScene.js';

	// Hardcoded fixture for isolated Task 3 verification — same shape Task 1's
	// selectFeaturedTeasers() produces ({ slug, title, subtitle, teaserUrl,
	// href }), real R2 video URLs already used by src/content/work/*.md so
	// this route doesn't depend on +page.server.ts's load. Task 1/2 own the
	// real data plumbing; this scaffold never imports their files.
	const DEV_TEASERS = [
		{
			slug: 'delta-x-art-basel',
			title: 'Delta x Art Basel',
			subtitle: 'New York > Miami for Art Basel',
			teaserUrl: 'https://assets.mikegrunwald.com/video/1769309792515-Delta_Air_Basel.mp4',
			href: '/work/delta-x-art-basel'
		},
		{
			slug: 'reliable-robotics',
			title: 'Reliable Robotics',
			subtitle: '',
			teaserUrl: 'https://assets.mikegrunwald.com/video/1769311803955-Reliable_Robotics.mp4',
			href: '/work/reliable-robotics'
		},
		{
			slug: 'operation-tripod',
			title: 'Operation Tripod',
			subtitle: '',
			teaserUrl: 'https://assets.mikegrunwald.com/video/operation-tripod.mp4',
			href: '/work/operation-tripod'
		}
	];

	let newCanvas;
	let logoHost;
	let engine;
	let scene;
	let grain;
	let logoScene;
	let carouselScene;
	let wrapObserver;
	let unsubGrainResize;
	let panel;
	let status = $state('booting…');
	let progress = $state(0);
	// Set (non-null) by the debug panel's grading override scrubber; while set,
	// the real range input below is ignored and this value drives scene grading.
	let progressOverride = null;

	function forceProgress(p) {
		progressOverride = p;
		if (p !== null) {
			progress = p;
			scene?.setProgress(p);
		} else {
			scene?.setProgress(progress);
		}
	}

	onMount(async () => {
		engine = await createEngine({ canvas: newCanvas });
		status = engine ? 'WebGPU engine running' : 'WebGPU unavailable';
		if (!engine) return;

		// Watch the WRAPPER (not the canvas itself) and force-resize the renderer
		// whenever its real box changes. gpu-curtains measures the canvas's own
		// bounding rect and writes the result back onto canvas.style.width/height,
		// which then overrides our CSS (`.sim-wrap canvas { width: 100%; height:
		// 100% }`) permanently — its own resize observer only watches the canvas's
		// now-pinned box, so if the *first* measurement is taken before the grid
		// layout has settled to its final size, it never self-corrects. Observing
		// the wrapper directly sidesteps that feedback loop.
		//
		// NOTE: this only calls `renderer.resize()`. gpu-curtains' single-callback
		// `renderer.onAfterResize` slot is owned exclusively by the engine, which
		// fans it out via `engine.onResize()` (Task 1 of Phase 2). FluidScene and
		// the grain wiring below both subscribe there — do not also call
		// `scene.sim.resize()` or `grain.resize()` directly from here, it would
		// double-resize and/or fight the fan-out.
		const syncCanvasSize = () => {
			const rect = newCanvas.parentElement.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			engine.curtains.renderer.resize({
				width: rect.width,
				height: rect.height,
				top: rect.top,
				left: rect.left
			});
		};
		wrapObserver = new ResizeObserver(syncCanvasSize);
		wrapObserver.observe(newCanvas.parentElement);
		syncCanvasSize();

		// No fixed seed here (unlike the old WebGL-vs-WebGPU parity checks this
		// route used to run pre-cutover): production (src/routes/+layout.svelte)
		// intentionally draws non-deterministic splats, so this dev harness now
		// mirrors that default (`FluidScene`'s `seed = Date.now()` default —
		// see src/lib/gpu/scenes/FluidScene.js) instead of pinning to seed 1234.
		scene = new FluidScene({ engine });
		grain = createGrainPass({ engine });
		unsubGrainResize = engine.onResize(() => {
			const size = engine.getCanvasSize();
			grain.resize(size.width, size.height);
		});

		scene.sim.multipleSplats(10);

		logoScene = await LogoParticlesScene.create({
			engine,
			element: logoHost,
			fluidScene: scene,
			seed: 1234
		});

		// Task 3 scaffold: static ring, no scroll/velocity/pin wiring yet — see
		// CarouselScene.js header. setActive(true) is forced here since this
		// task has no pin-window logic to gate it (Task 4's job); every mesh
		// stays visible: true regardless per this task's own layout().
		carouselScene = new CarouselScene({ engine, teasers: DEV_TEASERS });
		carouselScene.setActive(true);

		panel = await maybeCreatePanel({
			fluidScene: scene,
			grainPass: grain,
			engine,
			forceProgress,
			getLogoScene: () => logoScene,
			getCarouselScene: () => carouselScene
		});
	});

	onDestroy(() => {
		wrapObserver?.disconnect();
		unsubGrainResize?.();
		panel?.destroy();
		carouselScene?.destroy();
		logoScene?.destroy();
		grain?.destroy();
		scene?.destroy();
		engine?.destroy();
	});

	function onProgressInput(event) {
		if (progressOverride !== null) return; // panel's grading override takes priority
		progress = Number(event.target.value);
		scene?.setProgress(progress);
	}
</script>

<svelte:head><title>Fluid dev — WebGPU</title></svelte:head>

<div class="parity">
	<div class="pane">
		<h2>WebGPU fluid + logo particles + carousel ring</h2>
		<div class="sim sim-wrap">
			<canvas bind:this={newCanvas}></canvas>
			<div class="logo-host" data-gpu-logo bind:this={logoHost}></div>
		</div>
	</div>
	<div class="pane">
		<h2>Carousel ring (static scaffold, Task 3 — no scroll/velocity yet)</h2>
		<!-- CarouselScene is NOT DOM-synced (plain Mesh, not a Plane) — it
		     renders directly into the shared canvas above via the shared
		     camera, positioned entirely in 3D (ringCenter/ringRadius). This box
		     is a labeled marker/status section only, given real height so it
		     reads as its own area in the dev route, same pattern as Task 4/5's
		     [data-gpu-logo] addition in Phase 2. -->
		<div class="carousel-host" data-gpu-carousel>
			<p>
				{carouselScene ? `${carouselScene.items.length} video plane(s) in the ring` : 'booting…'}
			</p>
			<p class="hint">
				Ring centre sits ON the camera (ringDepth 10 == camera Z) — only an ~80° arc of the 360°
				ring is ever visible above, so 2 of 3 dev teasers show at a time. Verify with GPU-truth
				(mesh.position dumps), not this text.
			</p>
		</div>
	</div>
	<div class="controls">
		<label for="grading-progress">Grading progress: {progress.toFixed(2)}</label>
		<input
			id="grading-progress"
			type="range"
			min="0"
			max="1"
			step="0.01"
			value={progress}
			oninput={onProgressInput}
		/>
	</div>
	<p class="status">{status}</p>
</div>

<style>
	.parity {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
		min-height: 100vh;
		background: #000;
		padding: 8px;
	}
	.pane h2 {
		color: #fff;
		font-size: 12px;
		margin: 0 0 4px;
	}
	.sim {
		width: 100%;
		aspect-ratio: 16 / 10;
		display: block;
		background: #111;
	}
	.sim-wrap {
		position: relative;
	}
	.sim-wrap :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* DOM-sync target for LogoParticlesScene's Plane. Must overlap the WebGPU
	   canvas on screen — gpu-curtains positions the synced mesh in NDC space
	   relative to the RENDERER's (canvas's) own bounding rect
	   (DOMObject3D.mjs#documentToWorldSpace), so a box outside the canvas's
	   screen area would project outside the visible frustum. `position:
	   absolute` + `inset: 0` + `margin: 2rem auto` centers it within
	   `.sim-wrap` (classic absolute-positioning centering trick) while keeping
	   the brief's literal width/aspect-ratio/margin/outline values. */
	.logo-host {
		position: absolute;
		inset: 0;
		width: 60%;
		aspect-ratio: 1.153594844873037 / 1;
		margin: 2rem auto;
		outline: 1px dashed #333;
		pointer-events: none;
	}
	.carousel-host {
		min-height: 120px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 12px;
		outline: 1px dashed #333;
		color: #0af;
		font-family: monospace;
		font-size: 11px;
	}
	.carousel-host .hint {
		color: #888;
	}
	.controls {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 8px;
		color: #fff;
		font-family: monospace;
		font-size: 12px;
	}
	.controls input[type='range'] {
		flex: 1;
		max-width: 400px;
	}
	.status {
		grid-column: 1 / -1;
		color: #0f0;
		font-family: monospace;
	}
</style>
