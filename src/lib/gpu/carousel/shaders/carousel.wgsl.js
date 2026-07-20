// Minimal textured-quad shaders for a carousel ring plane. No custom vertex
// logic needed — position/uv passthrough via the auto-injected `Attributes`
// struct and `getOutputPosition()` chunk (same mechanism Phase 2 Task 4
// resolved for Plane; [VERIFY-API #1] in CarouselScene.js confirms it
// generalizes to plain Mesh — Mesh.mjs's own `super(renderer, null, params)`
// goes through the identical Geometry/RenderPipelineEntry machinery).
export const CAROUSEL_VERTEX = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn main(attributes: Attributes) -> VSOutput {
  var vsOutput: VSOutput;
  vsOutput.position = getOutputPosition(attributes.position);
  vsOutput.uv = attributes.uv;
  return vsOutput;
}
`;

export const CAROUSEL_FRAGMENT = /* wgsl */ `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@fragment
fn main(fsInput: VSOutput) -> @location(0) vec4f {
  return textureSample(videoTexture, videoSampler, fsInput.uv);
}
`;
