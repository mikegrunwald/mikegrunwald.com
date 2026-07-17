// Compute-shader particle simulation (spring return-home, damping, curl-noise
// idle drift). Runs as a gpu-curtains `ComputePass` sharing the SAME storage
// buffer the render `Plane` reads — see LogoParticlesScene.js header comment
// for the buffer-sharing mechanism (a `WritableBufferBinding` created here is
// handed a `BufferBinding` counterpart via the `buffer:` param on the render
// side, NOT the same binding instance reused verbatim).
//
// [VERIFY-API] Storage struct/binding declaration — SAME auto-interleave
// mechanism as the render side (see particles.wgsl.js / LogoParticlesScene.js
// [VERIFY-API #2]): the four `array<vec2f>` struct fields (pos, vel, home,
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
// [VERIFY-API]), `ComputePipelineEntry.mjs#patchShaders` (dist/esm/core/
// pipelines/ComputePipelineEntry.mjs) ONLY prepends binding struct/variable
// WGSL fragments to the shader head — it injects no entry-function signature
// or builtin-param struct of its own. So declaring
// `@builtin(global_invocation_id) id: vec3u` as a plain function parameter
// here (matching the brief's draft) is correct and does not collide with
// anything gpu-curtains generates.
//
// sim uniform struct fields (all f32 unless noted): dt, time, spring,
// damping, curlStrength, curlScale, curlSpeed, pointer (vec2f, logo-local uv,
// zeroed until Task 6), pointerRadius, pointerForce, pointerVel,
// pointerActive (zeroed until Task 6 supplies real pointer data — the force
// code below is complete and already gated on it), coupling (placeholder,
// wired by Task 6's FLUID_COUPLING_SLOT), aspect (bake box aspect,
// 1.153594844873037, used to make forces isotropic in plane-local uv space).
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

  // FLUID_COUPLING_SLOT — Task 6 inserts velocity-field sampling here.

  var vel = p.vel + force * sim.dt;
  vel *= max(0.0, 1.0 - sim.damping * sim.dt);

  p.vel = vel;
  p.pos = (pos + vel * sim.dt) / asp;
  particles[i] = p;
}
`;
