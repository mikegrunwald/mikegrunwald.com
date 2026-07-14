// Ports of WebGLFluid.js shaders. Keep math identical — comments cite source lines.

// splatShader (WebGLFluid.js:705-721)
export const SPLAT_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  point: vec2f,
  color: vec3f,
  aspectRatio: f32,
  radius: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTarget: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var p = in.vUv - uniforms.point;
  p.x *= uniforms.aspectRatio;
  let splat = exp(-dot(p, p) / uniforms.radius) * uniforms.color;
  let base = textureSample(uTarget, linearSampler, in.vUv).xyz;
  return vec4f(base + splat, 1.0);
}
`;

// curlShader (WebGLFluid.js:779-796)
export const CURL_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uVelocity: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let L = textureSample(uVelocity, linearSampler, in.vL).y;
  let R = textureSample(uVelocity, linearSampler, in.vR).y;
  let T = textureSample(uVelocity, linearSampler, in.vT).x;
  let B = textureSample(uVelocity, linearSampler, in.vB).x;
  let vorticity = R - L - T + B;
  return vec4f(0.5 * vorticity, 0.0, 0.0, 1.0);
}
`;

// vorticityShader (WebGLFluid.js:798-823)
export const VORTICITY_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  curl: f32,
  dt: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uVelocity: texture_2d<f32>;
@group(0) @binding(2) var uCurl: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var nearestSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let L = textureSample(uCurl, nearestSampler, in.vL).x;
  let R = textureSample(uCurl, nearestSampler, in.vR).x;
  let T = textureSample(uCurl, nearestSampler, in.vT).x;
  let B = textureSample(uCurl, nearestSampler, in.vB).x;
  let C = textureSample(uCurl, nearestSampler, in.vUv).x;
  var force = 0.5 * vec2f(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uniforms.curl * C;
  force.y *= -1.0;
  let vel = textureSample(uVelocity, linearSampler, in.vUv).xy;
  return vec4f(vel + force * uniforms.dt, 0.0, 1.0);
}
`;

// divergenceShader (WebGLFluid.js:755-777)
export const DIVERGENCE_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uVelocity: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var L = textureSample(uVelocity, linearSampler, in.vL).x;
  var R = textureSample(uVelocity, linearSampler, in.vR).x;
  var T = textureSample(uVelocity, linearSampler, in.vT).y;
  var B = textureSample(uVelocity, linearSampler, in.vB).y;
  let C = textureSample(uVelocity, linearSampler, in.vUv).xy;
  if (in.vL.x < 0.0) { L = -C.x; }
  if (in.vR.x > 1.0) { R = -C.x; }
  if (in.vT.y > 1.0) { T = -C.y; }
  if (in.vB.y < 0.0) { B = -C.y; }
  let div = 0.5 * (R - L + T - B);
  return vec4f(div, 0.0, 0.0, 1.0);
}
`;

// clearShader (WebGLFluid.js:506-515) — used for pressure decay
export const CLEAR_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  value: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var nearestSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  return uniforms.value * textureSample(uTexture, nearestSampler, in.vUv);
}
`;

// pressureShader (WebGLFluid.js:825-845)
export const PRESSURE_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uPressure: texture_2d<f32>;
@group(0) @binding(2) var uDivergence: texture_2d<f32>;
@group(0) @binding(3) var nearestSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let L = textureSample(uPressure, nearestSampler, in.vL).x;
  let R = textureSample(uPressure, nearestSampler, in.vR).x;
  let T = textureSample(uPressure, nearestSampler, in.vT).x;
  let B = textureSample(uPressure, nearestSampler, in.vB).x;
  let divergence = textureSample(uDivergence, nearestSampler, in.vUv).x;
  let pressure = (L + R + B + T - divergence) * 0.25;
  return vec4f(pressure, 0.0, 0.0, 1.0);
}
`;

// gradientSubtractShader (WebGLFluid.js:847-866)
export const GRADIENT_SUBTRACT_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uPressure: texture_2d<f32>;
@group(0) @binding(2) var uVelocity: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var nearestSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let L = textureSample(uPressure, nearestSampler, in.vL).x;
  let R = textureSample(uPressure, nearestSampler, in.vR).x;
  let T = textureSample(uPressure, nearestSampler, in.vT).x;
  let B = textureSample(uPressure, nearestSampler, in.vB).x;
  var velocity = textureSample(uVelocity, linearSampler, in.vUv).xy;
  velocity -= vec2f(R - L, T - B);
  return vec4f(velocity, 0.0, 1.0);
}
`;

// advectionShader, linear-filtering path (WebGLFluid.js:723-753).
// WebGPU guarantees linear filtering on 16-float — MANUAL_FILTERING branch not ported.
export const ADVECTION_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  dt: f32,
  dissipation: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uVelocity: texture_2d<f32>;
@group(0) @binding(2) var uSource: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let coord = in.vUv - uniforms.dt * textureSample(uVelocity, linearSampler, in.vUv).xy * uniforms.texelSize;
  let result = textureSample(uSource, linearSampler, coord);
  let decay = 1.0 + uniforms.dissipation * uniforms.dt;
  return result / decay;
}
`;

// copyShader (WebGLFluid.js:496-504) — used on resize
export const COPY_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  return textureSample(uTexture, linearSampler, in.vUv);
}
`;
