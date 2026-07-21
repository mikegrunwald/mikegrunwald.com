import { describe, it, expect } from 'vitest';
import { FLUID_CONFIG, getResolution } from '../fluid/fluidConfig.js';

describe('FLUID_CONFIG parity', () => {
	it('matches the tuned production values verbatim', () => {
		expect(FLUID_CONFIG.DENSITY_DISSIPATION).toBe(4);
		expect(FLUID_CONFIG.VELOCITY_DISSIPATION).toBe(1);
		expect(FLUID_CONFIG.PRESSURE).toBe(0.25);
		expect(FLUID_CONFIG.CURL).toBe(0.1);
		expect(FLUID_CONFIG.SPLAT_RADIUS).toBe(0.5);
		expect(FLUID_CONFIG.BLOOM_INTENSITY).toBe(0.025);
		expect(FLUID_CONFIG.BLOOM_RESOLUTION).toBe(56);
		expect(FLUID_CONFIG.BLOOM_SOFT_KNEE).toBe(1.5);
		expect(FLUID_CONFIG.SUNRAYS_RESOLUTION).toBe(256);
		// Retuned 2026-07-21, darker and less cyan than the original port. This
		// assertion exists to catch accidental drift, so it is meant to be updated
		// deliberately alongside a real change — not relaxed.
		expect(FLUID_CONFIG.PRIMARY_RGB).toEqual({ r: 0, g: 0.05, b: 0.07 });
	});
});

describe('getResolution (port of WebGLFluid.js:1654-1670)', () => {
	it('landscape: width gets the aspect-scaled max', () => {
		// 1920x1080: aspect 1.777 → min=128, max=round(128*1.777)=228
		expect(getResolution(128, 1920, 1080)).toEqual({ width: 228, height: 128 });
	});
	it('portrait: height gets the aspect-scaled max', () => {
		expect(getResolution(128, 1080, 1920)).toEqual({ width: 128, height: 228 });
	});
	it('square: both equal', () => {
		expect(getResolution(128, 1000, 1000)).toEqual({ width: 128, height: 128 });
	});
});
