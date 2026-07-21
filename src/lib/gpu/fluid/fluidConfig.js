// Production fluid-sim config, copied verbatim from src/routes/+layout.svelte:67-103.
// Values are tuned production constants — do not round or "fix" them.
export const FLUID_CONFIG = {
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
	SPLAT_COUNT_MIN: 5, // original: parseInt(rng()*100) + 5 — computed at boot with rng
	SPLAT_COUNT_RANGE: 100,
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
	PRIMARY_RGB: { r: 0.0, g: 0.05, b: 0.07 }
};

// Pure port of WebGLFluid.js:1654-1670.
export function getResolution(resolution, bufferWidth, bufferHeight) {
	let aspectRatio = bufferWidth / bufferHeight;
	if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

	const min = Math.round(resolution);
	const max = Math.round(resolution * aspectRatio);

	if (bufferWidth > bufferHeight) return { width: max, height: min };
	return { width: min, height: max };
}
