// gpu-curtains 0.16.3 API resolution notes (Task 5, [VERIFY-API] markers from task-5-brief.md).
// Verified directly against node_modules/gpu-curtains/dist/types/**/*.d.ts and the
// corresponding dist/esm/**/*.mjs runtime source (types alone don't show defaults/behavior).
//
// 1. GPUCurtains constructor options — GPUCurtains.d.ts:68, GPUCurtainsParams (line 26-29).
//    - `container?: string | HTMLElement | null` (GPUCurtains.d.ts:27-28). GPURenderer.d.ts:39-40
//      documents that container "Could also be directly a HTMLCanvasElement", and
//      GPURenderer.mjs:57-59 confirms: `isContainerCanvas ? container : document.createElement('canvas')`.
//      So passing our own <canvas> as `container` makes gpu-curtains draw directly onto it
//      (no extra canvas is created/appended) — this is what we do.
//    - `pixelRatio?: number` — GPUCurtains.d.ts:68, defaulted from window.devicePixelRatio
//      (GPUCurtains.mjs:28) when omitted; we pass quality.dpr explicitly.
//    - Alpha mode: `context?: GPURendererContextParams` (GPURenderer.d.ts:46), a
//      `Partial<GPUCanvasConfiguration>`. GPURenderer.mjs:37-41 shows the default is already
//      `alphaMode: 'premultiplied'`, so `context: { alphaMode: 'premultiplied' }` is the
//      confirmed shape (redundant with the default, kept explicit for clarity/future-proofing).
//    - `autoRender?: boolean` (GPUDeviceManagerBaseParams, GPUDeviceManager.d.ts:22) — defaults
//      to `true` (GPUDeviceManager.mjs:18, GPUCurtains.mjs:28) meaning the device manager runs
//      its own requestAnimationFrame loop and calls render() every frame automatically. We keep
//      the default (do not pass autoRender) since Task 6's dev route relies on gpu-curtains'
//      own rAF loop and onFrame() is just a pre-render hook into it.
//    - `watchScroll?: boolean` (GPUCurtainsOptions, GPUCurtains.d.ts:21) — defaults to `true`
//      (GPUCurtains.mjs:28) and, when true, ScrollManager attaches its own native
//      `window.addEventListener('scroll', ...)` listener (ScrollManager.mjs:23-24) that calls
//      `updateScrollValues({ x: window.pageXOffset, y: window.pageYOffset })` on every native
//      scroll event. This repo drives scroll from Lenis (`SvelteLenis root` in
//      src/routes/+layout.svelte), and the Engine interface exposes an explicit
//      `setScroll({ y, velocity })` for callers to push Lenis values in directly. Letting
//      gpu-curtains ALSO listen to native scroll would double-drive updateScrollValues from two
//      independent sources per frame. We pass `watchScroll: false` and only ever call
//      `updateScrollValues` via our own `setScroll()`. [ADAPTED from the brief, which left this
//      option unset.]
//
// 2. Awaiting GPU init — `await curtains.setDevice()` (GPUCurtains.d.ts:116) initializes the GPU.
//    IMPORTANT: gpu-curtains' GPUDeviceManager does NOT reject setDevice() on adapter/device
//    failures. Failures are caught internally (GPUDeviceManager.mjs) and routed to onError()
//    callbacks WITHOUT rethrowing. Thus `await curtains.setDevice()` always resolves normally,
//    even when adapter or device initialization fails. The try/catch at lines 102-107 is purely
//    defensive (for unexpected async errors) but does NOT catch device failures. The actual
//    failure guard is the `if (!device)` check at line 110: it verifies that
//    curtains.deviceManager.device (GPUDevice | undefined, GPUDeviceManager.d.ts:62) resolved to
//    a valid device. On failure, device is undefined, so we destroy and return null. This check is
//    load-bearing and MUST NOT be removed. `curtains.onError(cb)` (GPUCurtains.d.ts:207) can be
//    registered for logging but is not required for correctness.
//
// 3. Device/queue getters — `curtains.deviceManager.device` (GPUDeviceManager.d.ts:62,
//    `device: GPUDevice | undefined`) is correct. There is no `deviceManager.queue` in the
//    .d.ts; `queue` is a standard property of the native `GPUDevice` object itself
//    (WebGPU spec), so `device.queue` (as in the brief) is the right access path, not
//    `deviceManager.queue`.
//
// 4. Per-frame hook before scene render — `curtains.onBeforeRender(cb)` (GPUCurtains.d.ts:189,
//    "Called each frame before rendering") is confirmed and is what the brief uses; it forwards
//    to `GPUDeviceManager.onBeforeRender`, invoked once per `GPUDeviceManager.render()` call
//    (GPUDeviceManager.d.ts:217-221) before renderer command-encoder/render-scene hooks run.
//
// 5. Scroll update method — `curtains.updateScrollValues({ x, y })` (GPUCurtains.d.ts:173) is
//    confirmed as the method to call to push external (Lenis) scroll values into gpu-curtains'
//    ScrollManager, "Could be called externally as well" per its own doc comment
//    (GPUCurtains.d.ts:170-173, ScrollManager.mjs:34-47).
//
// Canvas sizing — GPURenderer.mjs:90-111 (`setSize`) sets `canvas.width/height` to
// `Math.floor(rectBBox.{width,height} * pixelRatio)`, i.e. the real WebGPU drawing-buffer pixel
// size (already DPR-scaled), and this resize happens synchronously during construction
// (`GPURenderer` constructor calls `this.resize()` when the container is not an OffscreenCanvas,
// GPURenderer.mjs:73-83) before `createEngine` returns. So `getCanvasSize()` reading
// `canvas.width`/`canvas.height` directly (as the brief does) returns the correct, current
// drawing-buffer pixel size with no adaptation needed.

