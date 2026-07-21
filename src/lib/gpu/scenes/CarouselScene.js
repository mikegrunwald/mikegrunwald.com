// gpu-curtains 0.16.3 API resolution notes (Phase 3 Task 3, [VERIFY-API]
// markers from p3-task-3-brief.md). Verified against
// node_modules/gpu-curtains/dist/types/**/*.d.ts (shapes) and the
// corresponding dist/esm/**/*.mjs runtime source (defaults/behavior — types
// alone don't show it), same discipline as LogoParticlesScene.js.
//
// 1. Plain (non-DOM-synced) `Mesh` + `PlaneGeometry`.
//    - `geometry` is the correct top-level `MeshParams` field name —
//      `MeshBaseMixin.d.ts:44` (`MeshBaseParameters.geometry?: AllowedGeometries`)
//      and `:73` (`MeshBaseOptions.geometry`). `Mesh extends
//      Omit<ProjectedMeshParameters, 'useProjection'>` (Mesh.d.ts:6), which
//      itself `extends MeshBaseParams` (ProjectedMeshBaseMixin.d.ts:29) — no
//      renaming/nesting along that chain.
//    - Omitting `element` is not just "valid", it's the ONLY option: `Mesh`'s
//      constructor unconditionally calls `super(renderer, null, parameters)`
//      (dist/esm/core/meshes/Mesh.mjs:89) — a plain `Mesh` can NEVER be
//      DOM-synced, regardless of what's passed in `parameters`, unlike
//      `DOMMesh`/`Plane` which take `element` as their own second constructor
//      arg. Both still flow through the identical `Geometry`/
//      `RenderPipelineEntry` machinery Phase 2 Task 4 already proved
//      auto-injects `Attributes` and `getOutputPosition()` — no divergence for
//      plain `Mesh`.
//    - `PlaneGeometry()`'s default vertex range is **-1..1 on both axes (a 2x2
//      quad)**, NOT 0..1 — confirmed at
//      dist/esm/core/geometries/PlaneGeometry.mjs:102-103:
//      `position.array[...] = 1 - x*2/width` (x: 0..width) and
//      `y*2/height - 1` (y: 0..height), i.e. corners at (±1, ±1) for the
//      default single-segment plane. World-space plane size = geometry size
//      (2 units) * `mesh.scale` — so `mesh.scale.set(planeWidth/2,
//      planeHeight/2, 1)` is required to get an on-screen size of exactly
//      `planeWidth x planeHeight` world units (the brief's draft
//      `scale.set(planeWidth, planeHeight, 1)` would be 2x too large in both
//      axes — corrected below).
//
// 2. `MediaTexture.loadVideo(url)` readiness signal for `.play()`.
//    `useVideo()` (dist/esm/core/textures/MediaTexture.mjs:485-513) calls
//    `onVideoLoaded` immediately if `video.readyState >= HAVE_ENOUGH_DATA`,
//    else registers a ONE-SHOT `canplaythrough` listener (line 513) that
//    calls the same `onVideoLoaded`. `onVideoLoaded` (lines 418-431) sets
//    `sources[i].sourceLoaded = true` and calls the private
//    `#setSourceLoaded(video)` (line 432), which invokes
//    `_onSourceLoadedCallback(source)` with `source` being the actual
//    `<video>` element (line 564-565: `#setSourceLoaded(source) {
//    this._onSourceLoadedCallback(source); ... }`, called as
//    `#setSourceLoaded(video)`). The **public** hook for that callback is
//    `mediaTexture.onSourceLoaded(cb)` (line 582); its d.ts doc (MediaTexture
//    .d.ts:255-259) confirms it fires per-source. Since this scene's
//    `MediaTexture` only ever has ONE source (no cube-map depth), `
//    onSourceLoaded` and `onAllSourcesLoaded` are equivalent here —
//    `onSourceLoaded` is used since its callback conveniently hands back the
//    exact `<video>` element to call `.play()` on directly, with no extra
//    `sources[0]?.source` lookup needed at that call site. Registered BEFORE
//    `loadVideo()` so the already-ready synchronous path (line 512, `if
//    (video.readyState >= video.HAVE_ENOUGH_DATA)`) still reaches this
//    callback.
//
// 3. `mesh.position.set(x, y, z)` / `mesh.lookAt(target)`.
//    - `position` is a real `Vec3` with a `.set(x, y=x, z=x)` method
//      (dist/esm/math/Vec3.mjs:85), wired to mark the model matrix dirty via
//      `this.position.onChange(() => this.applyPosition())`
//      (dist/esm/core/objects3D/Object3D.mjs:94) — same proven pattern as
//      `plane.rotation` in Phase 2 Task 8. `scale` is wired identically
//      (Object3D.mjs:95, `this.scale.onChange(() => this.applyScale())`), so
//      `mesh.scale.set(...)` above is equally safe.
//    - `lookAt(target)` (Object3D.mjs:252-258) calls `this.applyLookAt(target,
//      this.actualPosition)` (line 257), which calls `tempMatrix.lookAt(target,
//      position, this.up)` (line 264-265) — i.e. Object3D's `applyLookAt(target,
//      position)` passes `(target, position)` as `(eye, target)` into
//      `Mat4.lookAt(eye, target, up)` (dist/esm/math/Mat4.mjs:610-641). Inside
//      `Mat4.lookAt`, `zAxis = normalize(eye - target)` (line 612-614) becomes
//      the resulting matrix's local +Z column (lines 632-634) — i.e. the
//      MESH's local +Z axis, in world space, ends up pointing from the mesh
//      TOWARD whatever was passed as Object3D's own `target` arg (the camera
//      position, here). `PlaneGeometry`'s vertex normal is `(0,0,1)`
//      (PlaneGeometry.mjs:105-107) and the default `cullMode` is `"back"`
//      (MeshBaseMixin.mjs:15) — so after `mesh.lookAt(camera.position)`, the
//      plane's front (+Z-normal, video-visible) face points at the camera:
//      the ring renders as visible video, not a backface-culled dark ring.
//      No 180°-flip correction needed.
//
// 4. `visible` setter fully skips per-frame work when `false` — confirmed at
//    dist/esm/core/meshes/mixins/MeshBaseMixin.mjs:497
//    (`if (!this.renderer.ready || !this.ready || !this.visible) return;`,
//    guarding `onRenderPass`) and :545 (same guard, `onBeforeRenderPass`).
//    Not used to hide anything in THIS task (see interface note below) but
//    load-bearing for the NaN defensive-skip in `layout()` and for Task 4's
//    upcoming pin-window visibility gating.
//
// 5. Opaque vs transparent bucket — omitting `transparent: true` (this
//    scene's default) is correct: `MeshBaseMixin.mjs:20` sets `transparent:
//    false` as the RenderMaterial default, unlike `FullscreenPlane`/`Plane`
//    call sites elsewhere in this codebase (FluidScene, LogoParticlesScene)
//    which explicitly opt INTO `transparent: true` for premultiplied
//    compositing. A plain `Mesh` with no override stays in Scene.mjs's opaque
//    PROJECTED bucket (renderOrder-only sort, no per-frame Z-sort needed for
//    N=3-8 equidistant planes).
//
// Camera note (context for the ring-placement reasoning in the brief, not a
// call this scene makes): `PerspectiveCamera`'s constructor defaults are
// `fov=50`, position `(0,0,10)` (dist/esm/core/cameras/PerspectiveCamera.mjs:
// 22-33), and `GPUCameraRenderer`'s own default camera params are `fov: 50,
// near: .1, far: 1e3` (dist/esm/core/renderers/GPUCameraRenderer.mjs:54-56) —
// so the ACTUAL runtime near plane is 0.1, not the 0.01 the brief's prose
// mentions (likely referencing gpu-curtains' own doc-comment typo at
// PerspectiveCamera.mjs's JSDoc, which says 0.01 while the constructor
// default is `near = .1`). Doesn't change any param here — `ringRadius: 4` is
// still comfortably clear of either near value — noted only so a future
// reader doesn't go looking for a 0.01 that isn't there. This scene never
// touches `renderer.camera` itself, only reads `.position` for `lookAt`.
//
// 6. Task 6 raycast + screen projection.
//    - `Raycaster` and `Vec3` are both exported from the 'gpu-curtains' main
//      entry (extras/raycaster/Raycaster.d.ts, math/Vec3.d.ts). `setFromMouse(e)`
//      sets the pointer from renderer.boundingRect (CSS px); `intersectObjects
//      (objects, recursive)` returns Intersection[] pre-sorted nearest-first by
//      ray.origin.distance(point) (Raycaster.mjs) — so hits[0] is the closest
//      plane, no manual sort needed. Each Intersection carries `.object`
//      (the ProjectedMesh) and `.distance`.
//    - World → screen: `Vec3.project(camera)` mutates in place to NDC [-1,1] by
//      applying viewMatrix then projectionMatrix, and Vec3.applyMat4 performs
//      the perspective /w divide (Vec3.mjs) — so projecting the plane's four
//      local (±1,±1,0) corners through `mesh.worldMatrix` then `.project(camera)`
//      yields a correct NDC bounding box under rotation/scale/perspective.
//      NDC→CSS px uses `renderer.boundingRect` (CSS px — the SAME rect
//      setFromMouse reads, keeping ray and projected rect in one space; NOT
//      getCanvasSize()/device px — Phase 2 note #16). Non-finite guard mirrors
//      the layout() clamp: any NaN component → null target, never a NaN CSS
//      transform on the DOM cursor.

