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
//    [Task 2 update: the projected `Plane` described here has been REMOVED —
//    see the Task 2 block below. Kept for history/context on the buffer
//    layout it established, which the new unprojected renderer still uses.]
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
//    [Task 2 update: no longer relevant — the render path no longer uses a
//    gpu-curtains Plane/Geometry at all, see the Task 2 block below.]
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
//    [Task 2 update: there is no more `plane.domElement` — this scene now
//    reads `element.getBoundingClientRect()` directly every frame (see the
//    Task 2 block below), which returns the identical CSS-px DOMRect shape.]
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
//    [Task 2 update: the particle field is now ALSO a `FullscreenPlane`
//    (category 3/4, same as the fluid's), so `renderOrder` now DOES do real
//    work — see Task 2 note below on ordering within that category.]

// --- Task 5 additions: [VERIFY-API] resolution notes ---------------------
// (Task 5, [VERIFY-API] markers from p2-task-5-brief.md.) Verified against
// node_modules/gpu-curtains/dist/types/**/*.d.ts and the
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
//    [Task 2 update: the render-side `BufferBinding` described above has been
//    REMOVED — see Task 2 note #14 below for why it's no longer needed.]
//
// 7. `ComputePass` dispatch order relative to the Plane's render — already
//    resolved by Task 4's [VERIFY-API #5] above: Scene.mjs's render order is
//    (1) ComputePass, (2) pingPong, (3)-(7) meshes — so with the default
//    `autoRender: true` (ComputePassOptions, ComputePass.d.ts) the compute
//    dispatch always runs BEFORE this scene's Plane renders in the same
//    frame, with no extra hook needed; particles are same-frame-fresh.
//    [Task 2 update: `autoRender` is now explicitly `false` and the dispatch
//    is manual — see Task 2 note #12 below; this note's ordering conclusion
//    no longer applies (there is no more automatic scene-driven dispatch at
//    all for this ComputePass).]
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
//    [Task 2 update: there is no more `plane`/rotation to set — tilt is now
//    baked directly into the unprojected render uniform's `tilt`/`tiltDepth`
//    fields, read by particlesRender.wgsl.js's vertex shader as a screen-
//    space NDC offset. Same eased tilt math, different destination.]

