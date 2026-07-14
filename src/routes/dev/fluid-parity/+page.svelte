<script>
	import { onMount, onDestroy } from 'svelte';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidScene } from '$lib/gpu/scenes/FluidScene.js';
	import { createGrainPass } from '$lib/gpu/passes/GrainPass.js';
	import { maybeCreatePanel } from '$lib/gpu/debug/panel.js';

	let newCanvas;
	let engine;
	let scene;
	let grain;
	let wrapObserver;
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

		// No fixed seed here (unlike the old WebGL-vs-WebGPU parity checks this
		// route used to run pre-cutover): production (src/routes/+layout.svelte)
		// intentionally draws non-deterministic splats, so this dev harness now
		// mirrors that default (`FluidScene`'s `seed = Date.now()` default —
		// see src/lib/gpu/scenes/FluidScene.js) instead of pinning to seed 1234.
		scene = new FluidScene({ engine });
		grain = createGrainPass({ engine });

		scene.sim.multipleSplats(10);

		panel = await maybeCreatePanel({ fluidScene: scene, grainPass: grain, engine, forceProgress });
	});

	onDestroy(() => {
		wrapObserver?.disconnect();
		panel?.destroy();
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
		<h2>WebGPU fluid</h2>
		<div class="sim sim-wrap"><canvas bind:this={newCanvas}></canvas></div>
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