import { Mesh, PlaneGeometry, MediaTexture, Sampler, Raycaster, Vec3 } from 'gpu-curtains';
import { CAROUSEL_VERTEX, CAROUSEL_FRAGMENT } from '../carousel/shaders/carousel.wgsl.js';
import { setExternalMagneticTarget } from '$lib/components/CursorDot.svelte';

export class CarouselScene {
	constructor({ engine, teasers, onHover, onNavigate }) {
		this.engine = engine;
		this.destroyed = false;
		this.active = false;
		this.progress = 0; // Task 4 turns this into rotation
		this.rotation = 0; // Task 4
		this.velocitySmoothed = 0; // Task 5

		// Task 6 — raycast hover/click. `onHover(index|null)` drives WorkTeasers'
		// DOM label (via +layout.svelte context); `onNavigate(href)` is supplied
		// goto from +layout.svelte so this scene stays free of any SvelteKit dep.
		this.onHover = onHover;
		this.onNavigate = onNavigate;
		this.hoveredIndex = null;
		// [VERIFY-API] gpu-curtains ships Raycaster in the main entry (confirmed:
		// exported from 'gpu-curtains', extras/raycaster/Raycaster.d.ts).
		// setFromMouse(e) reads renderer.boundingRect (CSS px), intersectObjects
		// returns nearest-first (sorted by ray.origin.distance(point) in
		// Raycaster.mjs) so hits[0] is the closest plane.
		this.raycaster = new Raycaster(engine.curtains);
		// Reusable Vec3 scratch for per-frame corner projection (avoid per-frame
		// allocation in the hovered-plane screen-rect computation).
		this._projScratch = new Vec3();

		const isMobile = engine.quality.tier === 'mobile';
		this.params = {
			ringRadius: 4,
			// World Z of the ring CENTER, defaulting to the camera's own Z so the
			// viewer sits at the ring's centre and only an arc is ever visible.
			// Camera itself is untouched at (0,0,10) — see header note above and
			// the brief's "Ring placement" section. Do not move/re-fov the camera;
			// move the ring instead by changing this value.
			ringDepth: 10,
			planeWidth: isMobile ? 1.2 : 1.6,
			planeHeight: isMobile ? 0.68 : 0.9,
			rotationsPerScroll: 1,
			velocityGain: 0.6,
			velocitySmoothing: 6, // per-second lerp rate, Task 5
			maxVelocityBoost: 1.2
		};

		this.ringCenter = { x: 0, y: 0, z: this.params.ringDepth };

		// Mobile budget (spec: "fewer/smaller videos"): cap simultaneous
		// decoding videos. Desktop shows every featured entry with a video.
		// Per the brief's Interfaces section, `this.items` is built only from
		// entries with a resolvable video — Task 1's `teaserUrl: null` entries
		// have no video to show in 3D (their DOM link still exists via
		// WorkTeasers.svelte, independent of this array).
		const withVideo = teasers.filter((t) => !!t.teaserUrl);
		const maxItems = isMobile ? Math.min(4, withVideo.length) : withVideo.length;
		const selected = withVideo.slice(0, maxItems);

		this.items = selected.map((teaser, index) => this.createItem(teaser, index, selected.length));

		this.unsubFrame = engine.onFrame(() => this.update());

		// Bound so removeEventListener works in destroy(). Attached to window (not
		// the canvas) — the canvas is `position: fixed` fullscreen behind all
		// content, and setFromMouse reads renderer.boundingRect, so window coords
		// map directly. `click` fires after `touchend` on mobile, giving tap-to-
		// navigate for free (flagged for real-device confirmation in Task 7 QA).
		this._onPointerMove = (e) => this.handlePointerMove(e);
		this._onClick = (e) => this.handleClick(e);
		window.addEventListener('pointermove', this._onPointerMove);
		window.addEventListener('click', this._onClick);
	}

