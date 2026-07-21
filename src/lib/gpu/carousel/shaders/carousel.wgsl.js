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
  // The quad is LARGER than the video (params.quadHalf vs params.videoHalf) so
  // later work has room to draw outside the video's edge. Convert uv into
  // plane-local WORLD units first — doing the geometry in world units rather
  // than normalized uv keeps corners circular on a non-square plane, instead of
  // stretching with the aspect ratio.
  let p = (fsInput.uv - vec2f(0.5)) * 2.0 * params.quadHalf;

  // Video uv: p mapped back into 0..1 across the video's extent only. Outside
  // the video this goes beyond 0..1, which is why the region is masked below
  // rather than relying on the sampler's clamp.
  let videoUv = (p / params.videoHalf) * 0.5 + vec2f(0.5);

  // MUST be textureSampleBaseClampToEdge, NOT textureSample.
  //
  // gpu-curtains binds a video MediaTexture as WGSL \`texture_external\`
  // (MediaTexture.mjs:14 defaults \`useExternalTextures: true\`, and :503 then
  // selects the "externalVideo" source type). WGSL has no \`textureSample\`
  // overload accepting \`texture_external\` — only \`textureSampleBaseClampToEdge\`
  // takes one. Using \`textureSample\` here compiles fine as text but fails at
  // pipeline creation with "no matching call to
  // textureSample(texture_external, sampler, vec2<f32>)".
  //
  // That failure is far more destructive than a missing texture: gpu-curtains'
  // GPUDeviceManager.animate() is \`this.render(); this.animationFrameID =
  // requestAnimationFrame(...)\` — the throw from the failed pipeline escapes
  // render(), so the rAF is NEVER re-armed and the ENTIRE canvas freezes on its
  // last frame, taking the fluid and hero particles down with it. Verified: this
  // is exactly what happened.
  let video = textureSampleBaseClampToEdge(videoTexture, videoSampler, videoUv);

  // Hard rectangular mask for now — Task 4 replaces this with a rounded-box SDF.
  let inside = step(abs(p.x), params.videoHalf.x) * step(abs(p.y), params.videoHalf.y);
  let alpha = inside;

  // PREMULTIPLIED alpha — the convention every transparent surface in this
  // codebase uses (FluidScene, LogoParticlesScene, GrainPass). Returning
  // straight alpha here produces a bright fringe where the video meets the pad.
  return vec4f(video.rgb * alpha, alpha);
}
`;
