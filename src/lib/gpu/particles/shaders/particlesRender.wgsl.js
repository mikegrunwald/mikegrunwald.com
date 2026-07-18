// Unprojected instanced particle render. One quad (6 verts) per instance.
// Storage struct is the LOCKED 32 B/particle AoS (pos,vel,home,seed) shared with
// the compute shader (see LogoParticlesScene.js header). seed.x=phase, seed.y=brightness.
// Uniform layout (96 B): rect@0 vec4f(left,top,width,height, CSS px),
//   canvas@16 vec2f(w,h CSS px), size@24 f32, opacity@28 f32, time@32 f32,
//   shimmerSpeed@36 f32, shimmerIntensity@40 f32, sizeVariation@44 f32,
//   glintGain@48 f32, tilt@56 vec2f(tiltX,tiltY rad), tiltDepth@64 f32.
//
// NOTE: unlike gpu-curtains' vertex/fragment split (patched into separate
// shader modules with the binding/struct WGSL auto-injected into each), this
// renderer concatenates BOTH stages into ONE shader module string (see
// particleRenderer.js: `code: PARTICLES_RENDER_VERTEX + PARTICLES_RENDER_FRAGMENT`).
// The `struct U`/`var<uniform> u`/`struct VSOut` declarations therefore live
// ONLY in the vertex string below, ahead of both `@vertex fn vsMain` and the
// fragment string's `@fragment fn fsMain` — WGSL resolves module-scope
// declarations regardless of which string they were concatenated from, as
// long as they appear before first use in the final source, which they do
// here. Verified by a real successful pipeline compile (Step 6 pane check;
// createRenderPipelineAsync/pipeline `ready` fails loudly on WGSL errors).
export const PARTICLES_RENDER_VERTEX = /* wgsl */ `
struct Particle { pos: vec2f, vel: vec2f, home: vec2f, seed: vec2f };
struct U {
  rect: vec4f,
  canvas: vec2f,
  size: f32,
  opacity: f32,
  time: f32,
  shimmerSpeed: f32,
  shimmerIntensity: f32,
  sizeVariation: f32,
  glintGain: f32,
  _pad0: f32,
  tilt: vec2f,
  tiltDepth: f32,
  _pad1: f32,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) corner: vec2f,
  @location(1) brightness: f32,
  @location(2) speed: f32,
  @location(3) twinkle: f32,
};

// Degenerate output: zero-area primitive behind the near plane -> never rasterized.
fn degenerate() -> VSOut {
  var o: VSOut;
  o.position = vec4f(0.0, 0.0, 0.0, 0.0); // w=0 -> clipped
  o.corner = vec2f(0.0);
  o.brightness = 0.0;
  o.speed = 0.0;
  o.twinkle = 0.0;
  return o;
}

fn isFiniteF(x: f32) -> bool { return x == x && abs(x) < 3.4e38; }

@vertex
fn vsMain(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let p = particles[ii];

  // DEFENSIVE CLAMP: reject any non-finite particle/uniform input.
  if (!(isFiniteF(p.pos.x) && isFiniteF(p.pos.y) &&
        isFiniteF(u.rect.x) && isFiniteF(u.rect.y) && isFiniteF(u.rect.z) && isFiniteF(u.rect.w) &&
        isFiniteF(u.canvas.x) && isFiniteF(u.canvas.y) && isFiniteF(u.size))) {
    return degenerate();
  }
  if (u.rect.z <= 0.0 || u.rect.w <= 0.0 || u.canvas.x <= 0.0 || u.canvas.y <= 0.0) {
    return degenerate();
  }

  // logo-local (0..1, top-left) -> screen uv -> NDC (y up). Single y-flip here.
  let sx = (u.rect.x + p.pos.x * u.rect.z) / u.canvas.x;
  let sy = (u.rect.y + p.pos.y * u.rect.w) / u.canvas.y;
  var ndc = vec2f(sx * 2.0 - 1.0, 1.0 - sy * 2.0);

  // Per-particle z depth (parallax) from seed. Screen-space tilt = shift by tilt*z.
  let z = (fract(p.seed.x * 3.71) - 0.5); // -0.5..0.5
  ndc += u.tilt * (z * u.tiltDepth);

  // Sprite corner (two-triangle quad). vi in [0,6).
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let corner = corners[vi];

  // Per-particle size shimmer (Task 3 uses shimmerIntensity in fragment; size wobble here).
  let freq = 0.7 + 1.3 * fract(p.seed.x * 7.31);
  let tw = sin(u.time * u.shimmerSpeed * freq + p.seed.x * 6.2831853);
  let jitter = (0.7 + 0.6 * fract(p.seed.x * 13.37)) * (1.0 + u.sizeVariation * 0.35 * tw);

  // size = sprite radius as a fraction of canvas HEIGHT (NDC half-extent = size*2).
  // Keep square by correcting x for aspect.
  let aspect = u.canvas.x / u.canvas.y;
  let radius = clamp(u.size * jitter, 0.0, 0.2); // hard cap: never a giant primitive
  let offset = vec2f(corner.x * radius / aspect, corner.y * radius) * 2.0;
  let pos = ndc + offset;

  // Final range guard: if anything went out of a sane NDC range, discard.
  if (!(isFiniteF(pos.x) && isFiniteF(pos.y)) || abs(pos.x) > 2.0 || abs(pos.y) > 2.0) {
    return degenerate();
  }

  var out: VSOut;
  out.position = vec4f(pos, 0.0, 1.0);
  out.corner = corner;
  out.brightness = p.seed.y;
  out.speed = length(p.vel);
  out.twinkle = tw;
  return out;
}
`;

export const PARTICLES_RENDER_FRAGMENT = /* wgsl */ `
@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let d = length(in.corner);
  let disc = smoothstep(1.0, 0.35, d);
  if (disc <= 0.001) { discard; }
  let shimmer = 1.0 + u.shimmerIntensity * in.twinkle;
  let glint = 1.0 + min(u.glintGain * in.speed, 3.0);
  let intensity = in.brightness * disc * u.opacity * shimmer * glint;
  let color = vec3f(1.0, 1.0, 1.0) * intensity;
  return vec4f(color, intensity);
}
`;
