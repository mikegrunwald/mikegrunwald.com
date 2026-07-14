// Ports of WebGLFluid.js bloom/sunrays/blur shaders. Keep math identical — comments cite source lines.

// bloomPrefilterShader (WebGLFluid.js:609-624)
export const BLOOM_PREFILTER_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  curve: vec3f,
  threshold: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var c = textureSample(uTexture, linearSampler, in.vUv).rgb;
  let br = max(c.r, max(c.g, c.b));
  var rq = clamp(br - uniforms.curve.x, 0.0, uniforms.curve.y);
  rq = uniforms.curve.z * rq * rq;
  c *= max(rq, br - uniforms.threshold) / max(br, 0.0001);
  return vec4f(c, 0.0);
}
`;

// bloomBlurShader (WebGLFluid.js:626-643) — also used additively for upsample
export const BLOOM_BLUR_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var sum = vec4f(0.0);
  sum += textureSample(uTexture, linearSampler, in.vL);
  sum += textureSample(uTexture, linearSampler, in.vR);
  sum += textureSample(uTexture, linearSampler, in.vT);
  sum += textureSample(uTexture, linearSampler, in.vB);
  return sum * 0.25;
}
`;

// bloomFinalShader (WebGLFluid.js:645-663)
export const BLOOM_FINAL_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  intensity: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var sum = vec4f(0.0);
  sum += textureSample(uTexture, linearSampler, in.vL);
  sum += textureSample(uTexture, linearSampler, in.vR);
  sum += textureSample(uTexture, linearSampler, in.vT);
  sum += textureSample(uTexture, linearSampler, in.vB);
  return sum * 0.25 * uniforms.intensity;
}
`;

// sunraysMaskShader (WebGLFluid.js:665-676)
export const SUNRAYS_MASK_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var c = textureSample(uTexture, linearSampler, in.vUv);
  let br = max(c.r, max(c.g, c.b));
  c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
  return c;
}
`;

// sunraysShader (WebGLFluid.js:678-703)
export const SUNRAYS_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  weight: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let ITERATIONS = 16;
  let Density = 0.3;
  let Decay = 0.95;
  let Exposure = 0.7;
  var coord = in.vUv;
  var dir = in.vUv - 0.5;
  dir *= 1.0 / f32(ITERATIONS) * Density;
  var illuminationDecay = 1.0;
  var color = textureSample(uTexture, linearSampler, in.vUv).a;
  for (var i = 0; i < ITERATIONS; i++) {
    coord -= dir;
    let col = textureSampleLevel(uTexture, linearSampler, coord, 0.0).a;
    color += col * illuminationDecay * uniforms.weight;
    illuminationDecay *= Decay;
  }
  return vec4f(color * Exposure, 0.0, 0.0, 1.0);
}
`;

// blurShader + blurVertexShader (WebGLFluid.js:465-494) — 1D 3-tap, offset 1.33333333
// The original uses a special vertex shader; here the offset is applied in-fragment.
export const BLUR_FRAG = /* wgsl */ `
struct Uniforms { texelSize: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  let offset = 1.33333333;
  let vL = in.vUv - uniforms.texelSize * offset;
  let vR = in.vUv + uniforms.texelSize * offset;
  var sum = textureSample(uTexture, linearSampler, in.vUv) * 0.29411764;
  sum += textureSample(uTexture, linearSampler, vL) * 0.35294117;
  sum += textureSample(uTexture, linearSampler, vR) * 0.35294117;
  return sum;
}
`;
