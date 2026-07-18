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
//    without cross-contamination.
//    CORRECTION (Task 6 review): the render-side binding NEVER performs a
//    write, not even an initial one — `BufferBinding.mjs#update()` starts
//    with `if (this.options.buffer) { this.shouldUpdate = false; return; }`,
//    an unconditional short-circuit for any binding constructed with the
//    `buffer:` option. `BindGroup.mjs#updateBufferBindings()` calls
//    `binding.update()` immediately before checking `binding.shouldUpdate`
//    in the same loop iteration, so the `shouldUpdate = true` that
//    `setBufferAttributes()` set at construction is cleared before that
//    check ever runs, on every call including the first. The compute-side
//    `WritableBufferBinding` (constructed WITHOUT `buffer:` — it owns the
//    `Buffer`) has no such guard in its own `update()` path, so it is the
//    single writer for this shared `GPUBuffer`. In practice that write only
//    ever fires once (the initial upload): this scene never reassigns the
//    compute binding's `.inputs.*.value`s afterward either, so `shouldUpdate`
//    never re-arms on the CPU side — from frame 1 onward the compute
//    shader's own `particles[i] = p;` writes mutate the GPUBuffer directly in
//    VRAM, with no further `queueWriteBuffer` calls from either binding.
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

// --- Task 6 additions: [VERIFY-API] resolution notes ----------------------
// (Task 6, [VERIFY-API] markers from p2-task-6-brief.md.) Verified against
// node_modules/gpu-curtains/dist/types/**/*.d.ts + dist/esm/**/*.mjs.
//
// 9. Binding a texture into a `ComputePass` — `ComputePassParams` extends
//    `MaterialParams` extends `MaterialInputBindingsParams`
//    (types/Materials.d.ts), which declares `textures?: MaterialTexture[]`
//    and `samplers?: Sampler[]` — arrays of already-constructed gpu-curtains
//    `Texture`/`Sampler` wrapper instances (NOT raw GPUTexture/GPUSampler),
//    passed as top-level `ComputePass` constructor options exactly like
//    `bindings`/`uniforms`. `Material.mjs#addTexture`/`#addSampler` only wire
//    a texture/sampler into the bind group if its `name` string appears in
//    `options.shaders.compute.code` (confirmed: the same reachability check
//    used for vertex/fragment also scans `.compute.code` — the FullscreenPlane
//    pattern from FluidScene.js generalizes to compute passes unchanged), so
//    referencing `fluidVelocity`/`fluidSampler` in particlesCompute.wgsl.js's
//    WGSL is sufficient; we do not declare `var fluidVelocity`/`var
//    fluidSampler` ourselves.
//    A `Texture`'s default `visibility` is `['fragment']` only
//    (types/Textures.d.ts `TextureVisibility` doc comment: "Default to
//    'fragment'") — passing `visibility: ['compute']` explicitly when
//    constructing the fluid-velocity `Texture` below is load-bearing;
//    without it the compute bind-group layout omits the entry and the
//    pipeline fails to compile/bind. A `Sampler`'s underlying
//    `SamplerBinding` is built via the base `Binding` constructor with no
//    `visibility` passed (Sampler.mjs `createBinding()`), which defaults to
//    ALL THREE stages (`Binding.mjs`, same default already proven for
//    `BufferBinding`/`WritableBufferBinding` in note #6 above) — no explicit
//    visibility needed on the `Sampler`.
//    Same zero-copy aliasing pattern as FluidScene.js's `curtainsTexture`
//    bridge: construct `new Texture(engine.curtains, { fixedSize, format:
//    'rg16float', visibility: ['compute'], autoDestroy: false })`, destroy
//    the placeholder GPUTexture it allocates, then `copyGPUTexture(...)` onto
//    `fluidScene.sim.velocitySharedTexture.texture` — a STABLE (non-swapping)
//    target per FluidSimulation.js's Task 6 addition, so (unlike
//    FluidScene's ping-ponging `dye.read` debug case) this bridge only needs
//    to re-run on resize, not every frame; `velocityShared` itself is
//    refreshed in place via `copyTextureToTexture` inside
//    `FluidSimulation.render()`.
//    Resize caveat: `fixedSize` makes `Texture#resize()` a no-op, and
//    `FluidSimulation.resize()` destroys+recreates `velocityShared` (new
//    GPUTexture identity) on every renderer resize. This scene re-runs
//    `copyGPUTexture` onto the fresh texture from its own `engine.onResize`
//    subscription — correct ONLY if `FluidScene`'s own `onResize` (which
//    calls `sim.resize()`) was registered first, since `engine.onResize`'s
//    `Set`-based fan-out (resizeHub) preserves insertion order. True in both
//    known hosts (FluidScene is always constructed, and thus subscribed,
//    before LogoParticlesScene) but not independently enforced — flagged as
//    a carry-forward concern in the Task 6 report.
//
// 10. `fluidScene` may be `null` (e.g. a future dev harness without a fluid
//    layer). The compute shader is one static WGSL string with a runtime
//    (not static) `if (sim.coupling > 0.0)` branch around the
//    `fluidVelocity`/`fluidSampler` reads, so per `passes.js`'s
//    "WGSL bindings not statically reachable are stripped by layout:'auto'"
//    note, these bindings ARE reachable (the branch is real control flow,
//    not dead code) and therefore always required by the pipeline's
//    auto-generated layout, independent of whether `sim.coupling` is ever
//    nonzero at runtime. So a real GPU resource must always be bound; we
//    cannot literally omit the texture when `fluidScene` is `null`. Instead:
//    construct the `Texture` at a harmless 1x1 `fixedSize` and skip the
//    `copyGPUTexture` aliasing step (leaving its own placeholder GPUTexture,
//    zero-initialized per the WebGPU spec, bound but never sampled) AND
//    force `sim.coupling.value = 0` every frame in `update()` regardless of
//    `this.params.coupling` — the branch never executes, so the placeholder
//    is inert. This satisfies the brief's "guard coupling (uniform 0 + skip
//    texture binding)" option without an invalid/missing bind-group entry.

