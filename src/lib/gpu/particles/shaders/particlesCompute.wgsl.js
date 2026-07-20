// Compute-shader particle simulation (spring return-home, damping, curl-noise
// idle drift). Runs as a gpu-curtains `ComputePass` sharing the SAME storage
// buffer the render `Plane` reads — see LogoParticlesScene.js header comment
// for the buffer-sharing mechanism (a `WritableBufferBinding` created here is
// handed a `BufferBinding` counterpart via the `buffer:` param on the render
// side, NOT the same binding instance reused verbatim).
// [Phase 2b update: the render `Plane` and its `BufferBinding` counterpart
// are REMOVED — the reader is now particleRenderer.js, which binds this
// WritableBufferBinding's raw GPUBuffer directly as read-only storage. The
// interleaved 32 B/particle layout described below is unchanged and still
// load-bearing for both sides.]
//
// [VERIFY-API] Storage struct/binding declaration — SAME auto-interleave
// mechanism as the removed render side used (particles.wgsl.js, deleted in
// Phase 2b / LogoParticlesScene.js [VERIFY-API #2], now historical): the
// four `array<vec2f>` struct fields (pos, vel, home,
// seed) passed to the `WritableBufferBinding` constructed in
// LogoParticlesScene.js are auto-interleaved by gpu-curtains into
//   struct Particles { pos: vec2f, vel: vec2f, home: vec2f, seed: vec2f };
//   @group(x) @binding(y) var<storage, read_write> particles: array<Particles>;
// We do NOT declare either the struct or the binding variable here — do not
// redeclare `particles`, and access instances as `particles[i]` (locked
// 32 B/particle layout, no `.elements` wrapper).
//
// [VERIFY-API] `sim` uniform struct — declared via the ComputePass's
// `uniforms: { sim: { struct: {...} } }` constructor param in
// LogoParticlesScene.js, which gpu-curtains auto-generates as
//   struct Sim { dt: f32, time: f32, ... };
//   @group(x) @binding(y) var<uniform> sim: Sim;
// and auto-injects into the compute shader head (same
// BufferBinding.mjs#setWGSLFragment / ComputePipelineEntry.mjs#patchShaders
// mechanism proven for uniforms elsewhere in this codebase, e.g. GrainPass.js
// `params`). We do not declare `struct Sim` or `var sim` ourselves.
//
// [VERIFY-API] Compute entry-point builtins — unlike a render `Plane`'s
// `Geometry`, which auto-injects an `Attributes` struct carrying
// `@builtin(vertex_index)`/`@builtin(instance_index)` (see particles.wgsl.js
// [VERIFY-API]) [Phase 2b update: that Plane and particles.wgsl.js are
// REMOVED; kept as historical contrast only], `ComputePipelineEntry.mjs#patchShaders` (dist/esm/core/
// pipelines/ComputePipelineEntry.mjs) ONLY prepends binding struct/variable
// WGSL fragments to the shader head — it injects no entry-function signature
// or builtin-param struct of its own. So declaring
// `@builtin(global_invocation_id) id: vec3u` as a plain function parameter
// here (matching the brief's draft) is correct and does not collide with
// anything gpu-curtains generates.
//
// sim uniform struct fields (all f32 unless noted): dt, time, spring,
// damping, curlStrength, curlScale, curlSpeed, pointer (vec2f, logo-local uv),
// pointerRadius, pointerForce, pointerVel, pointerActive, coupling, aspect
// (bake box aspect, 1.153594844873037, used to make forces isotropic in
// plane-local uv space).
//
// --- Task 6 additions ---
// sim struct extended with planeRect (vec4f: x,y,w,h of the logo box in
// canvas CSS px), canvasSize (vec2f, canvas CSS px), fluidTexel (vec2f, the
// fluid velocity target's texelSize — see FluidSimulation.js resize()).
//
// [VERIFY-API] `fluidVelocity`/`fluidSampler` bindings — declared via the
// ComputePass's `textures`/`samplers` constructor params in
// LogoParticlesScene.js (gpu-curtains `Texture`/`Sampler` instances, NOT raw
// GPUTexture/GPUSampler — see types/Materials.d.ts `MaterialInputBindingsParams`).
// `Material.mjs#addTexture`/`#addSampler` only bind a texture/sampler into the
// bind group if its `name` string appears in `options.shaders.compute.code`
// (confirmed: the same reachability check also scans `.compute.code`, not
// just vertex/fragment), so declaring `textureSampleLevel(fluidVelocity,
// fluidSampler, ...)` below is sufficient — we do not declare `var
// fluidVelocity`/`var fluidSampler` ourselves, gpu-curtains auto-injects them
// (`getTextureBindingWGSLVarType`: default `type: 'texture'` + rg16float ->
// `var fluidVelocity: texture_2d<f32>;`, filterable since rg16float supports
// linear sampling). A `Texture`'s default `visibility` is `['fragment']`
// only (types/Textures.d.ts `TextureVisibility`) — LogoParticlesScene passes
// `visibility: ['compute']` explicitly when constructing it, or the compute
// bind-group layout would omit the entry entirely and the pipeline would fail
// to compile/bind.
export const PARTICLES_COMPUTE = /* wgsl */ `
struct Particle {
  pos: vec2f,
  vel: vec2f,
  home: vec2f,
  seed: vec2f,
};

// --- 2D value-gradient noise + analytic-ish curl via central differences ---
fn hash22(p: vec2f) -> vec2f {
  var q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(q) * 43758.5453123);
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22(i + vec2f(0.0, 0.0)), f - vec2f(0.0, 0.0)),
        dot(hash22(i + vec2f(1.0, 0.0)), f - vec2f(1.0, 0.0)), u.x),
    mix(dot(hash22(i + vec2f(0.0, 1.0)), f - vec2f(0.0, 1.0)),
        dot(hash22(i + vec2f(1.0, 1.0)), f - vec2f(1.0, 1.0)), u.x),
    u.y
  );
}

// Divergence-free 2D flow: curl of scalar noise field n -> (dn/dy, -dn/dx).
fn curlNoise(p: vec2f) -> vec2f {
  let e = 0.01;
  let dx = noise2(p + vec2f(e, 0.0)) - noise2(p - vec2f(e, 0.0));
  let dy = noise2(p + vec2f(0.0, e)) - noise2(p - vec2f(0.0, e));
  return vec2f(dy, -dx) / (2.0 * e);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];

  // Work in aspect-corrected space so forces are visually isotropic.
  let asp = vec2f(sim.aspect, 1.0);
  let pos = p.pos * asp;
  let home = p.home * asp;

  var force = vec2f(0.0);

  // Spring back to home.
  force += (home - pos) * sim.spring;

  // Curl-noise idle drift (smoky churn), phase-offset per particle.
  let drift = curlNoise(pos * sim.curlScale + vec2f(sim.time * sim.curlSpeed, p.seed.x));
  force += drift * sim.curlStrength;

  // Pointer repulsion, scaled by cursor speed (Task 5 wires uniforms; active
  // flag is 0 until Task 6 supplies real pointer data — the code is complete).
  let toP = pos - sim.pointer * asp;
  let dist = length(toP);
  if (sim.pointerActive > 0.5 && dist < sim.pointerRadius) {
    let falloff = 1.0 - dist / sim.pointerRadius;
    force += normalize(toP + vec2f(1e-5)) * falloff * falloff * sim.pointerForce * (0.35 + sim.pointerVel);
  }

  // One-way fluid coupling: sample the fluid's velocity field at this
  // particle's screen position and advect along the current.
  // planeRect = (x, y, w, h) of the logo box in canvas CSS px; canvasSize in CSS px.
  if (sim.coupling > 0.0) {
    let screenUv = (sim.planeRect.xy + p.pos * sim.planeRect.zw) / sim.canvasSize;
    // Fluid velocity is stored in sim-texel units/sec (see FluidSimulation
    // advection); texelSize converts to uv/sec, planeRect scale converts to
    // logo-local units/sec. textureSampleLevel: compute shaders have no
    // implicit derivatives.
    let v = textureSampleLevel(fluidVelocity, fluidSampler, screenUv, 0.0).xy;
    let vUv = v * sim.fluidTexel;                       // uv/sec in canvas space
    let vLocal = vUv * (sim.canvasSize / sim.planeRect.zw); // logo-local/sec
    force += vLocal * asp * sim.coupling;
  }

  var vel = p.vel + force * sim.dt;
  vel *= max(0.0, 1.0 - sim.damping * sim.dt);

  p.vel = vel;
  p.pos = (pos + vel * sim.dt) / asp;
  particles[i] = p;
}
`;