// --- Task 2 (P2b) additions: [VERIFY-API] resolution notes ----------------
// (Task 2, [VERIFY-API] markers from p2b-task-2-brief.md.) Verified against
// node_modules/gpu-curtains/dist/types + dist/esm. Consumes Task 1's
// `createParticleRenderer`/`logoLocalToNdc` (see particleRenderer.js) to
// replace the projected `Plane` render path entirely with an unprojected
// offscreen render + FullscreenPlane composite (FluidScene's own pattern).
//
// 12. Manual compute dispatch, ONE encoder per frame, no double-dispatch.
//    `ComputePass`'s constructor destructures `autoRender` (ComputePass.mjs):
//    when explicitly `false`, `addToScene(true)` still pushes this pass onto
//    `renderer.computePasses` (so `.remove()`'s bookkeeping/cleanup still
//    works) but SKIPS `renderer.scene.addComputePass(this)` — i.e. gpu-
//    curtains' own automatic per-frame scene walk NEVER dispatches this
//    ComputePass. We still want its `ComputeMaterial` (lazy pipeline compile,
//    bind-group creation/update, uniform value sync via
//    `computePass.uniforms.sim.*.value = ...`) for free, so `update()` still
//    calls the real public `computePass.onBeforeRenderPass()` every frame —
//    exactly the call already proven safe in the Task 1 report's pane
//    verification ("Forced the shared particle GPUBuffer into existence...
//    by calling `logoScene.computePass.onBeforeRenderPass()` directly") —
//    which lazily compiles the pipeline/bind groups and pushes any dirty
//    uniform values to the GPU, with NO dispatch and NO draw.
//    The actual dispatch is issued by hand on our OWN manually-created
//    `GPUComputePassEncoder`, deliberately NOT via `computePass.render(pass)`
//    / `ComputeMaterial.render(pass)`. Reason (the T5 report's proven
//    pitfall): `Material.render()` calls `this.setPipeline(pass)` ->
//    `renderer.pipelineManager.setCurrentPipeline(pass, pipelineEntry)`
//    (PipelineManager.mjs), which SKIPS the actual `pass.setPipeline(...)`
//    WebGPU call whenever `pipelineEntry.index === currentPipelineIndex` — a
//    single index tracked GLOBALLY on the shared `renderer.pipelineManager`,
//    not per native pass object. [Task 3 correction] `resetCurrentPipeline()`
//    (which clears that cache) is NOT only called by `GPURenderer.renderOnce()`
//    and on device restoration — `core/scenes/Scene.mjs` also calls it every
//    frame from its own ordinary `render()` path, once per `renderSinglePassEntry()`
//    (after each render pass entry) and once per compute pass in the compute
//    loop. The earlier grep behind this note was scoped only to
//    `dist/esm/core/renderers/*.mjs` and missed these `core/scenes/Scene.mjs`
//    call sites, which is why it wrongly concluded the ordinary per-frame path
//    never resets the cache. T5's pane-verification pitfall is still real, just
//    for a narrower reason: driving the sim via nothing but repeated manual
//    `material.render(pass)` calls, with NO curtains scene `render()` interleaved
//    at all (a standalone pane script, not the normal per-frame engine loop),
//    left `currentPipelineIndex` stuck on our own pipeline after the first call,
//    silently dropping every subsequent frame's `pass.setPipeline()` (symptom:
//    exactly one effective step) — because with no `Scene.render()` call
//    happening in between, nothing was resetting the cache in that repro. In
//    normal production frames `Scene.render()` DOES run between our manual
//    dispatches and would reset the cache anyway; we still bypass
//    `PipelineManager` entirely (raw pass encoding, below) rather than depend on
//    that ordering, since our own dispatch is issued outside gpu-curtains' own
//    per-frame walk (`autoRender: false`, note above) and nothing guarantees its
//    relative timing against `Scene.render()`. We instead
//    replicate `ComputeMaterial.render()`'s own bind-group-set/dispatch body
//    by hand with the RAW pass encoder, exactly T5's documented workaround:
//      pass.setPipeline(material.pipelineEntry.pipeline);
//      for (const bg of material.bindGroups) pass.setBindGroup(bg.index, bg.bindGroup);
//      pass.dispatchWorkgroups(...material.dispatchSize);
//    `material.pipelineEntry.pipeline` is the compiled `GPUComputePipeline`
//    (PipelineEntry.mjs: `this.pipeline = null` then set by
//    `createComputePipeline`/`createComputePipelineAsync` once ready);
//    `material.bindGroups` is the `Material` base class's public array of
//    already-built `BindGroup`s (each with `.index`/`.bindGroup`, Material.mjs);
//    `material.dispatchSize` is the ceil'd `[x,y,z]` array (ComputeMaterial.mjs
//    constructor). Gated on `computePass.ready` (public getter, flips true
//    once `material.ready` — i.e. bind groups built AND pipeline compiled)
//    so the first async-compile frames safely no-op instead of touching a
//    null pipeline.
//    Then, in the SAME command encoder (created fresh every frame in
//    `update()`), `particleRenderer.render(encoder, {...})` runs the
//    unprojected draw into its own offscreen target — satisfying the brief's
//    "one command encoder, fresh each frame" requirement end to end.
//
// 13. Composite bridge — reuses FluidScene.js's exact `Texture` +
//    `copyGPUTexture` + `FullscreenPlane` pattern verbatim (see FluidScene.js's
//    own header comment for the zero-copy aliasing mechanism). `particleRenderer
//    .outputTexture` (particleRenderer.js) is a single STABLE (non-swapping)
//    target recreated only by its own `resize()` — same shape as FluidScene's
//    `sim.output` — so, like FluidScene's `curtainsTexture`, this bridge only
//    needs to re-run once at construction and once per `engine.onResize`, not
//    every frame. `renderOrder` is real, load-bearing work here (unlike the
//    old projected Plane, which drew after the fluid structurally regardless
//    of its `renderOrder` value per note #5 above): this composite plane is a
//    `FullscreenPlane` — an UNPROJECTED, transparent mesh, the SAME Scene.mjs
//    category (3/4) as the fluid's own display plane. Scene.mjs sorts within
//    that category ascending by `renderOrder` (confirmed: Scene.mjs L109/402,
//    `if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder`).
//    The fluid's plane never sets `renderOrder` (default 0); this composite
//    plane sets `renderOrder: 1`, so it draws strictly after the fluid within
//    that category. The grain `ShaderPass` is a separate post-processing pass
//    over the whole composited canvas texture, proven (Phase 1/Task 4 note #5)
//    to run after ALL scene meshes regardless — no interaction with this
//    ordering. Blend: identical `PREMULTIPLIED_BLEND` to FluidScene's own
//    composite plane and to the old projected Plane (both the canvas's own
//    `alphaMode: 'premultiplied'` and this scene's own offscreen render target
//    already output premultiplied color, per particlesRender.wgsl.js's
//    fragment: `vec4f(color, intensity)` with `color = white * intensity`).
//
// 14. Removed the render-side `BufferBinding` (`particlesRenderBinding`) from
//    Task 5/6. Its ENTIRE purpose (note #6 above) was making the shared
//    storage buffer legally bindable to the OLD Plane's VERTEX stage via a
//    gpu-curtains-generated `read-only-storage` bind-group-layout entry —
//    a gpu-curtains bind-group concern. The new unprojected `particleRenderer`
//    (particleRenderer.js) builds its OWN raw `GPURenderPipeline` via
//    `layout: 'auto'` directly from `particlesRender.wgsl.js`'s
//    `var<storage, read> particles` declaration — WebGPU derives the correct
//    `read-only-storage` bind-group-layout type from the shader source itself,
//    entirely independent of gpu-curtains. `particleRenderer.render()`'s only
//    contract on its `renderBinding` argument is `renderBinding.buffer.GPUBuffer`
//    (any object with that shape — see particleRenderer.js's own header note
//    and the Task 1 report's confirmation that this accessor works against
//    the SAME `BufferBinding.mjs`-constructed `.buffer` this file already
//    relies on for note #6's sharing mechanism). `this.particlesComputeBinding`
//    (the `WritableBufferBinding`) already exposes exactly that shape once its
//    OWN bind group has allocated the real `GPUBuffer` (same `.buffer.GPUBuffer`
//    accessor, `WritableBufferBinding extends BufferBinding`) — GPUBuffer
//    `usage` flags (`STORAGE`) don't distinguish read vs read_write at the
//    resource level (only the bind-group-LAYOUT entry type does, which is now
//    derived independently per pipeline), so handing the compute binding
//    straight to `particleRenderer.render({ renderBinding: this
//    .particlesComputeBinding, ... })` is safe. This also removes the
//    previously-flagged "render-side initial write redundancy" carry-forward
//    (T5 report concern #1) outright: there is now only ONE binding, so only
//    ONE initial 4.8 MB upload, not two byte-identical ones.
//
// 15. Per-frame rect sanity guard. `element.getBoundingClientRect()` replaces
//    the old `plane.domElement.boundingRect` DOM-sync (there is no more
//    DOMObject3D doing that automatically — see note #4's Task 2 update).
//    Rather than re-deriving the "is this rect/canvas usable" check, `update()`
//    calls Task 1's own pure, already-tested `logoLocalToNdc` with a cheap
//    probe point (`px: 0, py: 0`) and reads its `.ok` flag — exactly "per
//    logoLocalToNdc's ok=false logic" per the brief. `px`/`py` = 0 are always
//    finite, so the probe's `ok` reduces to exactly the rect/canvas
//    finite-and-positive checks `logoLocalToNdc` already performs; no
//    duplicate validity logic is written here. `ok: false` → skip the
//    compute dispatch AND `particleRenderer.render()` for this frame entirely
//    (the fluid scene is a fully independent `onFrame` subscriber — it is
//    never touched by this scene's early return).
//
// 16. Units: CSS px vs DEVICE px. `element.getBoundingClientRect()` is always
//    CSS px. The render uniform's `canvas` field MUST be in the SAME units
//    as `rect` for the shader's ratio math (`sx = (rect.x + px*rect.w) /
//    canvas.x`) to be correct — mixing a DEVICE-px canvas size against a
//    CSS-px rect would scale the mapped box by `1/dpr`, squeezing it into a
//    corner of the canvas on any HiDPI screen. So the uniform's `canvas`
//    field uses `engine.input.getSize()` (CSS px — `canvas.clientWidth`/
//    `clientHeight` with a `getBoundingClientRect()` fallback, engine.js),
//    the SAME CSS-px canvas measurement already used for the pointer-mapping
//    math below (and already used pre-Task-2 for the identical reason). This
//    is completely independent from the OFFSCREEN TEXTURE RESOLUTION
//    `particleRenderer` renders into and the composite `Texture`'s
//    `fixedSize` — both of those use `engine.getCanvasSize()` (DEVICE px,
//    already DPR-scaled, per engine.js's own resolution notes) purely for
//    visual sharpness, matching FluidScene's `curtainsTexture` sizing.
//    Feeding NDC coordinates (already resolution-independent, computed in
//    the vertex shader from the CSS-px ratio above) into a DEVICE-px-sized
//    render target is exactly how the old projected Plane behaved too (its
//    camera/viewport were sized in device px while its DOM-sync rect was CSS
//    px) — no new invariant, just made explicit since there's no more
//    gpu-curtains camera doing this transparently.
//
// 17. Suspended/degraded behavior (budgetGuard 'degrade' verdict) deviates
//    slightly from the pre-Task-2 scene, and this is intentional: previously,
//    once `suspended`, `update()` returned early BEFORE the pointer/tilt math
//    and BEFORE any uniform sync — but the Plane still visually tracked
//    scroll/resize every frame regardless, because DOMObject3D's DOM-sync ran
//    inside gpu-curtains' OWN per-frame scene walk, entirely independent of
//    whether this scene's `update()` did anything. Now that DOM-sync is
//    manual (`element.getBoundingClientRect()` inside `update()` itself),
//    an early return would ALSO freeze on-screen position — a real scroll-
//    tracking regression, not a faithful translation of the old behavior.
//    So: the rect probe, pointer/tilt math, and the render-uniform fill +
//    `particleRenderer.render()` call all keep running every frame even while
//    `suspended` (cheap — one draw call, matches the ORIGINAL degrade intent
//    of "stop the expensive part, keep rendering"); only the compute
//    dispatch (the actual per-particle spring/curl/pointer/fluid pass — the
//    expensive part the guard exists to shed) is skipped while `suspended`.
//    `computePass.active` is no longer toggled/consulted anywhere (dead in
//    the old code path now that `autoRender: false` means curtains' own scene
//    walk never looks at it, and our manual dispatch gates on `this.suspended`
//    directly) — removed rather than left as a vestigial, misleading flag.

