// gpu-curtains 0.16.3 API resolution notes (Task 4, [VERIFY-API] markers from
// task-4-brief.md). Verified against node_modules/gpu-curtains/dist/types/**/*.d.ts
// (shapes) and the corresponding dist/esm/**/*.mjs runtime source (actual
// generation/behavior — types alone don't show it). Tasks 5-8 build directly
// on these; re-verify against the installed version before trusting them if
// gpu-curtains gets bumped.
//
// 1. Instancing on a `Plane` — `instancesCount` is a top-level `Plane`/
//    `PlaneGeometry` constructor param, not nested under `geometry`.
//    PlaneParams extends PlaneGeometryParams extends GeometryBaseParams =
//    `Omit<Partial<GeometryOptions>, 'verticesOrder'>`, and `GeometryOptions`
//    declares `instancesCount: number` (types/Geometries.d.ts). Runtime default
//    is `1` (PlaneGeometry.mjs constructor: `instancesCount = 1`). So
//    `new Plane(engine.curtains, element, { instancesCount: this.params.count, ... })`
//    is correct as drafted. Default `widthSegments`/`heightSegments` are both
//    `1`, giving a single indexed quad (4 vertices) per instance — exactly the
//    sprite base geometry we want; no need to pass either.
//
// 2. Storage buffer shape — THE BIGGEST DEVIATION FROM THE BRIEF'S DRAFT.
//    `storages` is `Record<bindingName, BufferBindingParams>` (types/BindGroups.d.ts
//    `ReadWriteInputBindings`), and `BufferBindingParams.struct` is
//    `Record<string, Input>` where each `Input` is `{ type, value }` — there is
//    NO top-level `value` on the binding itself (the brief's draft
//    `storages: { particles: { value: data } }` shape does not exist).
//    For a LOCKED interleaved-struct-per-instance (AoS) layout, the correct
//    gpu-curtains pattern is FOUR separate flat arrays, one per field, each
//    typed `array<vec2f>` and each of length `count * 2`:
//      struct: {
//        pos:  { type: 'array<vec2f>', value: posArr  },
//        vel:  { type: 'array<vec2f>', value: velArr  },
//        home: { type: 'array<vec2f>', value: homeArr },
//        seed: { type: 'array<vec2f>', value: seedArr },
//      }
//    BufferBinding.mjs#setInputsAlignment detects >1 array-typed struct fields
//    of matching element counts and auto-interleaves them into a single AoS
//    GPU buffer (comment: "Used to compute alignment when dealing with arrays
//    of Struct") — i.e. gpu-curtains does the AoS packing FOR us from four
//    caller-supplied SoA arrays; we do not build the interleaved Float32Array
//    by hand. setWGSLFragment's WGSL generation has TWO branches depending on
//    whether any plain (non-array) fields are mixed in alongside the array
//    fields: mixed → wraps the array in an `{ elements: array<...> }`
//    container struct; ALL-array (our case, all 4 fields are `array<vec2f>`)
//    → generates the struct directly with no wrapper:
//      struct Particles { pos: vec2f, vel: vec2f, home: vec2f, seed: vec2f };
//      @group(x) @binding(y) var<storage, read> particles: array<Particles>;
//    (Confirmed empirically, not just by reading source: an earlier version
//    of this file assumed the wrapped form and got a real WGSL compile error
//    — "cannot index into expression of type 'array<Particles>'" — from
//    trying `particles.elements[i]` against this actually-generated type.)
//    Field declaration order matches struct-object key insertion order
//    (pos, vel, home, seed) — confirmed by tracing `Object.keys(this.inputs)`
//    through `setInputsAlignment`. Access in the shader is
//    `particles[instanceIndex].pos` etc, exactly matching the brief's
//    original shader draft (no fix needed there, despite the storages param
//    shape underneath it being wrong — see above).
//    The struct TYPE name ("Particles") and the binding VARIABLE name
//    ("particles") differ only in case: `toKebabCase` in gpu-curtains'
//    utils.mjs is actually PascalCase despite the name
//    (`camelCase.charAt(0).toUpperCase() + camelCase.slice(1)`), so a
//    same-named binding key never collides with its own generated struct
//    type — no `label` override needed. (Also already proven safe in the
//    uniform case by GrainPass.js's `uniforms: { params: {...} }`, which
//    generates `struct Params {...}; var<uniform> params: Params;`.)
//    `usage: ['storage']` is NOT needed: BindGroup.mjs#createBindingBuffer
//    unconditionally includes `binding.bindingType` ("storage", from the
//    `storages` vs `uniforms` key) in the GPUBuffer usage flags regardless of
//    the `usage` option, so it would be redundant.
//    `access: 'read'` is the BufferBinding constructor default; passed
//    explicitly below only for documentation (Task 5's compute pass will flip
//    its own binding to `read_write`, this render-side binding stays `read`).
//
// 3. Default Plane vertex shader matrix/position chunk —
//    `getOutputPosition(position: vec3f) -> vec4f` (core/shaders/chunks/vertex/
//    head/get-position-helpers.mjs), auto-injected into every vertex shader
//    head by RenderPipelineEntry.mjs#patchShaders:
//      fn getOutputPosition(position: vec3f) -> vec4f {
//        return camera.projection * camera.view * matrices.model * vec4f(position, 1.0);
//      }
//    The `Attributes` struct (Geometry.mjs#setWGSLFragment) is likewise
//    auto-injected and provides `@location(0) position: vec3f` / `uv: vec2f`
//    (PlaneGeometry.mjs's default attribute names) plus
//    `@builtin(vertex_index)`/`@builtin(instance_index)` fields ON the struct
//    itself — we do not declare either struct ourselves in particles.wgsl.js,
//    and (confirmed via a real compile error, "'@builtin(instance_index)'
//    appears multiple times as pipeline input") must NOT also declare a
//    separate `@builtin(instance_index)` function parameter; instance index
//    is read as `attributes.instanceIndex`.
//
// 4. `plane.domElement.boundingRect` fields (needed by Task 6's coordinate
//    transform) — `DOMElementBoundingRect extends RectCoords, RectBBox,
//    DOMPosition` (core/DOM/DOMElement.d.ts): `{ top, right, bottom, left,
//    width, height, x, y }`, all CSS-pixel numbers (RectCoords: top/right/
//    bottom/left; RectBBox adds width/height; DOMPosition adds x/y). Standard
//    DOMRect-shaped object.
//    DOMObject3D.mjs#documentToWorldSpace confirms the DOM-sync mechanism:
//    the mesh's world position is computed from `this.boundingRect` relative
//    to `this.renderer.boundingRect` (the renderer's OWN canvas bounding
//    rect) — i.e. the synced DOM element's on-screen rect must overlap the
//    WebGPU canvas's on-screen rect for the mesh to be visible at all. This is
//    why the dev route's `[data-gpu-logo]` box is positioned to overlap the
//    fluid canvas (see +page.svelte `.logo-host`), not placed in a separate
//    page section the way Task 3's temp bake-check canvas was.
//
// 5. Draw order vs the fluid's FullscreenPlane — `renderOrder` is a real
//    `MeshBaseParams`/`MeshBaseRenderParams` field, but it does not need to do
//    the work here. Scene.mjs's own stacking order (JSDoc + the
//    `renderPassEntries` sort passes) draws, in order: (1) ComputePass,
//    (2) pingPong, (3) opaque UNPROJECTED meshes (FullscreenPlane / RenderBundle),
//    (4) transparent UNPROJECTED meshes, (5) prePass ShaderPass, (6) opaque
//    PROJECTED meshes (Mesh/DOMMesh/Plane), (7) transparent PROJECTED meshes.
//    FluidScene's display mesh is a `FullscreenPlane` (unprojected, category
//    3/4); this scene's particle field is a `Plane`/DOMMesh (projected,
//    category 6/7) — so it structurally draws AFTER the fluid regardless of
//    `renderOrder` value. The grain ShaderPass is a separate post-processing
//    pass applied to the whole composited canvas texture afterward (already
//    proven in Phase 1 per GrainPass.js), so it draws after both. `renderOrder:
//    1` is kept below purely as documentation of intent, not because it
//    changes behavior.

