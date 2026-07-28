import { describe, it, expect } from 'vitest';
import { createLiveProxy } from '../debug/panel.js';

// createLiveProxy backs a Tweakpane binding target with a persistent cache so a
// panel that outlives its scene (destroyed on navigation / section unmount)
// still reads and EXPORTS the last real values instead of the old `?? 0` miss —
// the bug that made "Copy preset JSON" emit zeros for the whole Carousel folder.

describe('createLiveProxy', () => {
	it('returns the typed fallback before any scene exists', () => {
		const proxy = createLiveProxy(() => null, { autoRadius: true });
		expect(proxy.autoRadius).toBe(true); // right-typed, so Tweakpane builds a checkbox
		expect(proxy.ringGap).toBe(0); // numbers fall through to 0
	});

	it('reads live values while the scene is present', () => {
		const scene = { params: { ringGap: 0.18, planeWidth: 3.6 } };
		const proxy = createLiveProxy(() => scene);
		expect(proxy.ringGap).toBe(0.18);
		expect(proxy.planeWidth).toBe(3.6);
	});

	it('retains the last real value after the scene disappears (the export fix)', () => {
		let scene = { params: { entranceSlide: 2, ringGap: 0.1 } };
		const getScene = () => scene;
		const proxy = createLiveProxy(getScene);

		// Warm the cache by reading while the scene is live (this is what
		// pane.refresh() does when the scene connects).
		expect(proxy.entranceSlide).toBe(2);
		expect(proxy.ringGap).toBe(0.1);

		// Scene destroyed (navigated away). Old proxy would now answer 0.
		scene = null;
		expect(proxy.entranceSlide).toBe(2);
		expect(proxy.ringGap).toBe(0.1);
	});

	it('warms 0 and false from the live scene without treating them as misses', () => {
		let scene = { params: { velocityGain: 0, autoRadius: false } };
		const proxy = createLiveProxy(() => scene, { autoRadius: true });
		expect(proxy.velocityGain).toBe(0);
		expect(proxy.autoRadius).toBe(false);
		scene = null;
		// The warmed 0/false survive rather than reverting to fallback/0.
		expect(proxy.velocityGain).toBe(0);
		expect(proxy.autoRadius).toBe(false);
	});

	it('writes through to the live scene and persists writes across absence', () => {
		let scene = { params: { entranceSlide: 2 } };
		const getScene = () => scene;
		const proxy = createLiveProxy(getScene);

		proxy.entranceSlide = 3.5;
		expect(scene.params.entranceSlide).toBe(3.5); // reached the live scene

		scene = null;
		proxy.entranceSlide = 4; // set with no scene present must not throw
		expect(proxy.entranceSlide).toBe(4); // and is retained for export

		scene = { params: { entranceSlide: 999 } }; // a fresh scene re-warms on read
		expect(proxy.entranceSlide).toBe(999);
	});
});