import {
	ComputePass,
	WritableBufferBinding,
	Texture,
	Sampler,
	FullscreenPlane
} from 'gpu-curtains';
import { bakeLogoImage } from '../particles/bakeLogo.js';
import { sampleSpawnPoints } from '../particles/spawnSampler.js';
import { mulberry32 } from '../utils/rng.js';
import { createBudgetGuard } from '../particles/budgetGuard.js';
import { tiltFalloff, TILT_MARGIN } from '../particles/tiltFalloff.js';
import { PARTICLES_COMPUTE } from '../particles/shaders/particlesCompute.wgsl.js';
import {
	createParticleRenderer,
	logoLocalToNdc,
	PARTICLE_RENDER_UNIFORM_SIZE
} from '../particles/particleRenderer.js';

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

// Composite bridge fragment — identical shape to FluidScene.js's PASSTHROUGH_FRAG,
// sampling this scene's own offscreen `particleRenderer` output instead of the
// fluid's. Default vertex shader / `VSOutput` struct / `main` entry point /
// `defaultSampler` auto-add are all the same proven FullscreenPlane mechanism
// (see FluidScene.js header comment + GrainPass.js note).
const PARTICLES_COMPOSITE_FRAG = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@fragment fn main(fsInput: VSOutput) -> @location(0) vec4f {
  return textureSample(particlesTexture, defaultSampler, fsInput.uv);
}
`;

export class LogoParticlesScene {
	static async create({ engine, element, fluidScene = null, seed = Date.now(), onGuardKill }) {
		const imageData = await bakeLogoImage();
		return new LogoParticlesScene({ engine, element, fluidScene, seed, imageData, onGuardKill });
	}

	constructor({ engine, element, fluidScene, seed, imageData, onGuardKill }) {
		this.engine = engine;
		this.element = element;
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
			size: 0.00175, // sprite radius, plane-local units
			opacity: 0.6,
			// Flat tint matching the CSS logo's fill (static/images/logo.svg,
			// fill="#33C5F3") — the smoke-mask density lives in per-particle
			// brightness (seed.y), so a flat tint reproduces the original look.
			color: { r: 51 / 255, g: 197 / 255, b: 243 / 255 },
			spring: 2.0,
			damping: 1.3,
			curlStrength: 0.06,
			curlScale: 6.0,
			curlSpeed: 1.0,
			pointerRadius: 0.01,
			pointerForce: 5.0,
			coupling: 2.0,
			shimmerSpeed: 1.6,
			shimmerIntensity: 0.45,
			sizeVariation: 0.99,
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

		// [VERIFY-API #6/#14] The particle struct shape (four `array<vec2f>` SoA
		// fields, matching order pos/vel/home/seed) locks the 32 B/particle AoS
		// layout the compute shader (and the offscreen render shader) both read.
		// Only ONE binding owns this buffer now (see Task 2 note #14) — the
		// render side no longer needs a second `BufferBinding` counterpart.
		this.particlesComputeBinding = new WritableBufferBinding({
			label: 'particles',
			name: 'particles',
			struct: {
				pos: { type: 'array<vec2f>', value: posArr },
				vel: { type: 'array<vec2f>', value: velArr },
				home: { type: 'array<vec2f>', value: homeArr },
				seed: { type: 'array<vec2f>', value: seedArr }
			}
		});

		// [VERIFY-API #9] Fluid-velocity coupling texture + sampler — see header
		// note #9/#10. `this.hasFluid` gates real aliasing vs the inert 1x1
		// placeholder; either way a valid GPUTexture is always bound so the
		// compute pipeline (one static WGSL string, coupling branch is real
		// control flow) always compiles.
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
		// [VERIFY-API #12] `autoRender: false` — this ComputePass is NEVER
		// dispatched by gpu-curtains' own automatic scene walk; update() drives
		// it by hand, in the same encoder as the offscreen particle render.
		this.computePass = new ComputePass(engine.curtains, {
			label: 'logo-particles-sim',
			autoRender: false,
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

		// [VERIFY-API #13] Unprojected offscreen particle renderer (Task 1) +
		// FluidScene-style composite bridge. Offscreen target sized in DEVICE
		// px (visual sharpness — see note #16); composited via a FullscreenPlane
		// that draws after the fluid (renderOrder) and before grain (structural).
		const { width: devW, height: devH } = engine.getCanvasSize();
		this.particleRenderer = createParticleRenderer(engine.device, { format: 'rgba16float' });
		this.particleRenderer.resize(devW, devH);

		this.particlesCompositeTexture = new Texture(engine.curtains, {
			label: 'logo-particles-composite',
			name: 'particlesTexture',
			format: 'rgba16float',
			fixedSize: { width: devW, height: devH },
			autoDestroy: false
		});
		// Drop the placeholder GPUTexture the constructor just allocated before
		// aliasing onto particleRenderer's real (already-created) output target
		// — same pattern as FluidScene's curtainsTexture bridge.
		this.particlesCompositeTexture.texture?.destroy();
		this.particlesCompositeTexture.copyGPUTexture(this.particleRenderer.outputTexture);

		this.compositePlane = new FullscreenPlane(engine.curtains, {
			label: 'logo-particles-composite',
			shaders: { fragment: { code: PARTICLES_COMPOSITE_FRAG } },
			transparent: true,
			targets: [{ blend: PREMULTIPLIED_BLEND }],
			textures: [this.particlesCompositeTexture],
			renderOrder: 1 // load-bearing here — see note #13 (draws after the fluid's renderOrder-0 plane)
		});

		// Reused every frame to avoid a per-frame Float32Array allocation —
		// see particlesRender.wgsl.js header for the 96 B / 24-float field
		// layout (rect, canvas, size, opacity, time, shimmer*, glintGain, tilt,
		// tiltDepth).
		this._uniformArray = new Float32Array(PARTICLE_RENDER_UNIFORM_SIZE / 4);

		this._lastFrameTime = performance.now();
		this._simTime = 0;
		// Previous-frame pointer texcoords, for locally-derived pointer speed
		// (see update() — input.js's own deltas go stale when the mouse stops).
		this._prevPtrX = 0;
		this._prevPtrY = 0;
		// Tilt Step 1b: current eased tilt (radians), lerped toward a
		// pointer-driven target each frame in update(). Now baked into the
		// render uniform's `tilt` field instead of a Plane's rotation — see
		// note #11's Task 2 update / note #17.
		this.tiltX = 0;
		this.tiltY = 0;

		// Re-bridge BOTH the fluid-velocity texture (if any) and the particle
		// composite texture after every engine resize — see header note #9's
		// resize caveat (fixedSize Texture#resize() is a no-op) and note #13.
		// Always subscribed now (previously conditional on hasFluid, since only
		// the fluid-velocity rebridge used to live here) — the particle
		// composite rebridge is unconditional.
		this.unsubResize = engine.onResize(() => {
			if (this.destroyed) return;
			if (this.hasFluid) {
				const fresh = this.fluidScene?.sim?.velocitySharedTexture;
				if (fresh) this.fluidVelocityTexture.copyGPUTexture(fresh.texture);
			}
			const { width: w, height: h } = engine.getCanvasSize();
			this.particleRenderer.resize(w, h);
			this.particlesCompositeTexture.copyGPUTexture(this.particleRenderer.outputTexture);
		});

		this.unsubFrame = engine.onFrame(() => this.update());
	}

	update() {
		if (this.destroyed || this.engine.hidden) return;

		const now = performance.now();
		const rawFrameMs = now - this._lastFrameTime;
		const dt = Math.min(rawFrameMs / 1000, 0.033);
		this._lastFrameTime = now;
		this._simTime += dt;

		// Safety-valve watchdog (see budgetGuard.js + header note above). Sampled
		// EVERY frame, even while already `suspended` — a 'degrade' already
		// applied doesn't stop heap growth or continued bad frames from later
		// escalating to 'kill' (that's the whole point of a second-strike
		// watchdog). frameMs MUST be the raw, unclamped elapsed time: the sim's
		// `dt` above is capped at 33ms, and the guard's badFrameMs threshold is
		// 80ms — feeding it the clamped value would make slow frames invisible
		// to the watchdog (they'd all read as 33ms) and the entire degrade/
		// frame-time-kill path unreachable. heapMB is Chrome-only
		// (`performance.memory` is a non-standard Chrome extension); on other
		// browsers it's `undefined`, which the guard's heap check treats as "no
		// reading" and simply never fires on (see budgetGuard.js's typeof
		// check) — not a broken guard, just an inert one on non-Chrome.
		const frameMs = rawFrameMs;
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
			// freeze in place but keep rendering (and keep tracking scroll/
			// resize), at half opacity as a visible "something's wrong" signal.
			// See header note #17 for why the render side keeps running here
			// unlike the pre-Task-2 scene.
			this.suspended = true;
			this.params.opacity *= 0.5;
			console.warn('[particles] degraded: slow frames — compute paused, opacity halved');
		}

		// [VERIFY-API #15] Rect sanity guard: reuse logoLocalToNdc's own
		// finite/positive validity check via a cheap probe point rather than
		// re-deriving it. `element.getBoundingClientRect()` is the manual
		// DOM-sync replacement for the old Plane's automatic boundingRect.
		const rect = this.element.getBoundingClientRect();
		const { width: cw, height: ch } = this.engine.input.getSize(); // CSS px — see note #16
		const probe = logoLocalToNdc({
			px: 0,
			py: 0,
			rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
			canvas: { width: cw, height: ch }
		});
		if (!probe.ok) return; // fluid keeps running via its own independent onFrame subscriber.

		// Pointer -> logo-local uv. rect is CSS px (getBoundingClientRect);
		// input texcoords are already canvas CSS uv (Phase 1 fix, see input.js).
		const ptr = this.engine.input.pointers[0];
		const localX = (ptr.texcoordX * cw - rect.left) / rect.width;
		const localY = (ptr.texcoordY * ch - rect.top) / rect.height;
		// Pointer speed must be derived from OUR OWN frame-to-frame delta, not
		// from ptr.deltaX/deltaY: input.js only recomputes those inside its
		// mousemove handler (and only zeroes them on mousedown), so once the
		// pointer stops moving the last non-zero delta persists forever — glint
		// and sim.pointerVel would stay pinned high indefinitely. input.js's
		// delta semantics are parity-locked to the fluid's splat behavior and
		// must not be changed, hence the local re-derivation here.
		const dxT = ptr.texcoordX - this._prevPtrX;
		const dyT = ptr.texcoordY - this._prevPtrY;
		this._prevPtrX = ptr.texcoordX;
		this._prevPtrY = ptr.texcoordY;
		// dt is the clamped sim step (>0 after the first frame); guard anyway so
		// a zero-length frame can't produce Infinity.
		const speed = dt > 0 ? Math.hypot(dxT, dyT) / dt : 0;
		const inside =
			localX > -TILT_MARGIN &&
			localX < 1 + TILT_MARGIN &&
			localY > -TILT_MARGIN &&
			localY < 1 + TILT_MARGIN;

		if (!this.suspended) {
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
			sim.pointer.value = [localX, localY];
			sim.pointerVel.value = Math.min(speed, 8);
			sim.pointerActive.value = inside ? 1 : 0;
			sim.planeRect.value = [rect.left, rect.top, rect.width, rect.height];
			sim.canvasSize.value = [cw, ch];
			if (this.hasFluid) {
				const v = this.fluidScene.sim.velocity;
				sim.fluidTexel.value = [v.texelSizeX, v.texelSizeY];
			}
		}

		// In-scene tilt (replaces the retired DOM use:tilt; same production
		// tuning — see src/lib/actions/tilt.js). Pointer-driven target rotation
		// from localX/localY (already computed above), clamped to maxTilt and
		// eased toward each frame by tiltEase. Fed into the render uniform's
		// `tilt` field below instead of a Plane's rotation — see note #11's
		// Task 2 update.
		//
		// GLITCH FIX: the target used to be gated on the boolean `inside`
		// (localX/localY within ±TILT_MARGIN of the box) while nx/ny were
		// clamped to the box itself. Those two extents disagreed, so anywhere in
		// the margin band the target sat at FULL tilt and then stepped straight
		// to 0 the moment the pointer crossed the invisible ±0.2 line — a
		// full-magnitude discontinuity that the 0.067 easing then dragged out
		// over ~half a second, so sweeping the pointer past the logo made the
		// whole field lurch. tiltRamp() replaces the step with a linear 1->0
		// falloff across the same margin: the target is now continuous
		// everywhere, and still exactly 0 outside the margin.
		const nx = Math.min(Math.max(localX * 2 - 1, -1), 1); // -1..1 across the box
		const ny = Math.min(Math.max(localY * 2 - 1, -1), 1);
		const falloff = tiltFalloff(localX, localY);
		const maxRad = (this.params.maxTilt * Math.PI) / 180;
		const targetX = ny * maxRad * falloff; // pointer below center tips the top toward viewer
		const targetY = -nx * maxRad * falloff;
		this.tiltX += (targetX - this.tiltX) * this.params.tiltEase;
		this.tiltY += (targetY - this.tiltY) * this.params.tiltEase;
		// Defensive finite clamp: this is an accumulator (not re-derived from
		// scratch each frame), so a single non-finite input (e.g. a transient
		// NaN localX/localY) would otherwise corrupt it FOREVER — easing toward
		// a finite target never recovers a NaN accumulator. The WGSL side
		// already degenerates any resulting non-finite NDC position (see
		// particlesRender.wgsl.js's final range guard), but that only protects
		// that one frame's draw, not this persistent JS-side state.
		if (!Number.isFinite(this.tiltX)) this.tiltX = 0;
		if (!Number.isFinite(this.tiltY)) this.tiltY = 0;

		// [VERIFY-API #12] Lazily compile/update the compute material (no
		// dispatch, no draw) — safe to call every frame even while suspended.
		this.computePass.onBeforeRenderPass();
		if (!this.computePass.ready) return; // first async-compile frames: nothing to dispatch/draw yet.

		const encoder = this.engine.device.createCommandEncoder({ label: 'logo-particles-frame' });

		if (!this.suspended) {
			const material = this.computePass.material;
			const pass = encoder.beginComputePass({ label: 'logo-particles-sim' });
			pass.setPipeline(material.pipelineEntry.pipeline);
			for (const bindGroup of material.bindGroups) {
				pass.setBindGroup(bindGroup.index, bindGroup.bindGroup);
			}
			pass.dispatchWorkgroups(...material.dispatchSize);
			pass.end();
		}

		const u = this._uniformArray;
		u[0] = rect.left;
		u[1] = rect.top;
		u[2] = rect.width;
		u[3] = rect.height;
		u[4] = cw;
		u[5] = ch;
		u[6] = this.params.size;
		u[7] = this.params.opacity;
		u[8] = this._simTime;
		u[9] = this.params.shimmerSpeed;
		u[10] = this.params.shimmerIntensity;
		u[11] = this.params.sizeVariation;
		u[12] = this.params.glintGain;
		u[13] = 0; // _pad0
		u[14] = this.tiltX;
		u[15] = this.tiltY;
		u[16] = this.params.tiltDepth;
		u[17] = 0; // _pad1
		// u[18]/u[19] are WGSL's implicit padding: `color: vec3f` has align 16,
		// so after tiltDepth@64/_pad1@68 the next valid offset is 80 (float 20),
		// NOT 72. Writing the tint at 18 would land it in the padding hole and
		// render every particle black. Struct ends at 92, rounds to 96 = the
		// buffer size.
		const c = this.params.color;
		u[20] = c.r;
		u[21] = c.g;
		u[22] = c.b;

		this.particleRenderer.render(encoder, {
			renderBinding: this.particlesComputeBinding,
			uniformBytes: u,
			count: this.params.count
		});

		this.engine.queue.submit([encoder.finish()]);
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
		// never auto-removed by `texture.destroy()` when constructed with
		// `autoDestroy: false` (`Material.destroyTexture()` early-returns on
		// `!texture.options.autoDestroy` — confirmed against Material.mjs — so
		// even `compositePlane.remove()`/`computePass.remove()` would NOT
		// unregister these on their own). Since this scene is destroyed and
		// recreated on every homepage nav-away/return, leaving them registered
		// grows `renderer.textures`/`deviceManager.samplers` unboundedly (a slow
		// leak — the stale wrappers do no per-frame GPU work, but the arrays never
		// shrink). Unregister all of them explicitly:
		// - `GPURenderer.removeTexture(texture)` (GPURenderer.mjs) just filters
		//   `this.textures` by `uuid` — it does NOT touch `texture.texture` (the
		//   underlying GPUTexture), so this is safe to call unconditionally,
		//   including the aliased fluid-present/particle-composite cases: we are
		//   unregistering our own JS wrapper, not the GPUTexture it points at.
		// - `GPURenderer.removeSampler(sampler)` delegates to
		//   `GPUDeviceManager.removeSampler(sampler)` (GPUDeviceManager.mjs), which
		//   likewise just filters `deviceManager.samplers` by `uuid` — no GPU
		//   resource is touched.
		if (!this.hasFluid) this.fluidVelocityTexture.texture?.destroy();
		this.engine.curtains.renderer.removeTexture(this.fluidVelocityTexture);
		this.engine.curtains.renderer.removeSampler(this.fluidVelocitySampler);
		this.computePass.remove();

		// particlesCompositeTexture aliases particleRenderer.outputTexture (owned
		// and destroyed by particleRenderer.destroy() below, or replaced on its
		// own resize()) — never destroy the aliased native GPUTexture from this
		// wrapper, only unregister the wrapper itself (same pattern as above).
		this.compositePlane.remove();
		this.engine.curtains.renderer.removeTexture(this.particlesCompositeTexture);
		this.particleRenderer.destroy();
	}
}