// --- Task 8 additions: [VERIFY-API] resolution notes ----------------------
// (Task 8, Step 1b tilt. [VERIFY-API] marker from p2-task-8-brief.md.)
// Verified against node_modules/gpu-curtains/dist/types + dist/esm.
//
// 11. `plane.rotation` (DOMObject3D -> ProjectedObject3D -> Object3D) is a
//    real settable `Vec3`, not a plain object — Object3D.mjs's constructor
//    does `this.transforms.rotation = new Vec3(); this.rotation.onChange(()
//    => this.applyRotation());`, and Vec3.mjs's `set x()`/`set y()`/`set z()`
//    each unconditionally invoke `this._onChangeCallback()` when the value
//    actually changes. So direct `plane.rotation.x = value` / `.y = value`
//    (as used in update() below) DOES mark the model matrix dirty via
//    `applyRotation()` on every assignment — no special setter, no
//    `plane.rotation = new Vec3(x, y, 0)` replacement-object dance, and no
//    extra "mark dirty" call needed. DOMObject3D.mjs does not override
//    rotation handling (its own `onChange` wiring is only for
//    `documentPosition`), so this is unmodified base Object3D behavior.

import {
	Plane,
	ComputePass,
	BufferBinding,
	WritableBufferBinding,
	Texture,
	Sampler
} from 'gpu-curtains';
import { bakeLogoImage } from '../particles/bakeLogo.js';
import { sampleSpawnPoints } from '../particles/spawnSampler.js';
import { mulberry32 } from '../utils/rng.js';
import { createBudgetGuard } from '../particles/budgetGuard.js';
import { PARTICLES_VERTEX, PARTICLES_FRAGMENT } from '../particles/shaders/particles.wgsl.js';
import { PARTICLES_COMPUTE } from '../particles/shaders/particlesCompute.wgsl.js';

// Bake box aspect (width/height), locked in Task 2/3 — reused here so
// compute-side forces stay isotropic regardless of the plane's aspect ratio.
const BAKE_ASPECT = 1.153594844873037;