// --- Task 5 additions: [VERIFY-API] resolution notes ---------------------
// (Task 5, [VERIFY-API] markers from p2-task-5-brief.md.) Verified against
// node_modules/gpu-curtains/dist/types/**/*.d.ts (shapes) and the
// corresponding dist/esm/**/*.mjs runtime source.
//
// 6. Sharing the particle storage buffer between the render `Plane` and a
//    compute-shader `ComputePass` — THE CORE OF THIS TASK.
//    `WritableBufferBinding.mjs`'s constructor UNCONDITIONALLY overwrites its
//    own params before calling `super()`: `bindingType = "storage";
//    visibility = ["compute"];` (no `??` guard — any `visibility` passed in
//    is discarded). This means a `WritableBufferBinding` (`access:
//    'read_write'`, required for the compute shader to write) can NEVER be
//    visible to the vertex stage, and the render Plane's vertex shader reads
//    `particles[attributes.instanceIndex]` (see particles.wgsl.js). WebGPU
//    itself independently forbids a `storage` (read/write) buffer binding
//    from being visible to the vertex stage at all (only `read-only-storage`
//    is legal there) — so the SAME `WritableBufferBinding` instance literally
//    cannot be handed to both the Plane and the ComputePass; two different
//    binding objects are required, one per access level.
//    The documented mechanism for that split is `BufferBindingParams.buffer`
//    ("Optional already existing Buffer to use instead of creating a new
//    one. Allow to reuse an already created Buffer but with different read
//    or visibility values, or with a different WGSL struct." —
//    BufferBinding.d.ts). `BufferBinding`'s constructor does
//    `this.buffer = this.options.buffer ?? new Buffer()` (BufferBinding.mjs)
//    — passing an existing binding's `.buffer` (its `Buffer` wrapper, not a
//    raw `GPUBuffer`) makes the two `BufferBinding`/`WritableBufferBinding`
//    instances share the literal same `Buffer` object. `BindGroup.mjs`'s
//    `fillEntries()` only calls `createBindingBuffer` (which allocates the
//    actual `GPUBuffer`) `if (!binding.buffer.GPUBuffer && !binding.parent)`
//    — so whichever bind group is set up first allocates the real
//    `GPUBuffer` once, and the second consumer finds it already there and
//    reuses it. `getBindGroupLayoutBindingType()` (core/bindings/utils.mjs)
//    independently derives each bind group's own layout entry `type`
//    ('read-only-storage' for `access: 'read'`, valid in the vertex stage;
//    'storage' for `access: 'read_write'`, compute/fragment only) from each
//    binding's OWN `bindingType`/`access` — since the render-side and
//    compute-side bindings are separate JS objects living in separate
//    `BindGroup`s (Plane's render bind group vs ComputePass's compute bind
//    group), each gets the layout entry appropriate to its own access level
//    while pointing at the same underlying `GPUBuffer` resource. This is
//    exactly the WebGPU "shared storage buffer, different binding types per
//    pipeline" pattern (the okaydev "Dive into WebGPU part 4" pattern the
//    brief references).
//    Passing the same `struct` shape (with real initial values, not zeros)
//    to BOTH binding instances is safe, not a hazard: `BufferBinding.mjs
//    #setBindings` builds a FRESH internal wrapper object per struct field
//    (`const binding = {}`) and copies from the passed-in `struct[key]`
//    object rather than mutating it in place, so the same struct object (or
//    two structurally-identical ones) can be handed to both constructors
//    without cross-contamination. Both bindings independently compute
//    identical initial `arrayBuffer` bytes from identical struct
//    definitions/values, so even though both have `shouldUpdate = true` at
//    construction (`setBufferAttributes()`: `this.shouldUpdate =
//    this.arrayBufferSize > 0`) and thus both perform an initial
//    `queueWriteBuffer` to the shared `GPUBuffer`, the two writes are
//    byte-identical — no race. After frame 0 the render-side binding's own
//    `.value`s are never reassigned by this scene, so its `shouldUpdate`
//    never re-fires and it never stomps the compute pass's per-frame writes.
//    Concretely: the compute-side `WritableBufferBinding` is constructed
//    FIRST (it owns/creates the `Buffer`); the render-side plain
//    `BufferBinding` (`bindingType: 'storage'`, `access: 'read'`, default
//    (unset) `visibility` — `Binding`'s base constructor defaults to ALL
//    THREE stages when omitted, Binding.mjs) is constructed second, passing
//    `buffer: computeBinding.buffer`. `BufferBinding` and
//    `WritableBufferBinding` are both direct named exports of the
//    `gpu-curtains` package root (`dist/esm/index.mjs` re-exports them), so
//    no deep-import path is needed. Both instances are then handed to their
//    respective materials via the generic `bindings: [binding]` constructor
//    param (`BindGroupInputs.bindings: BindGroupBindingElement[]`,
//    types/BindGroups.d.ts) INSTEAD OF the `storages` shorthand param used
//    in Task 4 — `storages` always routes through
//    `BindGroup.mjs#createInputBindings`, which hardcodes `visibility:
//    binding.access === 'read_write' ? ['compute'] : binding.visibility` and
//    offers no way to pass an existing `Buffer` in, so it cannot express
//    this split; explicit `bindings:` is required.
//
// 7. `ComputePass` dispatch order relative to the Plane's render — already
//    resolved by Task 4's [VERIFY-API #5] above: Scene.mjs's render order is
//    (1) ComputePass, (2) pingPong, (3)-(7) meshes — so with the default
//    `autoRender: true` (ComputePassOptions, ComputePass.d.ts) the compute
//    dispatch always runs BEFORE this scene's Plane renders in the same
//    frame, with no extra hook needed; particles are same-frame-fresh.
//
// 8. `ComputePipelineEntry.mjs#patchShaders` (dist/esm/core/pipelines/
//    ComputePipelineEntry.mjs) only prepends bind-group struct/variable WGSL
//    fragments to the compute shader head — unlike a render `Geometry`, it
//    injects no `Attributes`-style builtin-param struct of its own. So the
//    compute entry point declares `@builtin(global_invocation_id) id: vec3u`
//    as a plain function parameter with no collision risk (see
//    particlesCompute.wgsl.js header for the full note).

