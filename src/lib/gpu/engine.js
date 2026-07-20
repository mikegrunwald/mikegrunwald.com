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
//
// 6. [VERIFY-API] Task 4b — stopping gpu-curtains' render loop entirely while hidden.
//    There is NO public pause()/resume() and no live-togglable `autoRender`: `autoRender`
//    (GPUDeviceManagerBaseParams, GPUDeviceManager.d.ts:22) is read exactly ONCE in the
//    GPUDeviceManager constructor — `if (this.options.autoRender) this.animate()`
//    (GPUDeviceManager.mjs:18-42) — there is no setter that re-checks it afterwards.
//    `renderer.shouldRender` (GPURenderer.mjs:35, gated at GPURenderer.mjs:850
//    `if (!this.ready || !this.shouldRender) return;`) only skips that ONE renderer's scene
//    draw inside `renderer.render(commandEncoder)`. The GPUDeviceManager's own rAF loop
//    (`animate()`, GPUDeviceManager.mjs:454-457: `this.render(); this.animationFrameID =
//    requestAnimationFrame(this.animate.bind(this))`) keeps firing every frame regardless,
//    and `GPUDeviceManager.render()` (GPUDeviceManager.mjs:488-502) still creates a
//    GPUCommandEncoder and submits a command buffer every frame even when every renderer's
//    `shouldRender` is false — i.e. `shouldRender` alone leaves residual per-frame GPU
//    submission running, which is exactly the kind of hidden-tab GPU activity this task
//    needs to eliminate around display-sleep.
//    The actual rAF driver IS public: `animationFrameID: null | number`
//    (GPUDeviceManager.d.ts:91) plus the public `animate()` method that (re)arms it. This is
//    not a private implementation detail we're reaching past — it's the exact mechanism
//    `GPUDeviceManager.destroy()` itself uses to stop rendering permanently
//    (`if (this.animationFrameID) cancelAnimationFrame(this.animationFrameID); this
//    .animationFrameID = null;`, GPUDeviceManager.mjs:506-508). We reuse the same two lines
//    to pause/resume instead of destroying: `cancelAnimationFrame(dm.animationFrameID)` +
//    `dm.animationFrameID = null` stops ALL GPU submission outright; calling `dm.animate()`
//    again resumes the loop from scratch (it immediately renders once, then re-arms rAF).
//    `curtains.deviceManager` is the same public accessor already used above for `.device`.
//
// 7. Device-lost — `device.lost` (GPUDevice.lost, native WebGPU promise, not a gpu-curtains
//    API) resolves once, either on an actual device loss or an intentional `device.destroy()`
//    call, with a `GPUDeviceLostInfo` (`{ reason, message }`). gpu-curtains has its own split
//    (`GPUDeviceManager`'s internal `device.lost.then(...)`, GPUDeviceManager.mjs:110-115,
//    which branches into separate `onDeviceLost`/`onDeviceDestroyed` constructor callbacks —
//    but those are only wired through `GPUCurtains`'s constructor, not exposed as public
//    add-a-listener methods on the already-constructed `curtains` instance). We don't need
//    that split: from this engine's consumers' side both cases mean the same thing (this
//    device is unusable, stop touching it), so we register our own `device.lost.then(...)`
//    directly on the raw `GPUDevice` we already hold, independent of gpu-curtains' internal
//    handling. `curtains.onError(cb)` (GPUCurtains.d.ts:207, GPUCurtains.mjs:328-331) is a
//    single-callback setter (`if (callback) this._onErrorCallback = callback`), not a Set —
//    fine here since the engine is its only registrant, used purely for logging.

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
	// Set-based fan-out, same shape as resizeHub (see notes above, section 7).
	const deviceLostHub = createResizeHub();

	// Runs before gpu-curtains renders its scene each frame.
	curtains.onBeforeRender(() => {
		for (const cb of frameCallbacks) cb();
	});

	let hidden = document.visibilityState === 'hidden';
	let dead = false;

	// See resolution notes section 6 above: cancel/re-arm the GPUDeviceManager's own
	// rAF id directly — the only way to stop ALL GPU submission, not just our onFrame
	// callbacks or one renderer's scene draw.
	function stopRenderLoop() {
		const dm = curtains.deviceManager;
		if (dm.animationFrameID != null) {
			cancelAnimationFrame(dm.animationFrameID);
			dm.animationFrameID = null;
		}
	}

	function resumeRenderLoop() {
		if (dead) return;
		const dm = curtains.deviceManager;
		if (dm.animationFrameID == null) {
			dm.animate();
		}
	}

	const onVisibility = () => {
		hidden = document.visibilityState === 'hidden';
		if (dead) return;
		if (hidden) {
			stopRenderLoop();
		} else {
			resumeRenderLoop();
			// Forced resync: display-sleep/wake can change DPI or monitor, and any
			// resize observers may themselves have been suspended while hidden.
			curtains.renderer.resize();
		}
	};
	document.addEventListener('visibilitychange', onVisibility);
	// Already hidden at construction time (e.g. engine created in a background tab) —
	// stop before the loop that's been running since GPUDeviceManager's constructor
	// (autoRender defaults true, see resolution notes section 1) submits a single frame.
	if (hidden) stopRenderLoop();

	// bfcache navigation / OS-level sleep can skip visibilitychange entirely; `pagehide`
	// (window) and `freeze` (document, Page Lifecycle API) are the documented fallbacks.
	// We only need to STOP here — the corresponding resume always arrives via a later
	// `visibilitychange` (pageshow/unfreeze flips document.visibilityState back to
	// 'visible' before scripts resume running).
	const onPause = () => stopRenderLoop();
	window.addEventListener('pagehide', onPause);
	document.addEventListener('freeze', onPause);

	// Device-lost teardown (resolution notes section 7). Our own handling runs first
	// (stop the loop, mark dead), THEN subscribers are notified.
	device.lost.then((info) => {
		stopRenderLoop();
		dead = true;
		deviceLostHub.dispatch(info);
	});

	// Logging only (resolution notes section 7).
	curtains.onError((message) => {
		console.error('[gpu-curtains] device/adapter error', message);
	});

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
		get dead() {
			return dead;
		},
		onFrame(cb) {
			frameCallbacks.add(cb);
			return () => frameCallbacks.delete(cb);
		},
		onResize(cb) {
			return resizeHub.add(cb);
		},
		onDeviceLost(cb) {
			return deviceLostHub.add(cb);
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
			window.removeEventListener('pagehide', onPause);
			document.removeEventListener('freeze', onPause);
			input.stop();
			resizeHub.clear();
			deviceLostHub.clear();
			curtains.destroy();
		}
	};
}
