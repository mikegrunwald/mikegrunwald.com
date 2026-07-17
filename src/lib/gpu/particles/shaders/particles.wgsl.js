// Instanced soft-sprite particle rendering.
//
// Storage struct layout is LOCKED (32 B/particle): pos, vel, home, seed —
// shared with the Task 5 compute shader. seed.x = phase, seed.y = brightness.
//
// [VERIFY-API] Storage buffer access path (see LogoParticlesScene.js header
// comment for the full resolution + evidence, INCLUDING a corrected trace —
// an earlier draft of that comment wrongly predicted a `.elements` wrapper).
// gpu-curtains auto-interleaves the four `array<vec2f>` struct fields passed
// via `storages.particles.struct` into ONE struct-array
// (BufferBinding.mjs#setWGSLFragment). Because ALL FOUR fields are array-
// typed (no plain scalar fields mixed in), it takes the "pure array" branch
// and generates, directly:
//   struct Particles { pos: vec2f, vel: vec2f, home: vec2f, seed: vec2f };
//   @group(x) @binding(y) var<storage, read> particles: array<Particles>;
// (`toKebabCase` in gpu-curtains' utils.mjs is actually PascalCase despite
// the name — confirmed empirically via the WGSL compile error this file
// originally produced: "cannot index into expression of type
// 'array<Particles>'" when the code below wrongly tried `.elements`.)
// So instance data IS `particles[instanceIndex]`, exactly matching
// task-4-brief.md's original draft — the `Attributes` struct used below is
// separately generated/injected by gpu-curtains itself; we must not
// redeclare either struct in this file.
//
// [VERIFY-API] `Attributes` (Geometry.mjs#setWGSLFragment) already declares
// `@builtin(instance_index) instanceIndex: u32` as one of its own fields
// (alongside `vertexIndex` and the per-vertex-buffer attributes) — adding a
// SECOND separate `@builtin(instance_index)` parameter, as the brief's draft
// signature did, is a duplicate pipeline-input declaration and fails
// compilation ("'@builtin(instance_index)' appears multiple times as
// pipeline input", confirmed by an earlier version of this file). Read
// `attributes.instanceIndex` instead.
export const PARTICLES_VERTEX = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) corner: vec2f,     // -1..1 within the sprite quad
  @location(1) brightness: f32,
  @location(2) phase: f32,
  @location(3) speed: f32,        // |vel| for glint (0 until Task 5 moves things)
  @location(4) twinkle: f32,      // Task 7: per-particle shimmer phase sample
};

@vertex
fn main(attributes: Attributes) -> VSOut {
  let p = particles[attributes.instanceIndex];

  // Local uv (top-left origin, ImageData convention) -> plane local space.
  // Plane geometry local space is -1..1 with +y up (PlaneGeometry.mjs:
  // position.y = y*2/height - 1); flip y HERE and only here.
  let local = vec2f(p.pos.x * 2.0 - 1.0, (1.0 - p.pos.y) * 2.0 - 1.0);

  // Sprite corner from the base quad vertex position (-1..1), scaled to a
  // fraction of the plane. render.size is sprite radius in plane-local units.
  let corner = attributes.position.xy;
  // Per-particle size oscillation: independent phase + frequency from seed.
  let freq = 0.7 + 1.3 * fract(p.seed.x * 7.31);
  let tw = sin(render.time * render.shimmerSpeed * freq + p.seed.x * 6.2831853);
  let jitter = (0.7 + 0.6 * fract(p.seed.x * 13.37)) * (1.0 + render.sizeVariation * 0.35 * tw);
  let offset = corner * render.size * jitter;

  // Tilt Step 1b: per-particle z-offset (seeded, fixed per particle) so the
  // in-scene pointer tilt (LogoParticlesScene.update()) produces real
  // parallax between near/far particles instead of a flat rotating card.
  let zOffset = (fract(p.seed.x * 3.71) - 0.5) * render.tiltDepth;
  let worldPos = vec3f(local + offset, zOffset);

  var out: VSOut;
  // [VERIFY-API] getOutputPosition(position: vec3f) -> vec4f is a gpu-curtains
  // chunk helper (core/shaders/chunks/vertex/head/get-position-helpers.mjs),
  // auto-injected into every vertex shader head:
  //   fn getOutputPosition(position: vec3f) -> vec4f {
  //     return camera.projection * camera.view * matrices.model * vec4f(position, 1.0);
  //   }
  out.position = getOutputPosition(worldPos);
  out.corner = corner;
  out.brightness = p.seed.y;
  out.phase = p.seed.x;
  out.speed = length(p.vel);
  out.twinkle = tw;
  return out;
}
`;

// [VERIFY-API] Custom vertex + custom fragment code are compiled as SEPARATE
// shader modules (RenderPipelineEntry.mjs#patchShaders patches
// `shaders.vertex.head` / `shaders.fragment.head` independently). Struct
// declarations are NOT shared across stages — same finding already recorded
// in GrainPass.js for the ShaderPass default-vertex/custom-fragment case —
// so VSOut must be redeclared here identically (locations must match the
// vertex module's output for the WebGPU pipeline's inter-stage interface to
// validate). The `render` uniform (declared once via Plane's `uniforms`
// param) IS auto-injected into both stage heads by the same patch step, so
// `render.opacity` below needs no redeclaration.
export const PARTICLES_FRAGMENT = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) corner: vec2f,
  @location(1) brightness: f32,
  @location(2) phase: f32,
  @location(3) speed: f32,
  @location(4) twinkle: f32,
};

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  // Soft disc falloff.
  let d = length(in.corner);
  let disc = smoothstep(1.0, 0.35, d);
  if (disc <= 0.001) { discard; }

  // atlab.io-style twinkle: brightness oscillates per particle...
  let shimmer = 1.0 + render.shimmerIntensity * in.twinkle;
  // ...and disturbed particles briefly glint brighter.
  let glint = 1.0 + min(render.glintGain * in.speed, 3.0);
  let intensity = in.brightness * disc * render.opacity * shimmer * glint;

  // Premultiplied output (canvas alphaMode is premultiplied; blend ONE/1-src-alpha).
  let color = vec3f(1.0, 1.0, 1.0) * intensity;
  return vec4f(color, intensity);
}
`;
