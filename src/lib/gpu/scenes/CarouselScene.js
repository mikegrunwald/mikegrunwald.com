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

import { Mesh, PlaneGeometry, MediaTexture, Sampler, Raycaster } from 'gpu-curtains';
import { CAROUSEL_VERTEX, CAROUSEL_FRAGMENT } from '../carousel/shaders/carousel.wgsl.js';
import { computeQuadGeometry } from '../carousel/quadGeometry.js';
import { composeRotation } from '../carousel/scrollModel.js';
import { computeRingRadius } from '../carousel/ringGeometry.js';

// Hover growth factor, applied on top of the params-derived base scale in
// layout(). Kept here rather than inline so the hover and base scale can never
// drift apart.
const HOVER_SCALE = 1.08;

// Per-second exponential rate for the hover ease, driving BOTH the scale and
// the glow off one weight so they can't drift apart. 8 is a ~250ms settle —
// slower than the 12 the glow alone used, because a scale change reads as
// jumpy at a rate the glow got away with.
const HOVER_EASE_RATE = 8;

// Elements whose clicks must never fall through to a ring navigation — see
// handleClick. Deliberately broad: anything focusable/actionable, plus
// Tweakpane's wrapper (`.tp-dfwv`), whose sliders are plain divs and so match
// none of the standard interactive selectors.
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, [role="button"], .tp-dfwv';

