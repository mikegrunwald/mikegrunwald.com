<script>
	import { onMount, onDestroy } from 'svelte';
	import { Texture, FullscreenPlane } from 'gpu-curtains';
	import { createEngine } from '$lib/gpu/engine.js';
	import { FluidSimulation } from '$lib/gpu/fluid/FluidSimulation.js';
	import { mulberry32 } from '$lib/gpu/utils/rng.js';

	let newCanvas;
	let engine;
	let sim;
	let dyeDebugTexture;
	let debugPlane;
	let stopFrame;
	let wrapObserver;
	let status = $state('booting…');

	// TEMPORARY (until Task 9): pass-through fragment sampling sim.dyeTexture,
	// mirroring gpu-curtains' own ShaderPass default fragment shader pattern
	// (struct VSOutput + textureSample(<name>, defaultSampler, uv)).
	const DYE_DEBUG_FRAG = `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@fragment fn main(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(dyeTexture, defaultSampler, fsInput.uv);
  return vec4f(color.rgb, 1.0);
}`;

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
		const syncCanvasSize = () => {
			const rect = newCanvas.parentElement.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			engine.curtains.renderer.resize({
				width: rect.width,
				height: rect.height,
				top: rect.top,
				left: rect.left
			});
			sim?.resize();
		};
		wrapObserver = new ResizeObserver(syncCanvasSize);
		wrapObserver.observe(newCanvas.parentElement);
		syncCanvasSize();

		sim = new FluidSimulation({
			device: engine.device,
			queue: engine.queue,
			getCanvasSize: engine.getCanvasSize,
			rng: mulberry32(1234)
		});
		// give the hover pointer a color so splats show
		for (const p of engine.input.pointers) p.color = sim.generateColor();
		sim.multipleSplats(10); // visible immediately without pointer interaction

		// TEMPORARY debug view: bridge the raw dye GPUTexture into a gpu-curtains
		// Texture via copyGPUTexture (aliases the texture, no copy), then sample it
		// from a FullscreenPlane. Task 9 replaces this with the real composite.
		dyeDebugTexture = new Texture(engine.curtains, {
			label: 'dye debug texture',
			name: 'dyeTexture',
			format: 'rgba16float',
			fixedSize: { width: sim.dye.width, height: sim.dye.height },
			autoDestroy: false // lifecycle owned by FluidSimulation, not this wrapper
		});
		debugPlane = new FullscreenPlane(engine.curtains, {
			label: 'dye debug view',
			textures: [dyeDebugTexture],
			shaders: { fragment: { code: DYE_DEBUG_FRAG } }
		});

		let last = performance.now();
		stopFrame = engine.onFrame(() => {
			const now = performance.now();
			const dt = Math.min((now - last) / 1000, 0.016666);
			last = now;
			if (engine.hidden) return;
			sim.updateColors(dt);
			sim.applyPointers(engine.input.pointers);
			const encoder = engine.device.createCommandEncoder();
			sim.step(dt, encoder);
			sim.applyBloom(encoder);
			sim.applySunrays(encoder);
			engine.queue.submit([encoder.finish()]);
			dyeDebugTexture.copyGPUTexture(sim.dyeTexture.texture);
		});
	});

	onDestroy(() => {
		wrapObserver?.disconnect();
		stopFrame?.();
		sim?.destroy();
		engine?.destroy();
	});
</script>

<svelte:head><title>Fluid parity — dev</title></svelte:head>

<div class="parity">
	<div class="pane">
		<h2>New (WebGPU)</h2>
		<div class="sim sim-wrap"><canvas bind:this={newCanvas}></canvas></div>
	</div>
	<div class="pane">
		<h2>Old (WebGL)</h2>
		<canvas class="sim" id="old-sim"></canvas>
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
	.sim-wrap {
		position: relative;
	}
	.sim-wrap :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.status {
		grid-column: 1 / -1;
		color: #0f0;
		font-family: monospace;
	}
</style>