	createItem(teaser, index, count) {
		const sampler = new Sampler(this.engine.curtains, {
			label: `carousel-sampler-${index}`,
			name: 'videoSampler',
			magFilter: 'linear',
			minFilter: 'linear'
		});

		const texture = new MediaTexture(this.engine.curtains, {
			label: `carousel-video-${index}`,
			name: 'videoTexture'
		});

		const item = { teaser, index, count, mesh: null, texture, sampler, playing: false };

		// [VERIFY-API #2] Registered before loadVideo() so the synchronous
		// already-ready path still fires it. Callback receives the real
		// <video> element (see header note #2) — safe to .play() directly.
		texture.onSourceLoaded((source) => {
			if (this.destroyed) return;
			item.playing = true;
			// Late-ready race (brief's Step 2): a video can finish loading
			// AFTER setActive(true) has already run once (slow network, section
			// already pinned on load). Gate on `this.active` so a video that
			// becomes ready while the carousel is NOT pinned doesn't start
			// playing off-screen — the next real setActive(true) picks it up.
			// Autoplay can still reject before a user gesture on some browsers
			// even though these videos are muted+loop (MediaTexture.mjs sets
			// muted=true); swallow the rejection rather than throwing.
			if (this.active) source.play?.().catch(() => {});
		});
		texture.loadVideo(teaser.teaserUrl);

		// [VERIFY-API #1] plain (non-DOM-synced) Mesh + PlaneGeometry. No
		// `transparent: true` — [VERIFY-API #5], stays in the opaque
		// renderOrder-only sort bucket.
		const mesh = new Mesh(this.engine.curtains, {
			label: `carousel-plane-${index}`,
			geometry: new PlaneGeometry(),
			shaders: {
				vertex: { code: CAROUSEL_VERTEX },
				fragment: { code: CAROUSEL_FRAGMENT }
			},
			textures: [texture],
			samplers: [sampler]
		});
		// [VERIFY-API #1] PlaneGeometry's native vertex range is -1..1 (2x2
		// quad), so scale must be HALVED to get an on-screen size of exactly
		// planeWidth x planeHeight world units — see header note.
		mesh.scale.set(this.params.planeWidth / 2, this.params.planeHeight / 2, 1);

		item.mesh = mesh;
		return item;
	}

