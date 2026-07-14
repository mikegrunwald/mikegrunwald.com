<script>
	import { onMount, onDestroy } from 'svelte';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidScene } from '$lib/gpu/scenes/FluidScene.js';
	import { createGrainPass } from '$lib/gpu/passes/GrainPass.js';
	import WebGLFluid from '$lib/efx/WebGLFluid';
	import { mulberry32 } from '$lib/gpu/utils/rng.js';

	let newCanvas;
	let oldCanvas;
	let engine;
	let scene;
	let grain;
	let oldFluid;
	let wrapObserver;
	let status = $state('booting…');
	let progress = $state(0);

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
		// NOTE: this only calls `renderer.resize()`. FluidScene registers its own
		// `renderer.onAfterResize` callback (a single-callback slot in
		// gpu-curtains) to run `sim.resize()` and re-bridge the gpu-curtains
		// texture in the same tick — do not also call `scene.sim.resize()` here,
		// it would double-resize and/or fight that single callback slot.
		//
		// GrainPass composes around that same single-slot constraint instead of
		// fighting it: it doesn't touch `onAfterResize` at all (see GrainPass.js
		// doc comment), so its `resize()` is driven from this route's own
		// ResizeObserver signal, right after the renderer itself has resized (so
		// `engine.getCanvasSize()` below already reflects the new drawing-buffer
		// pixel size).
		const syncCanvasSize = () => {
			const rect = newCanvas.parentElement.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			engine.curtains.renderer.resize({
				width: rect.width,
				height: rect.height,
				top: rect.top,
				left: rect.left
			});
			if (grain) grain.resize(engine.getCanvasSize().width, engine.getCanvasSize().height);
		};
		wrapObserver = new ResizeObserver(syncCanvasSize);
		wrapObserver.observe(newCanvas.parentElement);
		syncCanvasSize();

		scene = new FluidScene({ engine, seed: 1234 });
		grain = createGrainPass({ engine });

		// Old (WebGL) sim — exact production config from src/routes/+layout.svelte:67-103,
		// plus a seeded RNG (Task 10 patch) so the two sims draw identical splat
		// sequences from the same seed. The old sim self-drives its own rAF loop and
		// reads document-level pointer listeners directly, same as production; both
		// panes therefore receive the same live mouse events natively.
		oldFluid = WebGLFluid(oldCanvas, {
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
			// Production computes this as `Number.parseInt(Math.random() * 100) + 5`.
			// Fixed here instead: IMMEDIATE and AUTO are both false, so SPLAT_COUNT is
			// never read by the sim itself (it only gates the IMMEDIATE auto-splat on
			// construction and the AUTO interval, both disabled) — the seeded burst
			// below is triggered explicitly via multipleSplats(10). Using a fixed
			// value avoids drawing from unseeded global Math.random() for a knob that
			// has no effect on this route, and keeps the route's own setup fully
			// deterministic/documented rather than incidentally so.
			SPLAT_COUNT: 10,
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
			},
			RNG: mulberry32(1234)
		});

		// Identical seed + identical draw order (generateColor no longer consumes
		// RNG in either sim; each splat draws x, y, dx, dy in that order) → identical
		// splat positions/velocities/colors in both panes.
		scene.sim.multipleSplats(10);
		oldFluid.multipleSplats(10);
	});

	onDestroy(() => {
		wrapObserver?.disconnect();
		grain?.destroy();
		scene?.destroy();
		engine?.destroy();
	});

	function onProgressInput(event) {
		progress = Number(event.target.value);
		scene?.setProgress(progress);
	}
</script>

<svelte:head><title>Fluid parity — dev</title></svelte:head>

<div class="parity">
	<div class="pane">
		<h2>New (WebGPU)</h2>
		<div class="sim sim-wrap"><canvas bind:this={newCanvas}></canvas></div>
	</div>
	<div class="pane">
		<h2>Old (WebGL)</h2>
		<canvas
			class="sim"
			id="old-sim"
			bind:this={oldCanvas}
			style="filter:
				invert({progress * 100}%)
				opacity({50 * progress + (100 - 100 * progress)}%)
				hue-rotate({progress * 180}deg)
				saturate({0.333 * progress + (1 - progress)})"
		></canvas>
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
		grid-template-columns: 1fr 1fr;
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
	/* Task 11: fair visual reference for GrainPass. The production `.app`
	   background (src/routes/+layout.svelte) carries this same
	   background-image rule (url, no background-size — native 1 image px ==
	   1 CSS px, tiled), but it's normally hidden behind this dev route's own
	   opaque `.parity` backdrop. Applying it directly to the old pane lets
	   Step 3 compare the new WebGPU pane's grain tile size/character against
	   the real CSS compositing, instead of the featureless #111. */
	#old-sim {
		background-image: url('/images/noise.webp');
	}
	.sim-wrap {
		position: relative;
	}
	.sim-wrap :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
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