export class CarouselScene {
	constructor({ engine, element, teasers, onHover, onNavigate }) {
		this.engine = engine;
		// The `[data-gpu-carousel]` section. Used only as the target for the
		// hover class — see setHoverClass for why it is not <html>.
		this.element = element ?? null;
		this.destroyed = false;
		this.active = false;
		this.progress = 0; // Task 4 turns this into rotation
		this.preRoll = 0;
		this.rotation = 0; // Task 4
		this.velocitySmoothed = 0; // Task 5
		// Counts down after a runway wrap, during which incoming velocity samples
		// are ignored so the last good value carries through the seam.
		this._holdVelocityFrames = 0;

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

		const isMobile = engine.quality.tier === 'mobile';
		this.params = {
			// When true (the default), the radius is DERIVED from the number of
			// teasers so the planes always tile the ring exactly — see
			// ringGeometry.js. `ringRadius` below is then ignored, and only used
			// as a manual override when this is switched off in the debug panel.
			// Without this, changing which entries are featured silently breaks
			// the layout: at a fixed radius 4, five entries left a 23.6deg gap and
			// eight overlapped by 3.4deg.
			autoRadius: true,
			// Fraction of each angular slot left EMPTY between planes. Kept as a
			// fraction of the slot rather than a fixed angle or world distance so
			// the gap stays proportional: the gap-to-teaser ratio is identical at
			// any featured-entry count, where a fixed angle would look generous at
			// 5 entries and cramped at 12.
			ringGap: 0.1,
			// Manual radius, used only when autoRadius is false.
			ringRadius: 4,
			// World Z of the ring CENTER, defaulting to the camera's own Z so the
			// viewer sits at the ring's centre and only an arc is ever visible.
			// Camera itself is untouched at (0,0,10) — see header note above and
			// the brief's "Ring placement" section. Do not move/re-fov the camera;
			// move the ring instead by changing this value.
			ringDepth: 10,
			// Sized to fill the view rather than float in it. With the camera AT
			// the ring's centre, a plane's on-screen size is its angular width,
			// 2*atan((planeWidth/2) / ringRadius) — so these are tuned against the
			// frustum, not picked by eye. At ringRadius 4 with the default fov 50
			// on a 16:9 viewport the visible world box is ~6.63 x 3.73 units, so
			// 3.6 x 2.03 covers ~54% of the width and ~54% of the height (the
			// previous 1.6 x 0.9 covered only ~24%, which is why teasers read as
			// small islands with a large dead gap between them).
			// 16:9 is preserved (3.6 / 1.7778 = 2.025) to match the source videos.
			planeWidth: isMobile ? 2.6 : 3.6,
			planeHeight: isMobile ? 1.46 : 2.03,
			// World-unit padding added around the video on every side, so the
			// fragment shader has somewhere to draw the outer glow. Default is
			// ~2x the 16px glow blur converted to world units (16/782 * 3.6 =
			// 0.074), giving the falloff room to reach zero before the quad edge.
			// 782px is the plane's on-screen width at a 1440px viewport, from
			// its NDC half-width tan(24.2deg)/tan(39.65deg) = 0.543.
			glowPad: 0.15,
			// World units. Matches --border-radius: 0.2rem (3.2px) at a 1440px
			// viewport: the plane is 54.3% of viewport width (782px) and 3.6 world
			// units wide, so 3.2/782 * 3.6 = 0.0147. This is a fixed world value,
			// so it cannot track rem at every viewport size — see the spec's
			// non-goals.
			cornerRadius: 0.015,
			// World units, ~1px at the same reference viewport (1/782 * 3.6).
			borderWidth: 0.004,
			// World units. 16px outer blur at the 1440px reference viewport
			// (16/782 * 3.6), matching .media's `box-shadow: 0 0 16px`.
			glowRadius: 0.074,
			// World units. 12px inner blur, matching `inset 0 0 12px`.
			glowInset: 0.055,
			// Base glow opacity at rest. The glow is ALWAYS on (matching the
			// detail page's .media), not hover-only.
			glowStrength: 0.6,
			// Multiplier applied to glowStrength for the hovered item.
			hoverGlowBoost: 1.8,
			// Vertical darkening overlay, mirroring ProjectHeader's :after
			// gradient on the work detail pages (src/lib/components/
			// ProjectHeader.svelte): rgba(0,0,0,0.95) at both edges easing to
			// rgba(0,0,0,0.666) at the midpoint.
			gradientEdge: 0.95,
			gradientMid: 0.666,
			rotationsPerScroll: 1,
			// Turns contributed by the approach (see the approach trigger in
			// +layout.svelte). Chosen so the ANGULAR RATE matches the pinned
			// section's exactly, making the handover velocity-continuous rather
			// than just position-continuous: the pin turns 1 rotation over ~200vh
			// (1.8deg/vh), and the approach spans 20vh, so 20 * 1.8 = 36deg =
			// 0.1 turns. Raising this makes the ring visibly accelerate into the
			// pin; lowering it makes it stall.
			preRollTurns: 0.1,
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

		const item = {
			teaser,
			index,
			count,
			mesh: null,
			texture,
			sampler,
			playing: false,
			// Eased 0..1 hover weight driving the glow boost. Stepping it
			// instantly makes the glow snap on and off, which reads as a bug
			// rather than as feedback.
			hoverWeight: 0
		};

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
		const geo = computeQuadGeometry(this.params);
		const mesh = new Mesh(this.engine.curtains, {
			label: `carousel-plane-${index}`,
			geometry: new PlaneGeometry(),
			// The quad now extends past the video (glowPad) and the shader writes
			// alpha < 1 there, so this can no longer live in the opaque bucket.
			// Moves the mesh from Scene.mjs's opaque PROJECTED category to the
			// transparent PROJECTED one, which adds a per-frame Z sort. Safe for
			// this ring: at 72deg spacing with 48.4deg-wide planes no two items
			// ever overlap on screen, so blend order cannot produce artifacts.
			transparent: true,
			shaders: {
				vertex: { code: CAROUSEL_VERTEX },
				fragment: { code: CAROUSEL_FRAGMENT }
			},
			uniforms: {
				params: {
					struct: {
						// Half-extents in world units, measured from the plane
						// centre. quadHalf converts uv into plane-local world
						// coordinates; videoHalf is where the video actually sits
						// inside that quad.
						quadHalf: { type: 'vec2f', value: [geo.quadHalfX, geo.quadHalfY] },
						videoHalf: { type: 'vec2f', value: [geo.videoHalfX, geo.videoHalfY] },
						cornerRadius: { type: 'f32', value: this.params.cornerRadius },
						borderWidth: { type: 'f32', value: this.params.borderWidth },
						glowRadius: { type: 'f32', value: this.params.glowRadius },
						glowInset: { type: 'f32', value: this.params.glowInset },
						glowStrength: { type: 'f32', value: this.params.glowStrength },
						hover: { type: 'f32', value: 0 },
						gradientEdge: { type: 'f32', value: this.params.gradientEdge },
						gradientMid: { type: 'f32', value: this.params.gradientMid }
					}
				}
			},
			textures: [texture],
			samplers: [sampler]
		});
		// [VERIFY-API #1] PlaneGeometry's native vertex range is -1..1 (2x2
		// quad), so scale is HALF the world size — computeQuadGeometry already
		// returns it halved. See header note and quadGeometry.js.
		mesh.scale.set(geo.meshScaleX, geo.meshScaleY, 1);

		item.mesh = mesh;
		return item;
	}

	layout(dt = 0) {
		const n = this.items.length;
		if (!n) return;
		// Recomputed every frame off the live params so the panel's planeWidth and
		// ringGap sliders stay honest, and so a change in featured-entry count
		// needs no hand-tuning at all.
		const baseRadius = this.params.autoRadius
			? computeRingRadius({
					planeWidth: this.params.planeWidth,
					count: n,
					gap: this.params.ringGap
				})
			: this.params.ringRadius;
		const radius = baseRadius + this.velocitySmoothed;
		const camera = this.engine.curtains.renderer.camera;
		for (const item of this.items) {
			// `n` rather than the item's own captured `count`, so the angular
			// spacing and the radius above are always derived from the same
			// number — they would silently disagree if the two ever drifted.
			const angle = this.rotation + (item.index / n) * Math.PI * 2;
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
			// Re-apply scale every frame from params so the debug panel's
			// planeWidth/planeHeight sliders actually do something. They were
			// previously inert: scale was set once in createItem() and only ever
			// touched again by setHoverScale, so dragging the sliders changed
			// nothing until you happened to hover a plane. Hover is folded in here
			// (rather than writing scale from two places) so the two can't fight.
			const geo = computeQuadGeometry(this.params);
			// Ease the hover weight FIRST, then derive scale from it. This used to
			// be a hard `index === hoveredIndex ? HOVER_SCALE : 1`, which snapped
			// the plane between two sizes in a single frame and read as a glitch.
			// The glow was already eased off this same weight, so scale and glow
			// now move together instead of one jumping ahead of the other.
			const hoverTarget = item.index === this.hoveredIndex ? 1 : 0;
			const hoverRate = 1 - Math.exp(-HOVER_EASE_RATE * dt);
			item.hoverWeight += (hoverTarget - item.hoverWeight) * hoverRate;
			const hoverScale = 1 + (HOVER_SCALE - 1) * item.hoverWeight;
			item.mesh.scale.set(geo.meshScaleX * hoverScale, geo.meshScaleY * hoverScale, 1);
			// The uniforms stay UNSCALED by hover: hover grows the whole plane via
			// mesh.scale, and the shader works in the plane's own local space, so
			// scaling these too would double-apply the hover and shrink the video
			// inside its own quad.
			const u = item.mesh.uniforms.params;
			u.quadHalf.value = [geo.quadHalfX, geo.quadHalfY];
			u.videoHalf.value = [geo.videoHalfX, geo.videoHalfY];
			u.cornerRadius.value = this.params.cornerRadius;
			u.borderWidth.value = this.params.borderWidth;
			u.glowRadius.value = this.params.glowRadius;
			u.glowInset.value = this.params.glowInset;
			u.glowStrength.value = this.params.glowStrength;
			u.hover.value = item.hoverWeight * this.params.hoverGlowBoost;
			u.gradientEdge.value = this.params.gradientEdge;
			u.gradientMid.value = this.params.gradientMid;
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
		this.updateRotation();
	}

	// 0..1 across the section's approach, from a scrubbed ScrollTrigger that
	// ends where the pin begins. Same finite guard as setProgress: a NaN would
	// flow into rotation and from there into every mesh's GPU transform.
	setPreRoll(p) {
		if (!Number.isFinite(p)) return;
		this.preRoll = p;
		this.updateRotation();
	}

	updateRotation() {
		this.rotation = composeRotation({
			preRoll: this.preRoll,
			progress: this.progress,
			rotationsPerScroll: this.params.rotationsPerScroll,
			preRollTurns: this.params.preRollTurns
		});
	}

	setVelocity(v) {
		// Same finite guard as setProgress, for a sharper reason: a NaN here is
		// STICKY. update() does `velocitySmoothed += (target - velocitySmoothed) *
		// rate`, and once velocitySmoothed is NaN no later finite value can ever
		// pull it back. layout() would then see a NaN radius and hide every mesh
		// on every subsequent frame — the ring would go dark permanently, with no
		// recovery short of a reload. Dropping the bad sample keeps the last good
		// velocity instead.
		if (!Number.isFinite(v)) return;
		// Across a runway wrap Lenis's own velocity collapses to 0, because its
		// `immediate` scrollTo calls reset(). Ignoring samples for a couple of
		// frames HOLDS the last good value instead, so the radius boost sails
		// through the seam. Forcing it to 0 here (as this used to) made the ring
		// visibly spring inward and back out at exactly the moment the user was
		// scrolling fast enough to notice.
		if (this._holdVelocityFrames > 0) return;
		this._targetVelocity = v; // Task 5
	}

	// Called by the layout's runway-wrap handler immediately before it teleports
	// the scroll position, so the teleport's bogus velocity readings are ignored
	// rather than driving the radius boost.
	holdVelocity() {
		this._holdVelocityFrames = 2;
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

	// Drives the pointer cursor (and doubles as a DOM-inspectable QA signal, since
	// the WebGPU canvas cannot be read back from a page-level probe).
	//
	// Deliberately toggled on the SECTION, not on <html>. `cursor` is inherited,
	// so a root-level toggle invalidates styles for every element on the page —
	// measured at 4.5ms per toggle against 2142 elements, 1001 of them SplitText
	// character divs. That is 27% of a 16.7ms frame burned every time the hover
	// state flipped, which is what made the rotating ring stagger. Scoped to the
	// section the same measurement is 0ms.
	setHoverClass(on) {
		this.element?.classList.toggle('is-hovering', on);
	}

	handlePointerMove(e) {
		const index = this.hitTest(e);
		if (index === this.hoveredIndex) return;
		this.hoveredIndex = index;
		this.setHoverClass(index != null);
		this.onHover?.(index);
	}

	handleClick(e) {
		// The listener is on `window`, not the canvas — the canvas is fixed and
		// sits BEHIND all page content, so it is never the event target for a
		// click over any DOM element. Without this check, clicking any DOM UI
		// that happens to overlap the ring's screen area would do its own thing
		// AND navigate to whichever teaser was behind it.
		//
		// Today that is latent only by accident (the .sr-only links are clipped
		// to 1px, the hover label is pointer-events: none, and the debug panel
		// sits in a corner the planes don't reach). Anything placed over the ring
		// later would trip it, so gate on the target rather than on that luck.
		if (e.target instanceof Element && e.target.closest(INTERACTIVE_SELECTOR)) return;
		const index = this.hitTest(e);
		if (index == null) return; // click on a ring gap / empty space: no-op
		this.onNavigate?.(this.items[index].teaser.href);
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
			// Clearing hoveredIndex is enough to drop the hover scale — layout()
			// derives it from this field every frame.
			this.hoveredIndex = null;
			this.setHoverClass(false);
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
		if (this._holdVelocityFrames > 0) this._holdVelocityFrames -= 1;
		// `_targetVelocity` is frozen at its last good value while the hold is
		// counting down (see setVelocity), so this needs no special case — the
		// boost simply keeps easing toward wherever it was already headed.
		const target = Math.min(
			Math.abs(this._targetVelocity ?? 0) * this.params.velocityGain,
			this.params.maxVelocityBoost
		);
		// Frame-rate-independent exponential ease toward target. Eases back to 0
		// automatically once Lenis's own velocity settles to 0 at rest — no
		// separate "return to rest" branch needed.
		const rate = 1 - Math.exp(-this.params.velocitySmoothing * dt);
		this.velocitySmoothed += (target - this.velocitySmoothed) * rate;

		this.layout(dt);
	}

	destroy() {
		this.destroyed = true;
		this.unsubFrame();
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('click', this._onClick);
		this.setHoverClass(false);
		// Mirror setActive(false)'s hover reset. Without this the consumer's
		// hovered-index state survives the scene: on the device-lost path
		// (+layout.svelte) the page stays mounted while the ring is destroyed, so
		// WorkTeasers' label would sit onscreen naming a teaser that no longer
		// exists. Guarded on hoveredIndex so a teardown from a non-hovered state
		// doesn't fire a redundant null.
		if (this.hoveredIndex != null) {
			this.hoveredIndex = null;
			this.onHover?.(null);
		}
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