	layout() {
		const n = this.items.length;
		if (!n) return;
		const radius = this.params.ringRadius + this.velocitySmoothed;
		const camera = this.engine.curtains.renderer.camera;
		for (const item of this.items) {
			const angle = this.rotation + (item.index / item.count) * Math.PI * 2;
			const x = this.ringCenter.x + radius * Math.sin(angle);
			const y = this.ringCenter.y;
			const z = this.ringCenter.z - radius * Math.cos(angle);
			// Defensive: a non-finite position must never reach the GPU
			// transform — Phase 2's repeated machine-hang incidents trace to
			// exactly this failure mode (see particlesRender.wgsl.js's clamp).
			// Not reachable today (ringRadius/velocitySmoothed/rotation are all
			// finite constants this task), but Task 4/5 wire real scroll/
			// velocity input here, so the guard is added now rather than
			// retrofitted later under time pressure.
			if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
				item.mesh.visible = false;
				continue;
			}
			// Visibility is gated by `this.active` (set by setActive, driven by
			// ScrollTrigger's onEnter/onLeave — Task 4), not hardcoded true:
			// this runs every frame via update(), so a hardcoded true here would
			// fight setActive(false)'s own `mesh.visible = false` on the very
			// next frame.
			item.mesh.visible = this.active;
			item.mesh.position.set(x, y, z);
			// [VERIFY-API #3] orients the plane's video-facing (+Z-normal) side
			// toward the camera — see header note #3.
			item.mesh.lookAt(camera.position);
		}
	}

	setProgress(p) {
		// Defensive finite guard (Global Constraints): `p` is ScrollTrigger's
		// own `self.progress`, always finite in practice, but a NaN here would
		// otherwise flow straight into `rotation` and then into every mesh's
		// GPU transform via layout() — same discipline as LogoParticlesScene's
		// tilt accumulator guard and layout()'s own NaN clamp above. Skipping
		// the update on bad input (rather than coercing to 0) keeps the last
		// good rotation instead of snapping the ring.
		if (!Number.isFinite(p)) return;
		this.progress = p;
		// `p`'s sign/direction already encodes scroll direction via
		// ScrollTrigger's monotonic-with-scroll-direction `progress` — no extra
		// sign logic needed here (see brief's Interfaces note).
		this.rotation = p * this.params.rotationsPerScroll * Math.PI * 2;
	}

	setVelocity(v) {
		this._targetVelocity = v; // Task 5
	}

	// Returns the item index under the pointer, or null. Early-returns off-pin so
	// hover/click are inert outside the active section (the DOM .sr-only links
	// remain the keyboard/AT path regardless — this raycast is a mouse/touch
	// enhancement, not the only way in).
	hitTest(e) {
		if (!this.active || !this.items.length) return null;
		this.raycaster.setFromMouse(e);
		const meshes = this.items.map((item) => item.mesh);
		const hits = this.raycaster.intersectObjects(meshes, false);
		if (!hits.length) return null;
		const hitMesh = hits[0].object; // nearest-first, sorted in Raycaster.mjs
		const index = this.items.findIndex((item) => item.mesh === hitMesh);
		return index === -1 ? null : index;
	}

	handlePointerMove(e) {
		const index = this.hitTest(e);
		if (index === this.hoveredIndex) return;
		if (this.hoveredIndex != null) this.setHoverScale(this.hoveredIndex, false);
		this.hoveredIndex = index;
		if (index != null) this.setHoverScale(index, true);
		else setExternalMagneticTarget(null); // hover-out: release the cursor now
		// Plain CSS hook + DOM-inspectable QA signal (the WebGPU canvas can't be
		// read back from a page-level probe).
		document.documentElement.classList.toggle('carousel-hovering', index != null);
		this.onHover?.(index);
	}

	handleClick(e) {
		const index = this.hitTest(e);
		if (index == null) return; // click on a ring gap / empty space: no-op
		this.onNavigate?.(this.items[index].teaser.href);
	}

	setHoverScale(index, hovered) {
		const item = this.items[index];
		if (!item) return;
		// Base scale is HALVED (geometry is a 2x2 quad — header note #1); the hover
		// scale multiplies that same halved base so the plane grows about its own
		// centre without changing the /2 convention layout()/createItem() rely on.
		const scale = hovered ? 1.08 : 1;
		item.mesh.scale.set(
			(this.params.planeWidth / 2) * scale,
			(this.params.planeHeight / 2) * scale,
			1
		);
	}

	setActive(isActive) {
		if (this.active === isActive) return;
		this.active = isActive;
		// Leaving the pinned window: proactively clear any hover state. The
		// pointer may not move again for a while, so we can't rely on the next
		// handlePointerMove to notice the section went inactive — the hovered
		// plane would otherwise stay scaled up and the cursor stranded morphed
		// around a plane that's about to be hidden.
		if (!isActive && this.hoveredIndex != null) {
			this.setHoverScale(this.hoveredIndex, false);
			this.hoveredIndex = null;
			setExternalMagneticTarget(null);
			document.documentElement.classList.remove('carousel-hovering');
			this.onHover?.(null);
		}
		for (const item of this.items) {
			// [VERIFY-API #4] `visible` fully skips per-frame work when false —
			// see header note #4. layout() also re-applies this every frame off
			// `this.active` so a mid-transition frame can't desync mesh
			// visibility from the active flag.
			item.mesh.visible = isActive;
			const video = item.texture.sources[0]?.source;
			if (!video) continue; // not loaded yet — onSourceLoaded's `this.active` check covers this race
			if (isActive) {
				video.play?.().catch(() => {}); // autoplay rejection is not fatal
			} else {
				video.pause?.();
			}
		}
	}

	update() {
		if (this.destroyed || this.engine.hidden) return;

		// Real per-frame dt (seconds), clamped to ~2 frames so a stalled tab that
		// resumes doesn't apply one giant lerp step — same performance.now()-based
		// dt pattern as FluidScene/LogoParticlesScene, not a fixed per-frame
		// constant (which would tie the ease rate to the display's refresh rate).
		const now = performance.now();
		const dt = Math.min((now - (this._lastFrameTime ?? now)) / 1000, 0.033);
		this._lastFrameTime = now;

		// Lenis's `velocity` (fed via setVelocity, either scroll direction) drives
		// an outward radius boost. Magnitude only — direction already lives in
		// `rotation` (setProgress) — clamped so a hard flick can't explode the
		// ring outward past maxVelocityBoost.
		const target = Math.min(
			Math.abs(this._targetVelocity ?? 0) * this.params.velocityGain,
			this.params.maxVelocityBoost
		);
		// Frame-rate-independent exponential ease toward target. Eases back to 0
		// automatically once Lenis's own velocity settles to 0 at rest — no
		// separate "return to rest" branch needed.
		const rate = 1 - Math.exp(-this.params.velocitySmoothing * dt);
		this.velocitySmoothed += (target - this.velocitySmoothed) * rate;

		this.layout();

		// Track the hovered plane's projected screen rect every frame so the DOM
		// cursor (CursorDot's magnetic mode) morphs to it and follows as the ring
		// rotates. Only while hovered — hover-out / setActive(false) / destroy all
		// clear the target explicitly, so we never write it when nothing's hovered
		// (which would fight DOM magnetic elements elsewhere on the page).
		if (this.hoveredIndex != null) {
			const rect = this.projectMeshRect(this.items[this.hoveredIndex]?.mesh);
			// projectMeshRect returns null on any non-finite component — a
			// degenerate matrix must never reach the dot's CSS transform (the exact
			// failure class behind Phase 2's hangs). Clear rather than write NaN.
			setExternalMagneticTarget(rect);
		}
	}

	// World → screen (CSS px) bounding rect of a plane, by projecting its four
	// local corners through the world matrix + camera. Returns
	// { x, y, width, height, radius } with x/y the CENTER in CSS px, or null if
	// any projected component is non-finite or the plane is entirely behind the
	// camera. Uses renderer.boundingRect (CSS px — the same rect setFromMouse
	// uses, so hover ray and projected rect stay in one coordinate space; NOT
	// getCanvasSize(), which is device px — Phase 2 note #16).
	projectMeshRect(mesh) {
		if (!mesh) return null;
		const camera = this.engine.curtains.renderer.camera;
		const bounds = this.engine.curtains.renderer.boundingRect;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (let cx = -1; cx <= 1; cx += 2) {
			for (let cy = -1; cy <= 1; cy += 2) {
				// PlaneGeometry corners are at (±1, ±1, 0) (native 2x2 quad — see
				// header note #1); worldMatrix carries position/lookAt/scale.
				this._projScratch.set(cx, cy, 0);
				this._projScratch.applyMat4(mesh.worldMatrix).project(camera);
				const ndc = this._projScratch;
				if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return null;
				const sx = bounds.left + (ndc.x * 0.5 + 0.5) * bounds.width;
				const sy = bounds.top + (0.5 - ndc.y * 0.5) * bounds.height;
				if (sx < minX) minX = sx;
				if (sx > maxX) maxX = sx;
				if (sy < minY) minY = sy;
				if (sy > maxY) maxY = sy;
			}
		}
		const width = maxX - minX;
		const height = maxY - minY;
		if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
		return {
			x: (minX + maxX) / 2,
			y: (minY + maxY) / 2,
			width,
			height,
			radius: 12
		};
	}

	destroy() {
		this.destroyed = true;
		this.unsubFrame();
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('click', this._onClick);
		// Never leave the DOM cursor stranded morphed around a mesh that's about
		// to be torn down, nor the CSS hook set.
		setExternalMagneticTarget(null);
		document.documentElement.classList.remove('carousel-hovering');
		for (const item of this.items) {
			// Pause the <video> BEFORE tearing down the texture: once the mesh
			// is gone, nothing samples the element, but an un-paused video keeps
			// decoding frames in the background.
			item.texture.sources[0]?.source?.pause?.();
			// `remove()` releases the texture too — it runs removeFromScene(true)
			// (unregistering the mesh from renderer.meshes) and then the mesh's
			// own destroy chain, whose material.destroy() -> destroyTextures()
			// destroys any texture the renderer no longer holds a reference to
			// (Material.mjs:396-400, GPURenderer.mjs:725-728). An explicit
			// item.texture.destroy() after this is therefore redundant; it used
			// to be here and was a no-op only by luck, because Texture.destroy()
			// nulls its own GPUTexture and tolerates a second call
			// (Texture.mjs:258-262). Left in, it implies these textures need
			// manual release — the mistaken model behind a real leak in Phase 2.
			item.mesh.remove();
		}
	}
}
