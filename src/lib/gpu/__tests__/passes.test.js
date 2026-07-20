import { describe, it, expect } from 'vitest';
import {
	getBindGroupCacheKey,
	clearPassCaches,
	runPass,
	getBindGroupStats
} from '../fluid/passes.js';

// Minimal fakes for the WebGPU objects runPass touches — enough to exercise
// the cache decision (create vs. reuse) without a real GPUDevice.
function makeFakeDevice() {
	let calls = 0;
	return {
		queue: { writeBuffer: () => {} },
		createBindGroup: () => {
			calls++;
			return { id: calls };
		},
		get calls() {
			return calls;
		}
	};
}

function makeFakeEncoder() {
	return {
		beginRenderPass: () => ({
			setPipeline: () => {},
			setBindGroup: () => {},
			draw: () => {},
			end: () => {}
		})
	};
}

function makeFakePass() {
	return {
		pipeline: { getBindGroupLayout: () => ({}) },
		uniformBuffer: {},
		samplers: [],
		label: 'test-pass',
		bindGroupCache: new Map()
	};
}

describe('getBindGroupCacheKey', () => {
	it('same view objects (by identity) produce the same key across calls', () => {
		const viewA = {};
		const viewB = {};
		expect(getBindGroupCacheKey([viewA, viewB])).toBe(getBindGroupCacheKey([viewA, viewB]));
	});

	it('swapping in a different view object produces a different key', () => {
		const viewA = {};
		const viewB = {};
		const viewC = {};
		expect(getBindGroupCacheKey([viewA, viewB])).not.toBe(getBindGroupCacheKey([viewA, viewC]));
	});

	it('is order-sensitive', () => {
		const viewA = {};
		const viewB = {};
		expect(getBindGroupCacheKey([viewA, viewB])).not.toBe(getBindGroupCacheKey([viewB, viewA]));
	});

	it('returns the same empty key for no textureViews (undefined or [])', () => {
		expect(getBindGroupCacheKey(undefined)).toBe(getBindGroupCacheKey([]));
	});
});

describe('clearPassCaches', () => {
	it('clears bindGroupCache on every pass in the passes object', () => {
		const passes = {
			a: { bindGroupCache: new Map([['x', 1]]) },
			b: { bindGroupCache: new Map([['y', 2]]) }
		};
		clearPassCaches(passes);
		expect(passes.a.bindGroupCache.size).toBe(0);
		expect(passes.b.bindGroupCache.size).toBe(0);
	});

	it('tolerates a pass with no bindGroupCache', () => {
		expect(() => clearPassCaches({ a: {} })).not.toThrow();
	});
});

describe('runPass bind-group caching', () => {
	it('reuses the cached bind group across calls with identity-equal textureViews', () => {
		const device = makeFakeDevice();
		const encoder = makeFakeEncoder();
		const pass = makeFakePass();
		const target = { view: {} };
		const view = {};

		const before = getBindGroupStats();
		runPass(device, encoder, pass, { target, textureViews: [view] });
		runPass(device, encoder, pass, { target, textureViews: [view] });
		const after = getBindGroupStats();

		expect(device.calls).toBe(1);
		expect(pass.bindGroupCache.size).toBe(1);
		expect(after.created - before.created).toBe(1);
		expect(after.reused - before.reused).toBe(1);
	});

	it('creates a new bind group when textureViews identity changes (e.g. ping-pong swap)', () => {
		const device = makeFakeDevice();
		const encoder = makeFakeEncoder();
		const pass = makeFakePass();
		const target = { view: {} };

		runPass(device, encoder, pass, { target, textureViews: [{}] });
		runPass(device, encoder, pass, { target, textureViews: [{}] });

		expect(device.calls).toBe(2);
		expect(pass.bindGroupCache.size).toBe(2);
	});

	it('re-creates the bind group after clearPassCaches, even for a previously-seen view', () => {
		const device = makeFakeDevice();
		const encoder = makeFakeEncoder();
		const pass = makeFakePass();
		const target = { view: {} };
		const view = {};

		runPass(device, encoder, pass, { target, textureViews: [view] });
		expect(device.calls).toBe(1);

		clearPassCaches({ pass });
		runPass(device, encoder, pass, { target, textureViews: [view] });
		expect(device.calls).toBe(2);
	});
});
