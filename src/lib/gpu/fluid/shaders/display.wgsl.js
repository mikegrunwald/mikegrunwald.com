// Port of displayShaderSource (WebGLFluid.js:555-607) with SHADING/BLOOM/SUNRAYS
// all enabled at compile time (production config runs all three true — the panel
// only toggles them via the `flags` uniform, no shader permutations needed).
//
// Grading math note (do not simplify): the browser's CSS filter chain
// unpremultiplies (c/a), applies the affine (M·(c/a) + offset), then
// re-premultiplies by the new alpha (a · gradingAlpha). Algebraically:
//   (M·(c/a) + offset) · a · gAlpha = (M·c + offset·a) · gAlpha
// — which is what the last three lines compute. No divide needed, no
// precision loss as a→0. Output is premultiplied for the canvas's
// 'premultiplied' alphaMode.
export const DISPLAY_FRAG = /* wgsl */ `
struct Uniforms {
  texelSize: vec2f,
  ditherScale: vec2f,
  gradingMat: mat3x3f,      // affine color transform (Task 3 grading.js)
  gradingOffset: vec3f,
  gradingAlpha: f32,
  flags: vec4f,             // x: shading, y: bloom, z: sunrays, w: unused
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uBloom: texture_2d<f32>;
@group(0) @binding(3) var uSunrays: texture_2d<f32>;
@group(0) @binding(4) var uDithering: texture_2d<f32>;
@group(0) @binding(5) var linearSampler: sampler;
@group(0) @binding(6) var repeatSampler: sampler;

fn linearToGamma(color: vec3f) -> vec3f {
  let c = max(color, vec3f(0.0));
  return max(1.055 * pow(c, vec3f(0.416666667)) - 0.055, vec3f(0.0));
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4f {
  var c = textureSample(uTexture, linearSampler, in.vUv).rgb;

  if (uniforms.flags.x > 0.5) { // SHADING
    let lc = textureSample(uTexture, linearSampler, in.vL).rgb;
    let rc = textureSample(uTexture, linearSampler, in.vR).rgb;
    let tc = textureSample(uTexture, linearSampler, in.vT).rgb;
    let bc = textureSample(uTexture, linearSampler, in.vB).rgb;
    let dx = length(rc) - length(lc);
    let dy = length(tc) - length(bc);
    let n = normalize(vec3f(dx, dy, length(uniforms.texelSize)));
    let l = vec3f(0.0, 0.0, 1.0);
    let diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
    c *= diffuse;
  }

  var bloom = textureSample(uBloom, linearSampler, in.vUv).rgb;
  let sunrays = textureSample(uSunrays, linearSampler, in.vUv).r;
  if (uniforms.flags.z > 0.5) { // SUNRAYS
    c *= sunrays;
    bloom *= sunrays;
  }
  if (uniforms.flags.y > 0.5) { // BLOOM
    // Production dithering texture is 1x1 white (createTextureAsync called
    // with no URL, WebGLFluid.js:891) → noise = 1.0. Port faithfully.
    var noise = textureSample(uDithering, repeatSampler, in.vUv * uniforms.ditherScale).r;
    noise = noise * 2.0 - 1.0;
    bloom += noise / 255.0;
    bloom = linearToGamma(bloom);
    c += bloom;
  }

  let a = max(c.r, max(c.g, c.b));

  // Scroll grading — replicates the removed CSS filter chain.
  let graded = uniforms.gradingMat * c + uniforms.gradingOffset * a;
  let outAlpha = a * uniforms.gradingAlpha;
  // Premultiplied output for 'premultiplied' canvas alpha mode:
  return vec4f(graded * uniforms.gradingAlpha, outAlpha);
}
`;
