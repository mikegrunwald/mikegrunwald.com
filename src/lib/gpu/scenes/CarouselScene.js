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

import { Mesh, PlaneGeometry, MediaTexture, Sampler } from 'gpu-curtains';
import { CAROUSEL_VERTEX, CAROUSEL_FRAGMENT } from '../carousel/shaders/carousel.wgsl.js';

export class CarouselScene {
	constructor({ engine, teasers }) {
		this.engine = engine;
		this.destroyed = false;
		this.active = false;
		this.progress = 0; // Task 4 turns this into rotation
		this.rotation = 0; // Task 4
		this.velocitySmoothed = 0; // Task 5

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
			// Autoplay can reject before a user gesture on some browsers even
			// though these videos are muted+loop (MediaTexture.mjs sets
			// muted=true); swallow the rejection rather than throwing — Task 4
			// owns real play/pause gating, this is just initial dev-route
			// visibility.
			source.play?.().catch(() => {});
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
			item.mesh.visible = true;
			item.mesh.position.set(x, y, z);
			// [VERIFY-API #3] orients the plane's video-facing (+Z-normal) side
			// toward the camera — see header note #3.
			item.mesh.lookAt(camera.position);
		}
	}

	setProgress(p) {
		this.progress = p; // Task 4 turns this into `this.rotation`
	}

	setVelocity(v) {
		this._targetVelocity = v; // Task 5
	}

	setActive(isActive) {
		// Task 4 wires visibility + play/pause gating off this. This task's own
		// dev-route verification keeps every mesh `visible: true` regardless
		// (see layout()) — `active` is stored for Task 4 to read, nothing else
		// consults it yet.
		this.active = isActive;
	}

	update() {
		if (this.destroyed || this.engine.hidden) return;
		this.layout();
	}

	destroy() {
		this.destroyed = true;
		this.unsubFrame();
		for (const item of this.items) {
			item.texture.sources[0]?.source?.pause?.();
			item.mesh.remove();
			item.texture.destroy();
		}
	}
}
