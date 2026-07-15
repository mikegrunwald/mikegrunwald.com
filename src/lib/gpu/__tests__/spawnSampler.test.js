import { describe, it, expect } from 'vitest';
import { sampleSpawnPoints } from '../particles/spawnSampler.js';
import { mulberry32 } from '../utils/rng.js';

// 4x2 image: only pixel (1,0) is opaque white, only pixel (2,1) is half-alpha gray.
function makeImage() {
	const data = new Uint8ClampedArray(4 * 2 * 4);
	const set = (x, y, r, g, b, a) => {
		const i = (y * 4 + x) * 4;
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
		data[i + 3] = a;
	};
	set(1, 0, 255, 255, 255, 255);
	set(2, 1, 128, 128, 128, 128);
	return { width: 4, height: 2, data };
}

describe('sampleSpawnPoints', () => {
	it('only samples pixels above the alpha threshold', () => {
		const { positions } = sampleSpawnPoints(makeImage(), {
			count: 50,
			alphaThreshold: 200,
			rng: mulberry32(1)
		});
		// Every sample must land inside pixel (1,0)'s cell: x in [0.25,0.5), y in [0,0.5)
		for (let i = 0; i < 50; i++) {
			expect(positions[i * 2]).toBeGreaterThanOrEqual(0.25);
			expect(positions[i * 2]).toBeLessThan(0.5);
			expect(positions[i * 2 + 1]).toBeGreaterThanOrEqual(0);
			expect(positions[i * 2 + 1]).toBeLessThan(0.5);
		}
	});

	it('is deterministic under a seeded rng', () => {
		const a = sampleSpawnPoints(makeImage(), { count: 20, rng: mulberry32(7) });
		const b = sampleSpawnPoints(makeImage(), { count: 20, rng: mulberry32(7) });
		expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
		expect(Array.from(a.brightness)).toEqual(Array.from(b.brightness));
	});

	it('brightness reflects pixel luminance', () => {
		const { brightness } = sampleSpawnPoints(makeImage(), {
			count: 10,
			alphaThreshold: 200,
			rng: mulberry32(3)
		});
		for (const b of brightness) expect(b).toBeCloseTo(1.0, 2); // white pixel
	});

	it('throws when nothing passes the threshold', () => {
		expect(() => sampleSpawnPoints(makeImage(), { count: 10, alphaThreshold: 255 })).toThrow();
	});

	it('returns exactly count samples', () => {
		const { positions, brightness } = sampleSpawnPoints(makeImage(), {
			count: 33,
			rng: mulberry32(5)
		});
		expect(positions.length).toBe(66);
		expect(brightness.length).toBe(33);
	});
});
