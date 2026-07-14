// Dev-only. Callers must gate on shouldShowPanel() before importing anything heavy.
export function shouldShowPanel() {
	return import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
}

export async function maybeCreatePanel({ fluidScene, grainPass, engine, forceProgress }) {
	if (!shouldShowPanel()) return null;
	const { Pane } = await import('tweakpane');
	const pane = new Pane({ title: 'GPU debug' });

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
		fluidScene.sim.resize();
		fluidScene.curtainsTexture.copyGPUTexture(fluidScene.sim.output.texture);
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
			unsub();
			pane.dispose();
		}
	};
}