// --- Safety-valve additions (2026-07-17) ------------------------------
// The homepage hero (150k desktop particles over the fluid) froze a real
// M1/16GB machine hard enough to need a power-button restart (swap storm,
// 2.1GB dirtied). Until the root cause is bisected, this scene must be
// UNABLE to take a machine down again, and must double as the low-count
// diagnostic instrument for that bisection session. Two independent
// mechanisms:
//
// 1. `?pcount=N` URL override (read once, here, at scene construction —
//    no runtime re-read/observer, so it's production-safe and can't be
//    toggled mid-session by page content). Clamped to [1000, 150000] so a
//    malformed/malicious query string can't request an unbounded count;
//    150000 is deliberately still reachable so a capable machine can dial
//    back up to the full production density once the freeze is
//    understood — see webgpu-refactor-status memory / the safety-valve
//    report for the bisection plan. `?noparticles` (skip scene creation
//    entirely) is handled one level up, in +layout.svelte's
//    syncParticlesScene — this module never sees that case.
const MIN_PARTICLE_COUNT = 1000;
const MAX_PARTICLE_COUNT = 150000;

function resolveParticleCount(defaultCount) {
	if (typeof location === 'undefined') return defaultCount; // SSR/prerender guard
	const raw = new URLSearchParams(location.search).get('pcount');
	if (raw === null) return defaultCount;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return defaultCount;
	return Math.min(MAX_PARTICLE_COUNT, Math.max(MIN_PARTICLE_COUNT, n));
}

// Matches FluidScene's PREMULTIPLIED_BLEND pattern (canvas alphaMode is
// 'premultiplied'; gpu-curtains' generic `transparent: true` default is
// straight-alpha, so this must be set explicitly — see FluidScene.js/Task 9).
const PREMULTIPLIED_BLEND = {
	color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
	alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
};

export class LogoParticlesScene {
	static async create({ engine, element, fluidScene = null, seed = Date.now(), onGuardKill }) {
		const imageData = await bakeLogoImage();
		return new LogoParticlesScene({ engine, element, fluidScene, seed, imageData, onGuardKill });
	}

