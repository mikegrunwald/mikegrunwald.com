<script>
	import { onMount, onDestroy } from 'svelte';
	import { createEngine } from '$lib/gpu/engine.js';

	let newCanvas;
	let engine;
	let status = $state('booting…');

	onMount(async () => {
		engine = await createEngine({ canvas: newCanvas });
		status = engine ? 'WebGPU engine running' : 'WebGPU unavailable';
	});

	onDestroy(() => engine?.destroy());
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