import { GPUCurtains } from 'gpu-curtains';
import { createPointerInput } from './input.js';
import { createResizeHub } from './utils/resizeHub.js';

export function pickQuality({ userAgent, devicePixelRatio }) {
	const isMobile = /Mobi|Android/i.test(userAgent);
	return {
		tier: isMobile ? 'mobile' : 'desktop',
		dpr: Math.min(devicePixelRatio || 1, 2),
		dyeResolution: isMobile ? 512 : 1024
	};
}

export function supportsEngine() {
	if (typeof navigator === 'undefined' || !navigator.gpu) return false;
	if (typeof window === 'undefined') return false;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
	return true;
}

export async function createEngine({ canvas }) {
	if (!supportsEngine()) return null;

	const quality = pickQuality({
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio
	});

	const curtains = new GPUCurtains({
		container: canvas,
		pixelRatio: quality.dpr,
		context: { alphaMode: 'premultiplied' },
		watchScroll: false // Lenis drives scroll; see resolution notes above.
	});

	// Defensive try/catch; does not actually catch device failures (see section #2 above).
	try {
		await curtains.setDevice();
	} catch {
		curtains.destroy();
		return null;
	}

	const device = curtains.deviceManager.device;
	// LOAD-BEARING: this check is the actual guard against device initialization failure.
	// setDevice() always resolves (never rejects), so we must verify the device was actually set.
	if (!device) {
		curtains.destroy();
		return null;
	}
	const queue = device.queue;

	const resizeHub = createResizeHub();
	// gpu-curtains' renderer.onAfterResize is a SINGLE-callback slot (last
	// registration wins, not a Set — see GPURenderer.mjs). The engine owns it
	// exclusively from now on; everything else subscribes via onResize().
	curtains.renderer.onAfterResize(() => resizeHub.dispatch());

	// CSS-pixel size for pointer input, NOT device-pixel canvas.width/height
	// (that's engine.getCanvasSize() below, kept separate for FluidSimulation/
	// GrainPass texel-size math). clientWidth/Height falls back to
	// getBoundingClientRect() when 0 (e.g. canvas not yet laid out / display:none).
	const input = createPointerInput({
		getSize: () => {
			let width = canvas.clientWidth;
			let height = canvas.clientHeight;
			if (!width || !height) {
				const rect = canvas.getBoundingClientRect();
				width = rect.width;
				height = rect.height;
			}
			return { width, height };
		}
	});
	input.start();

	const scroll = { y: 0, velocity: 0 };
	const frameCallbacks = new Set();

	// Runs before gpu-curtains renders its scene each frame.
	curtains.onBeforeRender(() => {
		for (const cb of frameCallbacks) cb();
	});

	// Pause when tab hidden (gpu-curtains keeps its own rAF loop via autoRender; skip our sim work).
	let hidden = document.visibilityState === 'hidden';
	const onVisibility = () => {
		hidden = document.visibilityState === 'hidden';
	};
	document.addEventListener('visibilitychange', onVisibility);

	return {
		curtains,
		device,
		queue,
		quality,
		input,
		scroll,
		get hidden() {
			return hidden;
		},
		onFrame(cb) {
			frameCallbacks.add(cb);
			return () => frameCallbacks.delete(cb);
		},
		onResize(cb) {
			return resizeHub.add(cb);
		},
		setScroll({ y, velocity }) {
			scroll.y = y;
			scroll.velocity = velocity;
			curtains.updateScrollValues({ x: 0, y });
		},
		getCanvasSize() {
			return { width: canvas.width, height: canvas.height };
		},
		destroy() {
			document.removeEventListener('visibilitychange', onVisibility);
			input.stop();
			resizeHub.clear();
			curtains.destroy();
		}
	};
}