import { Plane, ComputePass, BufferBinding, WritableBufferBinding } from 'gpu-curtains';
import { bakeLogoImage } from '../particles/bakeLogo.js';
import { sampleSpawnPoints } from '../particles/spawnSampler.js';
import { mulberry32 } from '../utils/rng.js';
import { PARTICLES_VERTEX, PARTICLES_FRAGMENT } from '../particles/shaders/particles.wgsl.js';
import { PARTICLES_COMPUTE } from '../particles/shaders/particlesCompute.wgsl.js';

// Bake box aspect (width/height), locked in Task 2/3 — reused here so
// compute-side forces stay isotropic regardless of the plane's aspect ratio.
const BAKE_ASPECT = 1.153594844873037;

// Matches FluidScene's PREMULTIPLIED_BLEND pattern (canvas alphaMode is
// 'premultiplied'; gpu-curtains' generic `transparent: true` default is
// straight-alpha, so this must be set explicitly — see FluidScene.js/Task 9).
const PREMULTIPLIED_BLEND = {
	color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
	alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

export class LogoParticlesScene {
	static async create({ engine, element, fluidScene = null, seed = Date.now() }) {
		const imageData = await bakeLogoImage();
		return new LogoParticlesScene({ engine, element, fluidScene, seed, imageData });
	}

	constructor({ engine, element, fluidScene, seed, imageData }) {
		this.engine = engine;
		this.fluidScene = fluidScene;
		this.destroyed = false;

		const isMobile = engine.quality.tier === 'mobile';
		this.params = {
			count: isMobile ? 40000 : 150000,
			size: 0.006, // sprite radius, plane-local units
			opacity: 1.0,
			spring: 6.0,
			damping: 3.5,
			curlStrength: 0.06,
			curlScale: 3.0,
			curlSpeed: 0.25,
			pointerRadius: 0.16,
			pointerForce: 1.4,
			coupling: 0.35,
			shimmerSpeed: 1.6,
			shimmerIntensity: 0.45,
			sizeVariation: 0.6,
			glintGain: 2.0,
			// Tilt (spec amendment 2026-07-14): production tilt.js tuning carried over.
			maxTilt: 13, // degrees
			tiltEase: 0.067,
			tiltDepth: 0.12 // per-particle z spread in plane-local units (parallax)
		};

		const rng = mulberry32(seed);
		const { positions, brightness } = sampleSpawnPoints(imageData, {
			count: this.params.count,
			rng
		});

		// [VERIFY-API #2] Four separate SoA arrays (NOT a single hand-interleaved
		// buffer) — gpu-curtains auto-interleaves matching-length array-typed
		// struct fields into the locked 32 B/particle AoS layout. vel starts at
		// zero (no motion until Task 5); home mirrors the spawn position (T5's
		// spring target); seed.x is a random phase, seed.y is bake brightness.
		const count = this.params.count;
		const posArr = positions; // already Float32Array(count * 2), pos == home at spawn
		const velArr = new Float32Array(count * 2); // zeroed: static field, Task 4 has no motion
		const homeArr = new Float32Array(positions); // copy: independent buffer from pos
		const seedArr = new Float32Array(count * 2);
		for (let i = 0; i < count; i++) {
			seedArr[i * 2 + 0] = rng() * Math.PI * 2; // phase
			seedArr[i * 2 + 1] = brightness[i]; // brightness
		}

		// [VERIFY-API #6] The particle struct shape (four `array<vec2f>` SoA
		// fields, matching order pos/vel/home/seed) is shared by both binding
		// instances below so they independently generate the identical locked
		// 32 B/particle AoS layout. The compute-side WritableBufferBinding is
		// constructed FIRST — it owns the `Buffer` wrapper (creates the real
		// GPUBuffer, access 'read_write', gpu-curtains forces its visibility to
		// ['compute'] regardless of what's passed). The render-side plain
		// BufferBinding reuses that same Buffer via `buffer:` with its own
		// access 'read' (-> 'read-only-storage' bind group layout entry, legal
		// in the vertex stage, unlike 'storage') — see header comment for the
		// full resolution.
		const particleStruct = () => ({
			pos: { type: 'array<vec2f>', value: posArr },
			vel: { type: 'array<vec2f>', value: velArr },
			home: { type: 'array<vec2f>', value: homeArr },
			seed: { type: 'array<vec2f>', value: seedArr }
		});

		this.particlesComputeBinding = new WritableBufferBinding({
			label: 'particles',
			name: 'particles',
			struct: particleStruct()
		});

		this.particlesRenderBinding = new BufferBinding({
			label: 'particles',
			name: 'particles',
			bindingType: 'storage',
			access: 'read',
			buffer: this.particlesComputeBinding.buffer,
			struct: particleStruct()
		});

		this.plane = new Plane(engine.curtains, element, {
			label: 'logo-particles',
			instancesCount: count,
			transparent: true,
			targets: [{ blend: PREMULTIPLIED_BLEND }],
			renderOrder: 1, // documentation only — see [VERIFY-API #5] above
			shaders: {
				vertex: { code: PARTICLES_VERTEX },
				fragment: { code: PARTICLES_FRAGMENT, entryPoint: 'fsMain' }
			},
			uniforms: {
				render: {
					struct: {
						size: { type: 'f32', value: this.params.size },
						opacity: { type: 'f32', value: this.params.opacity }
					}
				}
			},
			bindings: [this.particlesRenderBinding]
		});

		// [VERIFY-API #7] dispatchSize is workgroups, not particle count —
		// workgroup_size(64) in particlesCompute.wgsl.js, so ceil(count/64).
		this.computePass = new ComputePass(engine.curtains, {
			label: 'logo-particles-sim',
			shaders: {
				compute: { code: PARTICLES_COMPUTE }
			},
			dispatchSize: Math.ceil(count / 64),
			bindings: [this.particlesComputeBinding],
			uniforms: {
				sim: {
					struct: {
						dt: { type: 'f32', value: 0 },
						time: { type: 'f32', value: 0 },
						spring: { type: 'f32', value: this.params.spring },
						damping: { type: 'f32', value: this.params.damping },
						curlStrength: { type: 'f32', value: this.params.curlStrength },
						curlScale: { type: 'f32', value: this.params.curlScale },
						curlSpeed: { type: 'f32', value: this.params.curlSpeed },
						// Pointer fields zeroed until Task 6 wires real pointer data.
						pointer: { type: 'vec2f', value: [0, 0] },
						pointerRadius: { type: 'f32', value: this.params.pointerRadius },
						pointerForce: { type: 'f32', value: this.params.pointerForce },
						pointerVel: { type: 'f32', value: 0 },
						pointerActive: { type: 'f32', value: 0 },
						// Placeholder, wired by Task 6's FLUID_COUPLING_SLOT.
						coupling: { type: 'f32', value: this.params.coupling },
						aspect: { type: 'f32', value: BAKE_ASPECT }
					}
				}
			}
		});

		this._lastFrameTime = performance.now();
		this._simTime = 0;

		this.unsubFrame = engine.onFrame(() => this.update());
	}

	update() {
		if (this.destroyed || this.engine.hidden) return;

		const now = performance.now();
		const dt = Math.min((now - this._lastFrameTime) / 1000, 0.033);
		this._lastFrameTime = now;
		this._simTime += dt;

		const sim = this.computePass.uniforms.sim;
		sim.dt.value = dt;
		sim.time.value = this._simTime;
		sim.spring.value = this.params.spring;
		sim.damping.value = this.params.damping;
		sim.curlStrength.value = this.params.curlStrength;
		sim.curlScale.value = this.params.curlScale;
		sim.curlSpeed.value = this.params.curlSpeed;
		sim.pointerRadius.value = this.params.pointerRadius;
		sim.pointerForce.value = this.params.pointerForce;
		sim.coupling.value = this.params.coupling;

		this.plane.uniforms.render.size.value = this.params.size;
		this.plane.uniforms.render.opacity.value = this.params.opacity;
	}

	destroy() {
		this.destroyed = true;
		this.unsubFrame();
		this.computePass.remove();
		this.plane.remove();
	}
}