	constructor({ engine, element, fluidScene, seed, imageData, onGuardKill }) {
		this.engine = engine;
		this.fluidScene = fluidScene;
		this.destroyed = false;
		// Layout-provided teardown hook — see the safety-valve header note above
		// and the 'kill' branch of update() below. Not required (defaults to a
		// no-op) so this scene stays constructible from tests/dev harnesses that
		// don't wire a layout.
		this.onGuardKill = onGuardKill;
		// One-way for the session once 'degrade' fires — see update().
		this.suspended = false;
		this.guard = createBudgetGuard();

		const isMobile = engine.quality.tier === 'mobile';
		// Conservative default (spec amendment 2026-07-17, sanctioned by the
		// freeze above): desktop drops 150000 -> 50000; mobile is unchanged at
		// 40000 (already conservative). `?pcount=N` can still reach the full
		// 150000 for capable machines — see resolveParticleCount above.
		const defaultCount = isMobile ? 40000 : 50000;
		this.params = {
			count: resolveParticleCount(defaultCount),
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
						opacity: { type: 'f32', value: this.params.opacity },
						// Task 7 additions — shimmer/glint, synced from params each
						// frame in update() off the same _simTime clock as sim.time.
						time: { type: 'f32', value: 0 },
						shimmerSpeed: { type: 'f32', value: this.params.shimmerSpeed },
						shimmerIntensity: { type: 'f32', value: this.params.shimmerIntensity },
						sizeVariation: { type: 'f32', value: this.params.sizeVariation },
						glintGain: { type: 'f32', value: this.params.glintGain },
						// Task 8 (Step 1b) — per-particle z spread read by the vertex
						// shader's zOffset calc, giving the in-scene tilt real parallax.
						tiltDepth: { type: 'f32', value: this.params.tiltDepth }
					}
				}
			},
			bindings: [this.particlesRenderBinding]
		});

		// [VERIFY-API #9] Fluid-velocity coupling texture + sampler — see header
		// note #9/#10. `this.hasFluid` gates real aliasing vs the inert 1x1
		// placeholder; either way a valid GPUTexture is always bound so the
		// compute pipeline (one static WGSL string, coupling branch is real
		// control flow) always compiles.
		// (T6-review drive-by: stored on `this` — was a local — so update()/
		// destroy() can gate on it consistently instead of re-deriving fluid
		// presence from `this.fluidScene` each time.)
		this.hasFluid = !!fluidScene?.sim?.velocitySharedTexture;
		const velocitySrc = this.hasFluid ? fluidScene.sim.velocitySharedTexture : null;

		this.fluidVelocitySampler = new Sampler(engine.curtains, {
			label: 'fluid-velocity-sampler',
			name: 'fluidSampler',
			magFilter: 'linear',
			minFilter: 'linear',
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge'
		});

		this.fluidVelocityTexture = new Texture(engine.curtains, {
			label: 'fluid-velocity-coupling',
			name: 'fluidVelocity',
			format: 'rg16float',
			fixedSize: velocitySrc
				? { width: velocitySrc.width, height: velocitySrc.height }
				: { width: 1, height: 1 },
			visibility: ['compute'], // load-bearing — Texture defaults to fragment-only, see note #9
			autoDestroy: false
		});
		if (velocitySrc) {
			// Drop the placeholder GPUTexture the constructor just allocated
			// (never rendered into) before aliasing onto the real fluid
			// velocityShared texture — same pattern as FluidScene's
			// curtainsTexture bridge.
			this.fluidVelocityTexture.texture?.destroy();
			this.fluidVelocityTexture.copyGPUTexture(velocitySrc.texture);
		}
		// else: keep the auto-allocated 1x1 placeholder (zero-initialized by
		// the WebGPU spec) — never sampled, sim.coupling is forced to 0 below.

		// [VERIFY-API #7] dispatchSize is workgroups, not particle count —
		// workgroup_size(64) in particlesCompute.wgsl.js, so ceil(count/64).
		this.computePass = new ComputePass(engine.curtains, {
			label: 'logo-particles-sim',
			shaders: {
				compute: { code: PARTICLES_COMPUTE }
			},
			dispatchSize: Math.ceil(count / 64),
			bindings: [this.particlesComputeBinding],
			textures: [this.fluidVelocityTexture],
			samplers: [this.fluidVelocitySampler],
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
						pointer: { type: 'vec2f', value: [0, 0] },
						pointerRadius: { type: 'f32', value: this.params.pointerRadius },
						pointerForce: { type: 'f32', value: this.params.pointerForce },
						pointerVel: { type: 'f32', value: 0 },
						pointerActive: { type: 'f32', value: 0 },
						coupling: { type: 'f32', value: this.params.coupling },
						aspect: { type: 'f32', value: BAKE_ASPECT },
						// Task 6 additions — see FLUID_COUPLING_SLOT in
						// particlesCompute.wgsl.js and update() below.
						planeRect: { type: 'vec4f', value: [0, 0, 0, 0] },
						canvasSize: { type: 'vec2f', value: [1, 1] },
						fluidTexel: { type: 'vec2f', value: [0, 0] }
					}
				}
			}
		});

		this._lastFrameTime = performance.now();
		this._simTime = 0;
		// Tilt Step 1b: current eased tilt (radians), lerped toward a
		// pointer-driven target each frame in update().
		this.tiltX = 0;
		this.tiltY = 0;

		// Re-bridge the fluid-velocity texture after every engine resize — see
		// header note #9's resize caveat (fixedSize Texture#resize() is a
		// no-op; FluidSimulation.resize() gives velocityShared a new GPUTexture
		// identity every time). Only relevant when a real fluid is present.
		this.unsubResize = this.hasFluid
			? engine.onResize(() => {
					if (this.destroyed) return;
					const fresh = this.fluidScene?.sim?.velocitySharedTexture;
					if (fresh) this.fluidVelocityTexture.copyGPUTexture(fresh.texture);
				})
			: null;

		this.unsubFrame = engine.onFrame(() => this.update());
	}

	update() {
		if (this.destroyed || this.engine.hidden) return;

		const now = performance.now();
		const dt = Math.min((now - this._lastFrameTime) / 1000, 0.033);
		this._lastFrameTime = now;
		this._simTime += dt;

		// Safety-valve watchdog (see budgetGuard.js + header note above). Sampled
		// EVERY frame, even while already `suspended` — a 'degrade' already
		// applied doesn't stop heap growth or continued bad frames from later
		// escalating to 'kill' (that's the whole point of a second-strike
		// watchdog). frameMs reuses the dt clock already computed above (×1000,
		// same clock the rest of the sim uses — no second timer). heapMB is
		// Chrome-only (`performance.memory` is a non-standard Chrome extension);
		// on other browsers it's `undefined`, which the guard's heap check
		// treats as "no reading" and simply never fires on (see
		// budgetGuard.js's typeof check) — not a broken guard, just an inert
		// one on non-Chrome.
		const frameMs = dt * 1000;
		const heapMB = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : undefined;
		const verdict = this.guard.sample({ frameMs, heapMB });

		if (verdict === 'kill') {
			// One-way: this scene does not resurrect itself. The layout owns
			// actually tearing the instance down (destroy() + clearing its own
			// `logoScene` ref + swapping the CSS logo back in) so a single
			// source of truth decides "is there a live particle scene" — see
			// +layout.svelte's onGuardKill wiring.
			console.error('[particles] killed: budget guard exceeded (slow frames and/or heap growth)');
			this.onGuardKill?.();
			return;
		}
		if (verdict === 'degrade' && !this.suspended) {
			// Cheap immediate relief: stop the compute dispatch (the expensive
			// per-frame N-particle spring/curl/fluid-coupling pass) — particles
			// freeze in place but keep rendering, at half opacity as a visible
			// "something's wrong" signal. `active` is a real, documented
			// ComputePass flag (ComputePass.d.ts / .mjs: gates onBeforeRenderPass
			// and render() both on `this.active`), not a guess — no need to
			// remove the pass outright.
			this.suspended = true;
			this.params.opacity *= 0.5;
			// Push this one uniform write directly: the normal per-frame uniform
			// sync below is short-circuited by `suspended` from this frame on, so
			// without this the halved opacity would never actually reach the GPU.
			this.plane.uniforms.render.opacity.value = this.params.opacity;
			this.computePass.active = false;
			console.warn('[particles] degraded: slow frames — compute paused, opacity halved');
		}
		if (this.suspended) return; // short-circuits uniform sync + pointer/tilt math below

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
		// Guard: no real fluid bound -> force coupling off regardless of the
		// live param, so the compute shader's inert placeholder texture (see
		// header note #10) is never meaningfully sampled.
		sim.coupling.value = this.hasFluid ? this.params.coupling : 0;

		// Pointer -> logo-local uv. `plane.domElement.boundingRect` is CSS px
		// ([VERIFY-API #4]); input texcoords are already canvas CSS uv (Phase 1
		// fix, see input.js). `engine.input.getSize()` (Task 6 addition to
		// input.js) reuses the exact same CSS-px canvas measurement the pointer
		// texcoords were computed from, instead of duplicating the fallback.
		const rect = this.plane.domElement.boundingRect;
		const { width: cw, height: ch } = this.engine.input.getSize();
		const ptr = this.engine.input.pointers[0];
		const hasRect = cw > 0 && rect.width > 0 && ch > 0 && rect.height > 0;
		const localX = hasRect ? (ptr.texcoordX * cw - rect.left) / rect.width : 0;
		const localY = hasRect ? (ptr.texcoordY * ch - rect.top) / rect.height : 0;
		const speed = Math.hypot(ptr.deltaX, ptr.deltaY) * 60; // per-second-ish
		// T6-review drive-by: without a valid rect/canvas size (pre-layout),
		// localX/localY fall back to 0 which sits inside the -0.2..1.2 window
		// below — force `inside` false in that case so pointerActive doesn't
		// spuriously read 1 before the plane has ever measured its own rect.
		const inside = hasRect && localX > -0.2 && localX < 1.2 && localY > -0.2 && localY < 1.2;

		sim.pointer.value = [localX, localY];
		sim.pointerVel.value = Math.min(speed, 8);
		sim.pointerActive.value = inside ? 1 : 0;

		sim.planeRect.value = [rect.left, rect.top, rect.width, rect.height];
		sim.canvasSize.value = [cw, ch];
		if (this.hasFluid) {
			const v = this.fluidScene.sim.velocity;
			sim.fluidTexel.value = [v.texelSizeX, v.texelSizeY];
		}

		// In-scene tilt (replaces the retired DOM use:tilt; same production
		// tuning — see src/lib/actions/tilt.js). Pointer-driven target rotation
		// from localX/localY (already computed above), clamped to maxTilt and
		// eased toward each frame by tiltEase. When the pointer is outside the
		// box (!inside), the target relaxes back to 0 (matches tilt.js's
		// mouseleave behavior).
		const nx = Math.min(Math.max(localX * 2 - 1, -1), 1); // -1..1 across the box
		const ny = Math.min(Math.max(localY * 2 - 1, -1), 1);
		const maxRad = (this.params.maxTilt * Math.PI) / 180;
		const targetX = inside ? ny * maxRad : 0; // pointer below center tips the top toward viewer
		const targetY = inside ? -nx * maxRad : 0;
		this.tiltX += (targetX - this.tiltX) * this.params.tiltEase;
		this.tiltY += (targetY - this.tiltY) * this.params.tiltEase;
		this.plane.rotation.x = this.tiltX; // Vec3 setter marks the model matrix dirty (Object3D onChange)
		this.plane.rotation.y = this.tiltY;

		this.plane.uniforms.render.size.value = this.params.size;
		this.plane.uniforms.render.opacity.value = this.params.opacity;
		// Task 7: shimmer/glint uniforms, same _simTime clock as sim.time above.
		this.plane.uniforms.render.time.value = this._simTime;
		this.plane.uniforms.render.shimmerSpeed.value = this.params.shimmerSpeed;
		this.plane.uniforms.render.shimmerIntensity.value = this.params.shimmerIntensity;
		this.plane.uniforms.render.sizeVariation.value = this.params.sizeVariation;
		this.plane.uniforms.render.glintGain.value = this.params.glintGain;
		this.plane.uniforms.render.tiltDepth.value = this.params.tiltDepth;
	}

	destroy() {
		this.destroyed = true;
		this.unsubFrame();
		this.unsubResize?.();
		// The fluid-present case aliases fluidVelocityTexture onto a GPUTexture
		// owned by FluidSimulation (autoDestroy: false, same as FluidScene's
		// curtainsTexture — must not destroy someone else's resource here). The
		// no-fluid placeholder case owns its own 1x1 GPUTexture that nothing else
		// references, so it must be cleaned up explicitly.
		//
		// [Final-review fix] Either way, the gpu-curtains `Texture`/`Sampler`
		// WRAPPER objects themselves are still registered on the renderer/device
		// manager (`new Texture()`/`new Sampler()` call `renderer.addTexture(this)`
		// / push onto `deviceManager.samplers` — Texture.mjs, Sampler.mjs) and are
		// never auto-removed by `texture.destroy()`. Since this scene is destroyed
		// and recreated on every homepage nav-away/return, leaving them registered
		// grows `renderer.textures`/`deviceManager.samplers` unboundedly (a slow
		// leak — the stale wrappers do no per-frame GPU work, but the arrays never
		// shrink). Unregister both explicitly:
		// - `GPURenderer.removeTexture(texture)` (GPURenderer.mjs) just filters
		//   `this.textures` by `uuid` — it does NOT touch `texture.texture` (the
		//   underlying GPUTexture), so this is safe to call unconditionally,
		//   including the aliased fluid-present case: we are unregistering our own
		//   JS wrapper, not the GPUTexture it points at.
		// - `GPURenderer.removeSampler(sampler)` delegates to
		//   `GPUDeviceManager.removeSampler(sampler)` (GPUDeviceManager.mjs), which
		//   likewise just filters `deviceManager.samplers` by `uuid` — no GPU
		//   resource is touched. (Confirmed by reading both methods in
		//   node_modules/gpu-curtains/dist/esm/core/renderers/GPURenderer.mjs and
		//   .../GPUDeviceManager.mjs; no splice-the-array-manually fallback needed,
		//   a real removal API exists for both.)
		if (!this.hasFluid) this.fluidVelocityTexture.texture?.destroy();
		this.engine.curtains.renderer.removeTexture(this.fluidVelocityTexture);
		this.engine.curtains.renderer.removeSampler(this.fluidVelocitySampler);
		this.computePass.remove();
		this.plane.remove();
	}
}
