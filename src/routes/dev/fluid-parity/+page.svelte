<script>
	import { onMount, onDestroy } from 'svelte';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidScene } from '$lib/gpu/scenes/FluidScene.js';
	import { createGrainPass } from '$lib/gpu/passes/GrainPass.js';
	import { maybeCreatePanel } from '$lib/gpu/debug/panel.js';
	// TEMP Task 3 bake check, removed in Task 4
	import { bakeLogoImage } from '$lib/gpu/particles/bakeLogo.js';

	let newCanvas;
	// TEMP Task 3 bake check, removed in Task 4
	let bakeCanvas;
	let engine;
	let scene;
	let grain;
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

		panel = await maybeCreatePanel({ fluidScene: scene, grainPass: grain, engine, forceProgress });

		// TEMP Task 3 bake check, removed in Task 4
		try {
			const imageData = await bakeLogoImage({ size: 512 });
			const bctx = bakeCanvas.getContext('2d');
			bakeCanvas.width = imageData.width;
			bakeCanvas.height = imageData.height;
			bctx.putImageData(imageData, 0, 0);
		} catch (err) {
			console.error('bakeLogoImage check failed', err);
		}
	});

	onDestroy(() => {
		wrapObserver?.disconnect();
		unsubGrainResize?.();
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
	<!-- TEMP Task 3 bake check, removed in Task 4 -->
	<div class="bake-check">
		<h2>Logo bake check</h2>
		<canvas id="bake-check" bind:this={bakeCanvas} width="512"></canvas>
	</div>
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
	/* TEMP Task 3 bake check, removed in Task 4 */
	.bake-check {
		grid-column: 1 / -1;
	}
	.bake-check h2 {
		color: #fff;
		font-size: 12px;
		margin: 0 0 4px;
	}
	.bake-check canvas {
		background: #222;
		max-width: 512px;
		width: 100%;
		height: auto;
	}
</style>
